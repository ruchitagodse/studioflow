import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { Principal } from "@/lib/auth/server";
import { incidentDocumentId, reviewRequiredFor, rollingWindowStart, type IncidentType } from "@/lib/incident-logic";
import { getAdminDb } from "@/lib/firebase/admin";
import { incidentPolicySchema, incidentReviewSchema, incidentReversalSchema, incidentWaiverSchema } from "@/lib/validation";

const policyId = "current";
type PolicySnapshot = { version: number; rollingDays: number; threshold: number; status: "active" | "inactive" };
type IncidentSource = { bookingId: string; customerUid: string; type: IncidentType; sourceTimestamp: Date };

function policyFrom(data: FirebaseFirestore.DocumentData | undefined): PolicySnapshot {
  return { version: Number(data?.version ?? 1), rollingDays: Number(data?.rollingDays ?? 30), threshold: Number(data?.threshold ?? 3), status: data?.status === "inactive" ? "inactive" : "active" };
}
function audit(action: string, actorUid: string, targetId: string, detail: Record<string, unknown> = {}) {
  return { action, actorUid, targetId, createdAt: FieldValue.serverTimestamp(), result: "success", ...detail };
}
function incidentPaths(studioId: string, incidentId: string) {
  const root = `studios/${studioId}`;
  return { incident: `${root}/incidents/${incidentId}`, policy: `${root}/incidentPolicies/${policyId}`, member: (uid: string) => `${root}/members/${uid}` };
}

