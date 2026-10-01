import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { Principal } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { subscriptionUsableCredits } from "@/lib/entitlements";
import { waitlistEntryId } from "@/lib/waitlist-logic";
import { bookingPaths, hasActiveBooking, reservationBalance } from "@/lib/booking-logic";
import { waitlistJoinSchema, waitlistRemovalSchema, waitlistWithdrawalSchema } from "@/lib/validation";

function date(value: unknown) { return value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function" ? value.toDate() as Date : null; }
function audit(action: string, actorUid: string, targetId: string, detail: Record<string, unknown> = {}) { return { action, actorUid, targetId, result: "success", createdAt: FieldValue.serverTimestamp(), ...detail }; }
function customerStudio(principal: Principal) { if (!principal.studioId || !principal.roles.includes("customer")) throw new Error("FORBIDDEN_CUSTOMER"); return principal.studioId; }
async function assertCustomer(studioId: string, uid: string, transaction: FirebaseFirestore.Transaction) { const db = getAdminDb(); const [studio, member] = await Promise.all([transaction.get(db.doc(`studios/${studioId}`)), transaction.get(db.doc(`studios/${studioId}/members/${uid}`))]); if (!studio.exists || studio.data()?.status !== "active") throw new Error("INACTIVE_STUDIO"); if (!member.exists || member.data()?.status !== "active" || !Array.isArray(member.data()?.roles) || !member.data()?.roles.includes("customer")) throw new Error("FORBIDDEN_CUSTOMER"); return member; }

export async function joinWaitlist(principal: Principal, raw: unknown) { const studioId = customerStudio(principal); const input = waitlistJoinSchema.parse(raw); const db = getAdminDb(); const ref = db.doc(`studios/${studioId}/waitlists/${waitlistEntryId(input.slotId, principal.uid)}`); return db.runTransaction(async (tx) => { const [member, slot, entry] = await Promise.all([assertCustomer(studioId, principal.uid, tx), tx.get(db.doc(`studios/${studioId}/slots/${input.slotId}`)), tx.get(ref)]); if (entry.exists && entry.data()?.status === "active") return { id: ref.id, idempotent: true }; const data = slot.data(); const startsAt = date(data?.startsAt); const subscriptionId = member.data()?.activeSubscriptionId; const subscription = subscriptionId ? await tx.get(db.doc(`studios/${studioId}/subscriptions/${subscriptionId}`)) : null; const endsAt = date(subscription?.data()?.endsAt); const credits = endsAt ? subscriptionUsableCredits({ status: String(subscription?.data()?.status), endsAt, availableCredits: Number(subscription?.data()?.availableCredits ?? 0) }) : 0; if (!slot.exists || data?.status !== "published" || !startsAt || startsAt <= new Date() || Number(data?.confirmedBookingCount ?? 0) < Number(data?.capacity ?? 0) || credits < 1) throw new Error("WAITLIST_INELIGIBLE"); tx.set(ref, { slotId: input.slotId, customerUid: principal.uid, status: "active", operationId: input.operationId, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }); tx.set(db.doc(`studios/${studioId}/auditEvents/waitlist-joined-${input.operationId}`), audit("waitlist.joined", principal.uid, ref.id, { after: { slotId: input.slotId } })); return { id: ref.id, idempotent: false }; }); }
export async function withdrawWaitlist(principal: Principal, raw: unknown) { const studioId = customerStudio(principal); const input = waitlistWithdrawalSchema.parse(raw); const db = getAdminDb(); const ref = db.doc(`studios/${studioId}/waitlists/${waitlistEntryId(input.slotId, principal.uid)}`); return db.runTransaction(async (tx) => { const [member, entry, slot] = await Promise.all([assertCustomer(studioId, principal.uid, tx), tx.get(ref), tx.get(db.doc(`studios/${studioId}/slots/${input.slotId}`))]); void member; if (!entry.exists || entry.data()?.customerUid !== principal.uid) throw new Error("WAITLIST_NOT_FOUND"); if (entry.data()?.status === "withdrawn") return { idempotent: true }; if (entry.data()?.status !== "active" || !date(slot.data()?.startsAt) || date(slot.data()?.startsAt)! <= new Date()) throw new Error("WAITLIST_CLOSED"); tx.update(ref, { status: "withdrawn", terminalAt: FieldValue.serverTimestamp(), terminalReason: "customer_withdrew", updatedAt: FieldValue.serverTimestamp() }); tx.set(db.doc(`studios/${studioId}/auditEvents/waitlist-withdrawn-${input.operationId}`), audit("waitlist.withdrawn", principal.uid, ref.id)); return { idempotent: false }; }); }
export async function removeWaitlistEntry(principal: Principal, raw: unknown) { if (!principal.studioId || !(principal.roles.includes("staff") || principal.roles.includes("owner"))) throw new Error("FORBIDDEN_WAITLIST"); const studioId = principal.studioId; const input = waitlistRemovalSchema.parse(raw); const db = getAdminDb(); const ref = db.doc(`studios/${studioId}/waitlists/${input.entryId}`); return db.runTransaction(async (tx) => { const [studio, member, entry] = await Promise.all([tx.get(db.doc(`studios/${studioId}`)), tx.get(db.doc(`studios/${studioId}/members/${principal.uid}`)), tx.get(ref)]); if (!studio.exists || studio.data()?.status !== "active") throw new Error("INACTIVE_STUDIO"); if (!member.exists || member.data()?.status !== "active") throw new Error("MEMBERSHIP_INACTIVE"); if (!entry.exists) throw new Error("WAITLIST_NOT_FOUND"); if (entry.data()?.status !== "active") return { idempotent: true }; tx.update(ref, { status: "withdrawn", terminalAt: FieldValue.serverTimestamp(), terminalReason: input.reason, removedBy: principal.uid, updatedAt: FieldValue.serverTimestamp() }); tx.set(db.doc(`studios/${studioId}/auditEvents/waitlist-removed-${input.operationId}`), audit("waitlist.removed", principal.uid, ref.id, { reason: input.reason })); return { idempotent: false }; }); }
export async function getCustomerWaitlist(principal: Principal, slotId: string) { const studioId = customerStudio(principal); const db = getAdminDb(); const id = waitlistEntryId(slotId, principal.uid); let entry = await db.doc(`studios/${studioId}/waitlists/${id}`).get(); if (!entry.exists) return null; const slot = await db.doc(`studios/${studioId}/slots/${slotId}`).get(); if (entry.data()?.status === "active" && date(slot.data()?.startsAt) && date(slot.data()?.startsAt)! <= new Date()) { await promoteOneWaitlistEntry(studioId, slotId, principal.uid); entry = await db.doc(`studios/${studioId}/waitlists/${id}`).get(); }
  const data = entry.data()!; if (data.status !== "active") return { status: String(data.status), position: 0, bookingId: typeof data.bookingId === "string" ? data.bookingId : undefined }; const queue = await db.collection(`studios/${studioId}/waitlists`).where("slotId", "==", slotId).where("status", "==", "active").orderBy("createdAt", "asc").limit(100).get(); return { status: "active", position: queue.docs.findIndex((item) => item.id === id) + 1 }; }

/**
 * Promotes at most one entry.  It is safe to invoke after every seat-opening
 * operation: the whole promotion (booking, reservation, count and history)
 * is one Firestore transaction and a deterministic entry-derived operation id
 * makes transaction retries harmless.
 */
export async function promoteOneWaitlistEntry(studioId: string, slotId: string, actorUid: string) {
  const db = getAdminDb();
  return db.runTransaction(async (tx) => {
    const slotRef = db.doc(`studios/${studioId}/slots/${slotId}`);
    const queueQuery = db.collection(`studios/${studioId}/waitlists`).where("slotId", "==", slotId).where("status", "==", "active").orderBy("createdAt", "asc").limit(100);
    const [studio, slot, queue] = await Promise.all([tx.get(db.doc(`studios/${studioId}`)), tx.get(slotRef), tx.get(queueQuery)]);
    const slotData = slot.data(); const startsAt = date(slotData?.startsAt);
    if (!studio.exists || studio.data()?.status !== "active" || !slot.exists || slotData?.status !== "published" || !startsAt) return { promoted: false, closed: false };
    if (startsAt <= new Date()) {
      for (const entry of queue.docs) {
        tx.update(entry.ref, { status: "expired-at-class-start", terminalAt: FieldValue.serverTimestamp(), terminalReason: "class_started", updatedAt: FieldValue.serverTimestamp() });
        tx.set(db.doc(`studios/${studioId}/auditEvents/waitlist-expired-${entry.id}`), audit("waitlist.expired_at_class_start", actorUid, entry.id));
      }
      return { promoted: false, closed: true };
    }
    if (Number(slotData.confirmedBookingCount ?? 0) >= Number(slotData.capacity ?? 0) || queue.empty) return { promoted: false, closed: false };

    // All reads happen before the first write, as required by Firestore transactions.
    const contexts = await Promise.all(queue.docs.map(async (entry) => {
      const customerUid = String(entry.data().customerUid ?? "");
      const member = customerUid ? await tx.get(db.doc(`studios/${studioId}/members/${customerUid}`)) : null;
      const subscriptionId = member?.data()?.activeSubscriptionId as string | undefined;
      const subscription = subscriptionId ? await tx.get(db.doc(`studios/${studioId}/subscriptions/${subscriptionId}`)) : null;
      const bookings = customerUid ? await tx.get(db.collection(`studios/${studioId}/bookings`).where("customerUid", "==", customerUid).where("slotId", "==", slotId)) : null;
      return { entry, customerUid, member, subscription, subscriptionId, bookings };
    }));
    let selected: (typeof contexts)[number] | null = null;
    const ineligible: Array<{ entry: FirebaseFirestore.QueryDocumentSnapshot; reason: string }> = [];
    for (const context of contexts) {
      const memberData = context.member?.data(); const subscriptionData = context.subscription?.data(); const endsAt = date(subscriptionData?.endsAt);
      const usable = endsAt ? subscriptionUsableCredits({ status: String(subscriptionData?.status), endsAt, availableCredits: Number(subscriptionData?.availableCredits ?? 0) }) : 0;
      const reason = !context.member?.exists || memberData?.status !== "active" || !Array.isArray(memberData.roles) || !memberData.roles.includes("customer") ? "inactive_membership" : !context.subscription?.exists || subscriptionData?.status !== "active" || !endsAt || endsAt <= new Date() ? "inactive_subscription" : usable < 1 ? "insufficient_credit" : hasActiveBooking(context.bookings?.docs.map((doc) => String(doc.data().status ?? "")) ?? []) ? "existing_booking" : null;
      if (reason) { ineligible.push({ entry: context.entry, reason }); continue; }
      selected = context; break;
    }
    for (const item of ineligible) {
      tx.update(item.entry.ref, { status: "ineligible", terminalAt: FieldValue.serverTimestamp(), terminalReason: item.reason, updatedAt: FieldValue.serverTimestamp() });
      tx.set(db.doc(`studios/${studioId}/auditEvents/waitlist-ineligible-${item.entry.id}`), audit("waitlist.ineligible", actorUid, item.entry.id, { reason: item.reason }));
    }
    if (!selected || !selected.subscription || !selected.subscriptionId) return { promoted: false, closed: false };
    const operationId = `waitlist-promotion-${selected.entry.id}`;
    const paths = bookingPaths(studioId, slotId, selected.customerUid, operationId);
    const bookingRef = db.doc(paths.booking); const subscriptionRef = db.doc(`studios/${studioId}/subscriptions/${selected.subscriptionId}`); const reservationRef = subscriptionRef.collection("ledger").doc(`reservation-${operationId}`);
    const availableCredits = Number(selected.subscription.data()?.availableCredits ?? 0); const reservedCredits = Number(selected.subscription.data()?.reservedCredits ?? 0); const balanceAfter = reservationBalance(availableCredits);
    tx.update(slotRef, { confirmedBookingCount: Number(slotData.confirmedBookingCount ?? 0) + 1, updatedAt: FieldValue.serverTimestamp() });
    tx.update(subscriptionRef, { availableCredits: balanceAfter, reservedCredits: reservedCredits + 1, updatedAt: FieldValue.serverTimestamp(), updatedBy: actorUid });
    tx.update(selected.entry.ref, { status: "promoted", bookingId: bookingRef.id, promotedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    tx.set(bookingRef, { slotId, customerUid: selected.customerUid, subscriptionId: subscriptionRef.id, reservationLedgerId: reservationRef.id, operationId, status: "confirmed", className: String(slotData.className ?? "Class"), trainerName: String(slotData.trainerName ?? "Trainer"), localDate: String(slotData.localDate ?? ""), startTime: String(slotData.startTime ?? ""), endTime: String(slotData.endTime ?? ""), timezone: String(slotData.timezone ?? ""), slotStartsAt: slotData.startsAt, slotEndsAt: slotData.endsAt, createdAt: FieldValue.serverTimestamp(), confirmedAt: FieldValue.serverTimestamp() });
    tx.set(reservationRef, { action: "reservation", amount: -1, balanceBefore: availableCredits, balanceAfter, reservedCreditsAfter: reservedCredits + 1, actorUid, referenceId: bookingRef.id, slotId, createdAt: FieldValue.serverTimestamp() });
    tx.set(db.doc(`studios/${studioId}/auditEvents/waitlist-promoted-${selected.entry.id}`), audit("waitlist.promoted", actorUid, selected.entry.id, { after: { bookingId: bookingRef.id, slotId } }));
    tx.set(db.doc(`studios/${studioId}/auditEvents/booking-promoted-${selected.entry.id}`), audit("booking.confirmed", actorUid, bookingRef.id, { after: { slotId, subscriptionId: subscriptionRef.id } }));
    tx.set(db.doc(`studios/${studioId}/auditEvents/credit-reserved-promoted-${selected.entry.id}`), audit("credit.reserved", actorUid, subscriptionRef.id, { after: { bookingId: bookingRef.id, amount: -1, balanceAfter } }));
    return { promoted: true, bookingId: bookingRef.id, closed: false };
  });
}

export async function promoteWaitlistUntilFull(studioId: string, slotId: string, actorUid: string) {
  // A bounded loop supports capacity increases while retaining one atomic promotion per seat.
  for (let attempt = 0; attempt < 100; attempt += 1) { const result = await promoteOneWaitlistEntry(studioId, slotId, actorUid); if (!result.promoted) return result; }
  return { promoted: false, closed: false };
}
