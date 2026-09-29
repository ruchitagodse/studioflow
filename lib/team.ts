import "server-only";

import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { Principal } from "@/lib/auth/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { invitationSchema, membershipUpdateSchema } from "@/lib/validation";
import { createInvitationSecret, hashInvitationSecret, invitationCanBeAccepted, invitationExpiry, invitationRecipientMatches, invitationTokenMatches, normalUserCanJoinStudio, type InvitationStatus } from "@/lib/team-logic";

function requireOwner(principal: Principal) {
  if (!principal.studioId || !principal.roles.includes("owner")) throw new Error("FORBIDDEN_TEAM");
  return principal.studioId;
}

function audit(studioId: string, action: string, actorUid: string, targetId: string, detail: Record<string, unknown> = {}) {
  return {
    action,
    actorUid,
    targetId,
    createdAt: FieldValue.serverTimestamp(),
    result: "success",
    ...detail,
  };
}

function authUserMissing(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "auth/user-not-found";
}

export async function createTeamInvitation(principal: Principal, raw: unknown) {
  const studioId = requireOwner(principal);
  const input = invitationSchema.parse(raw);
  const db = getAdminDb();
  const auth = getAdminAuth();
  let existingUserUid: string | null = null;
  try { const existingUser = await auth.getUserByEmail(input.email); if (existingUser.disabled) throw new Error("TARGET_ACCOUNT_INACTIVE"); existingUserUid = existingUser.uid; } catch (error) { if (!authUserMissing(error)) throw error; }
  if (existingUserUid) {
    const index = await db.doc(`userMemberships/${existingUserUid}`).get();
    const current = index.exists ? { studioId: String(index.data()?.studioId), status: String(index.data()?.status) } : null;
    if (!normalUserCanJoinStudio(current, studioId)) throw new Error("ACTIVE_MEMBERSHIP_IN_ANOTHER_STUDIO");
    if (current?.studioId === studioId && current.status === "active") throw new Error("MEMBERSHIP_ALREADY_ACTIVE");
  }

  const secret = createInvitationSecret();
  const invitationId = input.operationId;
  const invitationRef = db.doc(`studios/${studioId}/invitations/${invitationId}`);
  await db.runTransaction(async (transaction) => {
    const studio = await transaction.get(db.doc(`studios/${studioId}`));
    if (!studio.exists || studio.data()?.status !== "active") throw new Error("INACTIVE_STUDIO");
    const duplicate = await transaction.get(db.collection(`studios/${studioId}/invitations`).where("email", "==", input.email).where("status", "==", "pending").limit(1));
    if (!duplicate.empty && duplicate.docs[0].id !== invitationId) throw new Error("DUPLICATE_ACTIVE_INVITATION");
    const current = await transaction.get(invitationRef);
    if (current.exists) throw new Error("INVITATION_OPERATION_CONFLICT");
    transaction.set(invitationRef, {
      email: input.email,
      displayName: input.displayName ?? "",
      roles: input.roles,
      status: "pending",
      tokenHash: hashInvitationSecret(secret),
      existingUserUid,
      expiresAt: Timestamp.fromDate(invitationExpiry(new Date())),
      createdAt: FieldValue.serverTimestamp(),
      createdBy: principal.uid,
    });
    transaction.set(db.doc(`invitationLookups/${invitationId}`), { studioId, tokenHash: hashInvitationSecret(secret), createdAt: FieldValue.serverTimestamp() });
    transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit(studioId, "membership.invited", principal.uid, invitationId, { after: { email: input.email, roles: input.roles } }));
  });
  return { invitationId, secret, email: input.email, existingAccount: Boolean(existingUserUid) };
}

export type InvitationPreview = { id: string; email: string; displayName: string; status: InvitationStatus; expiresAt: Date };

export async function getInvitationPreview(invitationId: string, secret: string): Promise<InvitationPreview | null> {
  const db = getAdminDb(); const lookup = await db.doc(`invitationLookups/${invitationId}`).get();
  if (!lookup.exists || !invitationTokenMatches(secret, String(lookup.data()?.tokenHash ?? ""))) return null;
  const snapshot = await db.doc(`studios/${lookup.data()?.studioId}/invitations/${invitationId}`).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  if (!data) return null;
  return { id: snapshot.id, email: String(data.email), displayName: String(data.displayName ?? ""), status: data.status as InvitationStatus, expiresAt: data.expiresAt.toDate() };
}