async function reconcileReviewInTransaction(
  transaction: FirebaseFirestore.Transaction,
  studioId: string,
  customerUid: string,
  policy: PolicySnapshot,
  actorUid: string,
  ignoredIncidentId?: string,
  extraActive = 0,
) {
  const db = getAdminDb();
  const memberRef = db.doc(`studios/${studioId}/members/${customerUid}`);
  const cutoff = Timestamp.fromDate(rollingWindowStart(new Date(), policy.rollingDays));
  const active = await transaction.get(db.collection(`studios/${studioId}/incidents`).where("customerUid", "==", customerUid).where("status", "==", "active").where("sourceTimestamp", ">=", cutoff).limit(50));
  const count = active.docs.filter((doc) => doc.id !== ignoredIncidentId).length + extraActive;
  const required = policy.status === "active" && reviewRequiredFor(count, policy.threshold);
  const member = await transaction.get(memberRef);
  const before = Boolean(member.data()?.incidentReviewRequired);
  transaction.update(memberRef, { incidentReviewRequired: required, incidentReviewCount: count, incidentReviewEvaluatedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  if (before !== required) transaction.set(db.doc(`studios/${studioId}/auditEvents/incident-review-${customerUid}-${ignoredIncidentId ?? "evaluation"}-${required ? "on" : "off"}`), audit(required ? "incident.threshold_reached" : "incident.review_state_changed", actorUid, customerUid, { after: { reviewRequired: required, activeIncidentCount: count, policyVersion: policy.version } }));
  return { count, required };
}

export async function recordIncidentInTransaction(transaction: FirebaseFirestore.Transaction, studioId: string, actorUid: string, source: IncidentSource) {
  const db = getAdminDb();
  const id = incidentDocumentId(source.bookingId, source.type);
  const paths = incidentPaths(studioId, id);
  const incidentRef = db.doc(paths.incident);
  const policyRef = db.doc(paths.policy);
  const [incident, policyDocument] = await Promise.all([transaction.get(incidentRef), transaction.get(policyRef)]);
  if (incident.exists) return { incidentId: id, idempotent: true };
  const policy = policyFrom(policyDocument.data());
  const review = await reconcileReviewInTransaction(transaction, studioId, source.customerUid, policy, actorUid, undefined, 1);
  transaction.set(incidentRef, { studioId, customerUid: source.customerUid, bookingId: source.bookingId, type: source.type, sourceIdentity: id, sourceTimestamp: Timestamp.fromDate(source.sourceTimestamp), createdAt: FieldValue.serverTimestamp(), status: "active", policySnapshot: policy, reviewRequiredAtCreation: review.required, createdBy: actorUid });
  transaction.set(db.doc(`studios/${studioId}/auditEvents/incident-created-${id}`), audit("incident.created", actorUid, id, { after: { bookingId: source.bookingId, customerUid: source.customerUid, type: source.type, policyVersion: policy.version } }));
  return { incidentId: id, idempotent: false };
}

export async function reverseNoShowIncidentInTransaction(transaction: FirebaseFirestore.Transaction, studioId: string, actorUid: string, bookingId: string, reason: string) {
  const db = getAdminDb(); const id = incidentDocumentId(bookingId, "no-show"); const paths = incidentPaths(studioId, id); const incidentRef = db.doc(paths.incident);
  const [incident, policyDocument] = await Promise.all([transaction.get(incidentRef), transaction.get(db.doc(paths.policy))]);
  if (!incident.exists || incident.data()?.status === "reversed") return { incidentId: id, idempotent: true };
  const data = incident.data()!;
  const policy = policyFrom(policyDocument.data());
  await reconcileReviewInTransaction(transaction, studioId, String(data.customerUid), policy, actorUid, id);
  transaction.update(incidentRef, { status: "reversed", reversedAt: FieldValue.serverTimestamp(), reversedBy: actorUid, reversalReason: reason, updatedAt: FieldValue.serverTimestamp() });
  transaction.set(db.doc(`studios/${studioId}/auditEvents/incident-reversed-${id}`), audit("incident.reversed", actorUid, id, { reason, after: { bookingId } }));
  return { incidentId: id, idempotent: false };
}

function requireOwner(principal: Principal) {
  if (!principal.studioId || !principal.roles.includes("owner")) throw new Error("FORBIDDEN_INCIDENT_POLICY");
  return principal.studioId;
}
async function assertActiveOwner(studioId: string, principal: Principal) {
  const db = getAdminDb(); const [studio, member] = await Promise.all([db.doc(`studios/${studioId}`).get(), db.doc(`studios/${studioId}/members/${principal.uid}`).get()]);
  if (!studio.exists || studio.data()?.status !== "active") throw new Error("INACTIVE_STUDIO");
  if (!member.exists || member.data()?.status !== "active") throw new Error("MEMBERSHIP_INACTIVE");
}

export async function saveIncidentPolicy(principal: Principal, raw: unknown) {
  const studioId = requireOwner(principal); const input = incidentPolicySchema.parse(raw); await assertActiveOwner(studioId, principal); const db = getAdminDb(); const ref = db.doc(`studios/${studioId}/incidentPolicies/${policyId}`);
  const auditRef = db.doc(`studios/${studioId}/auditEvents/incident-policy-${input.operationId}`);
  return db.runTransaction(async (transaction) => { const [existing, priorAudit] = await Promise.all([transaction.get(ref), transaction.get(auditRef)]); if (priorAudit.exists) { if (priorAudit.data()?.request?.status !== input.status) throw new Error("INCIDENT_OPERATION_CONFLICT"); return policyFrom(priorAudit.data()?.after); }
    const current = policyFrom(existing.data()); if (existing.exists && current.status === input.status) return current;
    const next = { version: existing.exists ? current.version + 1 : 1, rollingDays: 30, threshold: 3, status: input.status } satisfies PolicySnapshot; const action = !existing.exists ? "incident.policy_created" : next.status === "active" ? "incident.policy_activated" : "incident.policy_deactivated"; transaction.set(ref, { ...next, updatedAt: FieldValue.serverTimestamp(), updatedBy: principal.uid, createdAt: existing.exists ? existing.data()?.createdAt : FieldValue.serverTimestamp() }, { merge: true }); transaction.set(auditRef, audit(action, principal.uid, ref.id, { request: { status: input.status }, after: next })); return next; });
}

export async function waiveIncident(principal: Principal, raw: unknown) {
  const studioId = requireOwner(principal); const input = incidentWaiverSchema.parse(raw); await assertActiveOwner(studioId, principal); const db = getAdminDb(); const ref = db.doc(`studios/${studioId}/incidents/${input.incidentId}`);
  return db.runTransaction(async (transaction) => { const incident = await transaction.get(ref); if (!incident.exists) throw new Error("INCIDENT_NOT_FOUND"); if (incident.data()?.status === "waived") return { idempotent: true }; if (incident.data()?.status !== "active") throw new Error("INCIDENT_NOT_ACTIVE"); const policyDoc = await transaction.get(db.doc(`studios/${studioId}/incidentPolicies/${policyId}`)); await reconcileReviewInTransaction(transaction, studioId, String(incident.data()?.customerUid), policyFrom(policyDoc.data()), principal.uid, ref.id); transaction.update(ref, { status: "waived", waivedAt: FieldValue.serverTimestamp(), waivedBy: principal.uid, waiverReason: input.reason, updatedAt: FieldValue.serverTimestamp() }); transaction.set(db.doc(`studios/${studioId}/auditEvents/incident-waived-${input.operationId}`), audit("incident.waived", principal.uid, ref.id, { reason: input.reason })); return { idempotent: false }; });
}

export async function reverseIncident(principal: Principal, raw: unknown) {
  const studioId = requireOwner(principal); const input = incidentReversalSchema.parse(raw); await assertActiveOwner(studioId, principal); const db = getAdminDb(); const ref = db.doc(`studios/${studioId}/incidents/${input.incidentId}`); const auditRef = db.doc(`studios/${studioId}/auditEvents/incident-reversed-${input.operationId}`);
  return db.runTransaction(async (transaction) => { const [incident, priorAudit] = await Promise.all([transaction.get(ref), transaction.get(auditRef)]); if (priorAudit.exists) return { idempotent: true }; if (!incident.exists) throw new Error("INCIDENT_NOT_FOUND"); if (incident.data()?.status === "reversed") return { idempotent: true }; if (incident.data()?.status !== "active") throw new Error("INCIDENT_NOT_ACTIVE");
    const data = incident.data()!; if (data.type !== "no-show") throw new Error("INCIDENT_NOT_REVERSIBLE"); const booking = await transaction.get(db.doc(`studios/${studioId}/bookings/${String(data.bookingId)}`)); if (!booking.exists || booking.data()?.status !== "attended") throw new Error("INCIDENT_SOURCE_NOT_CORRECTED");
    const policyDoc = await transaction.get(db.doc(`studios/${studioId}/incidentPolicies/${policyId}`)); await reconcileReviewInTransaction(transaction, studioId, String(data.customerUid), policyFrom(policyDoc.data()), principal.uid, ref.id); transaction.update(ref, { status: "reversed", reversedAt: FieldValue.serverTimestamp(), reversedBy: principal.uid, reversalReason: input.reason, reversalOperationId: input.operationId, updatedAt: FieldValue.serverTimestamp() }); transaction.set(auditRef, audit("incident.reversed", principal.uid, ref.id, { reason: input.reason })); return { idempotent: false };
  });
}

export async function acknowledgeIncidentReview(principal: Principal, raw: unknown) {
  const studioId = requireOwner(principal); const input = incidentReviewSchema.parse(raw); await assertActiveOwner(studioId, principal); const db = getAdminDb(); const ref = db.doc(`studios/${studioId}/incidents/${input.incidentId}`); const auditRef = db.doc(`studios/${studioId}/auditEvents/incident-reviewed-${input.operationId}`);
  return db.runTransaction(async (transaction) => { const [incident, priorAudit] = await Promise.all([transaction.get(ref), transaction.get(auditRef)]); if (priorAudit.exists) return { idempotent: true }; if (!incident.exists) throw new Error("INCIDENT_NOT_FOUND"); if (incident.data()?.reviewedAt) return { idempotent: true }; transaction.update(ref, { reviewedAt: FieldValue.serverTimestamp(), reviewedBy: principal.uid, reviewOperationId: input.operationId, updatedAt: FieldValue.serverTimestamp() }); transaction.set(auditRef, audit("incident.reviewed", principal.uid, ref.id)); return { idempotent: false }; });
}

export async function getIncidents(principal: Principal) {
  if (!principal.studioId || !(principal.roles.includes("owner") || principal.roles.includes("staff"))) throw new Error("FORBIDDEN_INCIDENT_ACCESS");
  const db = getAdminDb(); const studioId = principal.studioId; const [studio, member, incidents, policy] = await Promise.all([db.doc(`studios/${studioId}`).get(), db.doc(`studios/${studioId}/members/${principal.uid}`).get(), db.collection(`studios/${studioId}/incidents`).orderBy("sourceTimestamp", "desc").limit(50).get(), db.doc(`studios/${studioId}/incidentPolicies/${policyId}`).get()]);
  if (!studio.exists || studio.data()?.status !== "active") throw new Error("INACTIVE_STUDIO"); if (!member.exists || member.data()?.status !== "active") throw new Error("MEMBERSHIP_INACTIVE");
  const currentPolicy = policyFrom(policy.data()); const customerUids = [...new Set(incidents.docs.map((item) => String(item.data().customerUid)))]; const cutoff = Timestamp.fromDate(rollingWindowStart(new Date(), currentPolicy.rollingDays));
  const [names, currentCounts] = await Promise.all([
    Promise.all(incidents.docs.map((item) => db.doc(`studios/${studioId}/members/${String(item.data().customerUid)}`).get())),
    Promise.all(customerUids.map(async (uid) => {
      const active = await db.collection(`studios/${studioId}/incidents`).where("customerUid", "==", uid).where("status", "==", "active").where("sourceTimestamp", ">=", cutoff).limit(50).get();
      return { uid, count: active.size };
    })),
  ]);
  const counts = new Map(currentCounts.map((item) => [item.uid, item.count]));
  return { policy: currentPolicy, incidents: incidents.docs.map((item, index) => { const customerUid = String(item.data().customerUid); const activeCount = counts.get(customerUid) ?? 0; return { id: item.id, customerName: String(names[index]?.data()?.displayName ?? names[index]?.data()?.email ?? "Customer"), type: String(item.data().type), status: String(item.data().status), sourceTimestamp: item.data().sourceTimestamp?.toDate?.().toISOString() ?? new Date(0).toISOString(), reviewRequiredAtCreation: Boolean(item.data().reviewRequiredAtCreation), currentActiveIncidentCount: activeCount, currentReviewRequired: currentPolicy.status === "active" && reviewRequiredFor(activeCount, currentPolicy.threshold), reviewed: Boolean(item.data().reviewedAt) }; }) };
}
