import "server-only";

import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { provisionStudioSchema, studioLifecycleSchema } from "@/lib/validation";
import type { z } from "zod";

type ProvisionInput = z.infer<typeof provisionStudioSchema>;

export async function provisionStudio(actorUid: string, rawInput: ProvisionInput) {
  const input = provisionStudioSchema.parse(rawInput);
  const auth = getAdminAuth();
  const owner = input.ownerMode === "assign"
    ? await auth.getUser(input.ownerUid!)
    : await auth.createUser({ email: input.ownerEmail!, emailVerified: false, disabled: false });
  const db = getAdminDb();
  const studioId = `studio_${randomUUID()}`;

  await db.runTransaction(async (transaction) => {
    const membershipIndex = db.doc(`userMemberships/${owner.uid}`);
    if ((await transaction.get(membershipIndex)).exists) throw new Error("OWNER_ALREADY_HAS_STUDIO");
    const studioRef = db.doc(`studios/${studioId}`);
    const memberRef = db.doc(`studios/${studioId}/members/${owner.uid}`);
    const auditRef = db.doc(`platformAuditEvents/${randomUUID()}`);
    transaction.set(studioRef, { name: input.name, timezone: input.timezone, status: "active", settings: { theme: "nature-minimal", allowOwnerThemeCustomization: false }, initialOwnerUid: owner.uid, initialOwnerEmail: owner.email ?? null, createdAt: FieldValue.serverTimestamp(), createdBy: actorUid });
    transaction.set(memberRef, { uid: owner.uid, email: owner.email ?? null, roles: ["owner"], status: "active", createdAt: FieldValue.serverTimestamp(), createdBy: actorUid });
    transaction.set(membershipIndex, { studioId, roles: ["owner"], status: "active", updatedAt: FieldValue.serverTimestamp() });
    transaction.set(auditRef, { action: "studio.provisioned", actorUid, studioId, ownerUid: owner.uid, createdAt: FieldValue.serverTimestamp() });
  });

  const ownerRecoveryLink = input.ownerMode === "create" ? await auth.generatePasswordResetLink(input.ownerEmail!) : null;
  return { studioId, ownerUid: owner.uid, ownerEmail: owner.email ?? null, ownerRecoveryLink };
}

export async function updateStudioLifecycle(actorUid: string, rawInput: unknown) {
  const { studioId, status } = studioLifecycleSchema.parse(rawInput);
  const db = getAdminDb();
  await db.runTransaction(async (transaction) => {
    const studioRef = db.doc(`studios/${studioId}`);
    const studio = await transaction.get(studioRef);
    if (!studio.exists) throw new Error("STUDIO_NOT_FOUND");
    transaction.update(studioRef, { status, updatedAt: FieldValue.serverTimestamp(), updatedBy: actorUid });
    transaction.set(db.doc(`platformAuditEvents/${randomUUID()}`), { action: `studio.${status}`, actorUid, studioId, createdAt: FieldValue.serverTimestamp() });
  });
}