export async function acceptTeamInvitation(actor: { uid: string; email: string }, invitationId: string, secret: string) {
  const db = getAdminDb(); const lookup = await db.doc(`invitationLookups/${invitationId}`).get();
  if (!lookup.exists || !invitationTokenMatches(secret, String(lookup.data()?.tokenHash ?? ""))) throw new Error("INVALID_INVITATION");
  const studioId = String(lookup.data()?.studioId ?? "");
  if (!studioId) throw new Error("INVALID_INVITATION");
  const invitationRef = db.doc(`studios/${studioId}/invitations/${invitationId}`);
  await db.runTransaction(async (transaction) => {
    const [invitationSnapshot, studioSnapshot, indexSnapshot] = await Promise.all([
      transaction.get(invitationRef), transaction.get(db.doc(`studios/${studioId}`)), transaction.get(db.doc(`userMemberships/${actor.uid}`)),
    ]);
    if (!invitationSnapshot.exists || !studioSnapshot.exists || studioSnapshot.data()?.status !== "active") throw new Error("INVALID_INVITATION");
    const invitation = invitationSnapshot.data();
    const status = invitation?.status as InvitationStatus;
    const expiry = invitation?.expiresAt?.toDate() as Date | undefined;
    if (!expiry || !invitationCanBeAccepted(status, expiry, new Date())) {
      if (status === "pending" && expiry && expiry.getTime() <= Date.now()) transaction.update(invitationRef, { status: "expired", expiredAt: FieldValue.serverTimestamp() });
      throw new Error(status === "revoked" ? "REVOKED_INVITATION" : status === "accepted" ? "USED_INVITATION" : "EXPIRED_INVITATION");
    }
    if (!invitationTokenMatches(secret, String(invitation?.tokenHash ?? ""))) throw new Error("INVALID_INVITATION");
    if (!invitationRecipientMatches(String(invitation?.email ?? ""), actor.email)) throw new Error("INVITATION_RECIPIENT_MISMATCH");
    const currentIndex = indexSnapshot.exists ? { studioId: String(indexSnapshot.data()?.studioId), status: String(indexSnapshot.data()?.status) } : null;
    if (!normalUserCanJoinStudio(currentIndex, studioId)) throw new Error("ACTIVE_MEMBERSHIP_IN_ANOTHER_STUDIO");
    const memberRef = db.doc(`studios/${studioId}/members/${actor.uid}`);
    const existingMember = await transaction.get(memberRef);
    if (existingMember.exists && existingMember.data()?.status === "active") throw new Error("MEMBERSHIP_ALREADY_ACTIVE");
    const roles = invitation?.roles as string[];
    const membership = { uid: actor.uid, email: actor.email, displayName: String(invitation?.displayName ?? ""), roles, status: "active", activatedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid };
    transaction.set(memberRef, membership, { merge: true });
    transaction.set(db.doc(`userMemberships/${actor.uid}`), { studioId, roles, status: "active", updatedAt: FieldValue.serverTimestamp() });
    transaction.update(invitationRef, { status: "accepted", acceptedAt: FieldValue.serverTimestamp(), acceptedBy: actor.uid });
    transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit(studioId, "membership.provisioned", actor.uid, actor.uid, { after: { roles } }));
    transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit(studioId, "membership.activated", actor.uid, actor.uid, { after: { roles } }));
  });
  return studioId;
}

export async function updateTeamMembership(principal: Principal, raw: unknown) {
  const studioId = requireOwner(principal);
  const input = membershipUpdateSchema.parse(raw);
  const db = getAdminDb();
  if (input.action === "activate") {
    const target = await getAdminAuth().getUser(input.uid);
    if (target.disabled) throw new Error("TARGET_ACCOUNT_INACTIVE");
  }
  const ref = db.doc(`studios/${studioId}/members/${input.uid}`);
  await db.runTransaction(async (transaction) => {
    const member = await transaction.get(ref);
    if (!member.exists) throw new Error("MEMBERSHIP_NOT_FOUND");
    const before = member.data();
    if ((before?.roles as string[] | undefined)?.includes("owner")) throw new Error("OWNER_MEMBERSHIP_PROTECTED");
    const indexRef = db.doc(`userMemberships/${input.uid}`);
    const index = await transaction.get(indexRef);
    const base = { updatedAt: FieldValue.serverTimestamp(), updatedBy: principal.uid };
    if (input.action === "update") {
      transaction.update(ref, { ...base, displayName: input.displayName ?? "", roles: input.roles! });
      transaction.set(indexRef, { studioId, status: String(before?.status), roles: input.roles!, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit(studioId, "membership.role_changed", principal.uid, input.uid, { before: { roles: before?.roles }, after: { roles: input.roles } }));
      transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit(studioId, "membership.profile_updated", principal.uid, input.uid, { before: { displayName: before?.displayName ?? "" }, after: { displayName: input.displayName ?? "" } }));
      return;
    }
    if (input.action === "activate") {
      const current = index.exists ? { studioId: String(index.data()?.studioId), status: String(index.data()?.status) } : null;
      if (!normalUserCanJoinStudio(current, studioId)) throw new Error("ACTIVE_MEMBERSHIP_IN_ANOTHER_STUDIO");
      transaction.update(ref, { ...base, status: "active", reactivatedAt: FieldValue.serverTimestamp() });
      transaction.set(indexRef, { studioId, status: "active", roles: before?.roles ?? [], updatedAt: FieldValue.serverTimestamp() });
      transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit(studioId, "membership.activated", principal.uid, input.uid));
      return;
    }
    transaction.update(ref, { ...base, status: "inactive", [input.action === "revoke" ? "revokedAt" : "deactivatedAt"]: FieldValue.serverTimestamp(), reason: input.reason });
    if (index.exists && index.data()?.studioId === studioId) transaction.set(indexRef, { studioId, status: "inactive", roles: before?.roles ?? [], updatedAt: FieldValue.serverTimestamp() });
    transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit(studioId, input.action === "revoke" ? "membership.revoked" : "membership.deactivated", principal.uid, input.uid, { reason: input.reason }));
  });
}

export async function revokeTeamInvitation(principal: Principal, invitationId: string) {
  const studioId = requireOwner(principal); const db = getAdminDb(); const ref = db.doc(`studios/${studioId}/invitations/${invitationId}`);
  await db.runTransaction(async (transaction) => {
    const invitation = await transaction.get(ref);
    if (!invitation.exists) throw new Error("INVITATION_NOT_FOUND");
    if (invitation.data()?.status !== "pending") throw new Error("INVITATION_NOT_PENDING");
    transaction.update(ref, { status: "revoked", revokedAt: FieldValue.serverTimestamp(), revokedBy: principal.uid });
    transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit(studioId, "membership.invitation_revoked", principal.uid, invitationId));
  });
}
