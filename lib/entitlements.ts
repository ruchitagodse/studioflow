import "server-only";

import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { Principal } from "@/lib/auth/server";
import { adjustedBalance, canAssignSubscription, usableCredits } from "@/lib/entitlement-logic";
import { addCalendarDays, addCalendarMonths, calendarDayDifference, effectiveExpiry, pauseAllowanceDays } from "@/lib/subscription-lifecycle-logic";
import { getAdminDb } from "@/lib/firebase/admin";
import { creditAdjustmentSchema, planInputSchema, planUpdateSchema, subscriptionAssignmentSchema, subscriptionCancellationSchema, subscriptionPauseSchema, subscriptionRenewalSchema, subscriptionResumeSchema } from "@/lib/validation";
import { promoteOneWaitlistEntry } from "@/lib/waitlist";

function requireEntitlementAuthority(principal: Principal) {
  if (!principal.studioId || !principal.roles.some((role) => role === "owner" || role === "staff")) throw new Error("FORBIDDEN_ENTITLEMENTS");
  return principal.studioId;
}
function requirePauseAuthority(principal: Principal) {
  if (!principal.studioId || (!principal.roles.includes("customer") && !principal.roles.some((role) => role === "owner" || role === "staff"))) throw new Error("FORBIDDEN_PAUSE");
  return principal.studioId;
}
function audit(action: string, actorUid: string, targetId: string, detail: Record<string, unknown> = {}) { return { action, actorUid, targetId, createdAt: FieldValue.serverTimestamp(), result: "success", ...detail }; }
function hasCustomerRole(data: Record<string, unknown> | undefined) { return Array.isArray(data?.roles) && data.roles.includes("customer"); }
function asDate(value: unknown) { return value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function" ? value.toDate() as Date : null; }
function fixedDayEndDate(start: Date, validityDays: number) { return new Date(start.getTime() + validityDays * 24 * 60 * 60 * 1000); }
function subscriptionEnd(data: FirebaseFirestore.DocumentData) { return asDate(data.effectiveEndsAt) ?? asDate(data.endsAt); }

async function expireSubscriptionInTransaction(studioId: string, subscriptionId: string, subscription: FirebaseFirestore.DocumentData, transaction: FirebaseFirestore.Transaction) {
  const db = getAdminDb(); const subscriptionRef = db.doc(`studios/${studioId}/subscriptions/${subscriptionId}`); const now = new Date();
  let status = String(subscription.status ?? "inactive"); let pauseEnded = false; const pauseEndsAt = asDate(subscription.pauseEndsAt);
  if (status === "paused" && pauseEndsAt && pauseEndsAt.getTime() <= now.getTime()) {
    status = "active";
    pauseEnded = true;
    transaction.update(subscriptionRef, { status: "active", pauseEndedAt: FieldValue.serverTimestamp(), pauseEndsAt: FieldValue.delete(), pauseStartedAt: FieldValue.delete(), currentPauseDays: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
    transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit("subscription.pause_ended", "system", subscriptionId));
  }
  const endsAt = subscriptionEnd(subscription);
  if (status !== "active" || !endsAt || endsAt.getTime() > now.getTime()) return pauseEnded;
  const availableCredits = Number(subscription.availableCredits ?? 0); const reason = subscription.endOfTermCancellationRequestedAt ? "cancelled_end_of_term" : "expired";
  transaction.update(subscriptionRef, { status: "inactive", inactiveReason: reason, expiredAt: FieldValue.serverTimestamp(), availableCredits: 0, updatedAt: FieldValue.serverTimestamp() });
  transaction.update(db.doc(`studios/${studioId}/members/${String(subscription.customerUid)}`), { activeSubscriptionId: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
  if (availableCredits > 0) {
    transaction.set(subscriptionRef.collection("ledger").doc(`expiry-${subscriptionId}`), { action: "expiry", amount: -availableCredits, balanceBefore: availableCredits, balanceAfter: 0, reason: "Subscription reached its effective expiry.", actorUid: "system", createdAt: FieldValue.serverTimestamp() });
    transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit("credit.expired", "system", subscriptionId, { after: { amount: availableCredits } }));
  }
  transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit(reason === "expired" ? "subscription.expired" : "subscription.cancelled", "system", subscriptionId));
  return true;
}

export async function expireSubscriptionIfDue(studioId: string, subscriptionId: string) {
  const db = getAdminDb(); const subscriptionRef = db.doc(`studios/${studioId}/subscriptions/${subscriptionId}`); let expired = false;
  await db.runTransaction(async (transaction) => { const subscription = await transaction.get(subscriptionRef); if (!subscription.exists) return; expired = await expireSubscriptionInTransaction(studioId, subscription.id, subscription.data()!, transaction); });
  return expired;
}

export async function createPlan(principal: Principal, raw: unknown) {
  const studioId = requireEntitlementAuthority(principal); const input = planInputSchema.parse(raw); const db = getAdminDb(); const planRef = db.doc(`studios/${studioId}/plans/${input.operationId}`);
  await db.runTransaction(async (transaction) => {
    if ((await transaction.get(planRef)).exists) return;
    transaction.set(planRef, { name: input.name, description: input.description ?? "", pricePaise: input.pricePaise, creditAllocation: input.creditAllocation, validityDays: input.validityDays ?? null, durationMonths: input.durationMonths ?? null, status: input.status, createdAt: FieldValue.serverTimestamp(), createdBy: principal.uid, updatedAt: FieldValue.serverTimestamp(), updatedBy: principal.uid });
    transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit("plan.created", principal.uid, planRef.id));
    if (input.status === "active") transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit("plan.activated", principal.uid, planRef.id));
  });
  return planRef.id;
}

export async function updatePlan(principal: Principal, raw: unknown) {
  const studioId = requireEntitlementAuthority(principal); const input = planUpdateSchema.parse(raw); const db = getAdminDb(); const planRef = db.doc(`studios/${studioId}/plans/${input.planId}`);
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(planRef); if (!current.exists) throw new Error("PLAN_NOT_FOUND"); if (current.data()?.status === "retired") throw new Error("PLAN_RETIRED"); const before = current.data();
    transaction.update(planRef, { name: input.name, description: input.description ?? "", pricePaise: input.pricePaise, creditAllocation: input.creditAllocation, validityDays: input.validityDays ?? null, durationMonths: input.durationMonths ?? null, status: input.status, updatedAt: FieldValue.serverTimestamp(), updatedBy: principal.uid });
    transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit("plan.updated", principal.uid, planRef.id, { before: { status: before?.status }, after: { status: input.status } }));
    if (before?.status !== "active" && input.status === "active") transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit("plan.activated", principal.uid, planRef.id));
  });
}

export async function retirePlan(principal: Principal, planId: string) {
  const studioId = requireEntitlementAuthority(principal); if (!planId) throw new Error("PLAN_NOT_FOUND"); const db = getAdminDb(); const planRef = db.doc(`studios/${studioId}/plans/${planId}`);
  await db.runTransaction(async (transaction) => { const current = await transaction.get(planRef); if (!current.exists) throw new Error("PLAN_NOT_FOUND"); if (current.data()?.status === "retired") return; transaction.update(planRef, { status: "retired", retiredAt: FieldValue.serverTimestamp(), retiredBy: principal.uid, updatedAt: FieldValue.serverTimestamp(), updatedBy: principal.uid }); transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit("plan.retired", principal.uid, planId)); });
}

async function provisionSubscription(principal: Principal, raw: unknown, renewal: boolean) {
  const studioId = requireEntitlementAuthority(principal); const input = (renewal ? subscriptionRenewalSchema : subscriptionAssignmentSchema).parse(raw); const db = getAdminDb(); const subscriptionRef = db.doc(`studios/${studioId}/subscriptions/${input.operationId}`); const customerRef = db.doc(`studios/${studioId}/members/${input.customerUid}`);
  await db.runTransaction(async (transaction) => {
    if ((await transaction.get(subscriptionRef)).exists) return;
    const [studio, plan, customer, activeSubscriptions] = await Promise.all([
      transaction.get(db.doc(`studios/${studioId}`)), transaction.get(db.doc(`studios/${studioId}/plans/${input.planId}`)), transaction.get(customerRef),
      transaction.get(db.collection(`studios/${studioId}/subscriptions`).where("customerUid", "==", input.customerUid).where("status", "in", ["active", "paused"]).limit(1)),
    ]);
    if (!studio.exists || studio.data()?.status !== "active") throw new Error("INACTIVE_STUDIO"); if (!plan.exists || plan.data()?.status !== "active") throw new Error("PLAN_UNAVAILABLE"); if (!customer.exists || customer.data()?.status !== "active" || !hasCustomerRole(customer.data())) throw new Error("CUSTOMER_NOT_ELIGIBLE");
    const existing = activeSubscriptions.docs[0]; if (existing) { const expired = await expireSubscriptionInTransaction(studioId, existing.id, existing.data(), transaction); if (!expired) throw new Error("ACTIVE_SUBSCRIPTION_EXISTS"); }
    if (!canAssignSubscription(existing && existing.data().status !== "inactive" ? 1 : 0)) throw new Error("ACTIVE_SUBSCRIPTION_EXISTS");
    const planData = plan.data()!; const startsAt = new Date(); const durationMonths = Number(planData.durationMonths ?? 0) || undefined; const validityDays = Number(planData.validityDays ?? 0) || undefined;
    if (Boolean(durationMonths) === Boolean(validityDays)) throw new Error("PLAN_DURATION_INVALID"); const timezone = String(studio.data()?.timezone ?? "UTC"); const endsAt = durationMonths ? addCalendarMonths(startsAt, durationMonths, timezone) : fixedDayEndDate(startsAt, validityDays!);
    const historicalTerms = { planId: plan.id, planName: String(planData.name), planDescription: String(planData.description ?? ""), pricePaise: Number(planData.pricePaise), creditAllocation: Number(planData.creditAllocation), validityDays: validityDays ?? null, durationMonths: durationMonths ?? null };
    transaction.set(subscriptionRef, { customerUid: input.customerUid, status: "active", startsAt: Timestamp.fromDate(startsAt), endsAt: Timestamp.fromDate(endsAt), effectiveEndsAt: Timestamp.fromDate(endsAt), availableCredits: historicalTerms.creditAllocation, reservedCredits: 0, pauseDaysUsed: 0, historicalTerms, createdAt: FieldValue.serverTimestamp(), createdBy: principal.uid, updatedAt: FieldValue.serverTimestamp(), updatedBy: principal.uid });
    transaction.update(customerRef, { activeSubscriptionId: subscriptionRef.id, latestSubscriptionId: subscriptionRef.id, updatedAt: FieldValue.serverTimestamp() });
    transaction.set(subscriptionRef.collection("ledger").doc(`allocation-${input.operationId}`), { action: "allocation", amount: historicalTerms.creditAllocation, balanceBefore: 0, balanceAfter: historicalTerms.creditAllocation, actorUid: principal.uid, createdAt: FieldValue.serverTimestamp(), referenceId: subscriptionRef.id });
    transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit(renewal ? "subscription.renewed" : "subscription.created", principal.uid, subscriptionRef.id, { after: historicalTerms }));
    transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit("subscription.activated", principal.uid, subscriptionRef.id)); transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit("credit.issued", principal.uid, subscriptionRef.id, { after: { amount: historicalTerms.creditAllocation } }));
  });
  return subscriptionRef.id;
}

export function assignSubscription(principal: Principal, raw: unknown) { return provisionSubscription(principal, raw, false); }
export function renewSubscription(principal: Principal, raw: unknown) { return provisionSubscription(principal, raw, true); }

export async function cancelSubscription(principal: Principal, raw: unknown) {
  const studioId = requireEntitlementAuthority(principal); const input = subscriptionCancellationSchema.parse(raw); const db = getAdminDb(); const subscriptionRef = db.doc(`studios/${studioId}/subscriptions/${input.subscriptionId}`); const openedSlotIds = new Set<string>();
  await db.runTransaction(async (transaction) => {
    const [studio, subscription] = await Promise.all([transaction.get(db.doc(`studios/${studioId}`)), transaction.get(subscriptionRef)]); if (!studio.exists || studio.data()?.status !== "active") throw new Error("INACTIVE_STUDIO"); if (!subscription.exists) throw new Error("SUBSCRIPTION_NOT_FOUND"); const data = subscription.data()!;
    if (data.status === "inactive" && data.cancellationOperationId === input.operationId) return;
    if (input.mode === "end_of_term") {
      if (data.endOfTermCancellationOperationId === input.operationId) return; if (data.status !== "active" && data.status !== "paused") throw new Error("SUBSCRIPTION_INACTIVE");
      transaction.update(subscriptionRef, { endOfTermCancellationRequestedAt: FieldValue.serverTimestamp(), endOfTermCancellationOperationId: input.operationId, endOfTermCancellationReason: input.reason ?? "", updatedAt: FieldValue.serverTimestamp(), updatedBy: principal.uid }); transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit("subscription.cancellation_requested", principal.uid, subscriptionRef.id, { reason: input.reason ?? "" })); return;
    }
    if (data.status !== "active" && data.status !== "paused") throw new Error("SUBSCRIPTION_INACTIVE");
    const futureBookings = await transaction.get(db.collection(`studios/${studioId}/bookings`).where("subscriptionId", "==", subscriptionRef.id).where("status", "==", "confirmed").where("slotStartsAt", ">", Timestamp.fromDate(new Date())));
    let availableCredits = Number(data.availableCredits ?? 0); let reservedCredits = Number(data.reservedCredits ?? 0);
    for (const booking of futureBookings.docs) {
      const bookingData = booking.data(); const slotId = String(bookingData.slotId ?? ""); const reservationId = String(bookingData.reservationLedgerId ?? ""); if (!slotId || !reservationId) throw new Error("BOOKING_INVALID"); const slotRef = db.doc(`studios/${studioId}/slots/${slotId}`); const reservationRef = subscriptionRef.collection("ledger").doc(reservationId); const [slot, reservation] = await Promise.all([transaction.get(slotRef), transaction.get(reservationRef)]); if (!slot.exists || !reservation.exists || reservation.data()?.action !== "reservation" || reservedCredits < 1) throw new Error("BOOKING_INVALID"); const count = Number(slot.data()?.confirmedBookingCount ?? 0); if (count < 1) throw new Error("BOOKING_INVALID"); const before = availableCredits; availableCredits += 1; reservedCredits -= 1;
      transaction.update(slotRef, { confirmedBookingCount: count - 1, updatedAt: FieldValue.serverTimestamp() }); transaction.update(booking.ref, { status: "voided", voidReason: "subscription_cancelled", cancelledAt: FieldValue.serverTimestamp(), cancellationOperationId: input.operationId, updatedAt: FieldValue.serverTimestamp() });
      transaction.set(subscriptionRef.collection("ledger").doc(`release-cancellation-${input.operationId}-${booking.id}`), { action: "release", amount: 1, balanceBefore: before, balanceAfter: availableCredits, reservedCreditsBefore: reservedCredits + 1, reservedCreditsAfter: reservedCredits, actorUid: principal.uid, referenceId: booking.id, slotId, reason: input.reason, createdAt: FieldValue.serverTimestamp() });
      transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit("booking.cancelled_subscription", principal.uid, booking.id, { reason: input.reason, after: { slotId } })); transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit("credit.released", principal.uid, subscriptionRef.id, { after: { bookingId: booking.id } })); openedSlotIds.add(slotId);
    }
    if (availableCredits > 0) { transaction.set(subscriptionRef.collection("ledger").doc(`expiry-cancellation-${input.operationId}`), { action: "expiry", amount: -availableCredits, balanceBefore: availableCredits, balanceAfter: 0, reason: "Subscription cancelled immediately.", actorUid: principal.uid, createdAt: FieldValue.serverTimestamp(), referenceId: subscriptionRef.id }); transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit("credit.expired", principal.uid, subscriptionRef.id, { after: { amount: availableCredits } })); }
    transaction.update(subscriptionRef, { status: "inactive", inactiveReason: "cancelled_immediate", availableCredits: 0, reservedCredits, cancelledAt: FieldValue.serverTimestamp(), cancelledBy: principal.uid, cancellationOperationId: input.operationId, cancellationReason: input.reason, updatedAt: FieldValue.serverTimestamp(), updatedBy: principal.uid, pauseEndsAt: FieldValue.delete() }); transaction.update(db.doc(`studios/${studioId}/members/${String(data.customerUid)}`), { activeSubscriptionId: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }); transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit("subscription.cancelled", principal.uid, subscriptionRef.id, { reason: input.reason, after: { futureBookingsCancelled: futureBookings.size } }));
  });
  await Promise.all([...openedSlotIds].map((slotId) => promoteOneWaitlistEntry(studioId, slotId, principal.uid)));
}

export async function pauseSubscription(principal: Principal, raw: unknown) {
  const studioId = requirePauseAuthority(principal); const input = subscriptionPauseSchema.parse(raw); const db = getAdminDb(); const subscriptionRef = db.doc(`studios/${studioId}/subscriptions/${input.subscriptionId}`); await expireSubscriptionIfDue(studioId, input.subscriptionId);
  await db.runTransaction(async (transaction) => {
    const [studio, subscription] = await Promise.all([transaction.get(db.doc(`studios/${studioId}`)), transaction.get(subscriptionRef)]); if (!studio.exists || studio.data()?.status !== "active") throw new Error("INACTIVE_STUDIO"); if (!subscription.exists) throw new Error("SUBSCRIPTION_NOT_FOUND"); const data = subscription.data()!; const customer = await transaction.get(db.doc(`studios/${studioId}/members/${String(data.customerUid)}`)); if (!customer.exists || customer.data()?.status !== "active" || !hasCustomerRole(customer.data())) throw new Error("CUSTOMER_NOT_ELIGIBLE"); const isOperator = principal.roles.some((role) => role === "owner" || role === "staff"); if (!isOperator && String(data.customerUid) !== principal.uid) throw new Error("FORBIDDEN_PAUSE"); if (data.status === "paused" && data.pauseOperationId === input.operationId) return; if (data.status !== "active") throw new Error("SUBSCRIPTION_INACTIVE");
    const durationMonths = Number(data.historicalTerms?.durationMonths ?? data.durationMonths ?? 0) || undefined; const allowance = pauseAllowanceDays(durationMonths); if (allowance === 0) throw new Error("PAUSE_NOT_ELIGIBLE"); const used = Number(data.pauseDaysUsed ?? 0); if (used + input.pauseDays > allowance) throw new Error("PAUSE_ALLOWANCE_EXCEEDED"); const timezone = String(studio.data()?.timezone ?? "UTC"); const now = new Date(); const historicalEndsAt = asDate(data.endsAt); if (!historicalEndsAt) throw new Error("SUBSCRIPTION_INVALID"); const pauseEndsAt = addCalendarDays(now, input.pauseDays, timezone); const effectiveEndsAt = effectiveExpiry(historicalEndsAt, used + input.pauseDays, timezone);
    transaction.update(subscriptionRef, { status: "paused", pauseDaysUsed: used + input.pauseDays, pauseStartedAt: Timestamp.fromDate(now), pauseEndsAt: Timestamp.fromDate(pauseEndsAt), currentPauseDays: input.pauseDays, effectiveEndsAt: Timestamp.fromDate(effectiveEndsAt), pauseOperationId: input.operationId, pausePeriods: FieldValue.arrayUnion({ startsAt: Timestamp.fromDate(now), endsAt: Timestamp.fromDate(pauseEndsAt), days: input.pauseDays, actorUid: principal.uid }), updatedAt: FieldValue.serverTimestamp(), updatedBy: principal.uid }); transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit("subscription.pause_started", principal.uid, subscriptionRef.id, { after: { pauseDays: input.pauseDays, usedDays: used + input.pauseDays, allowance } }));
  });
}

export async function resumeSubscription(principal: Principal, raw: unknown) {
  const studioId = requirePauseAuthority(principal); const input = subscriptionResumeSchema.parse(raw); const db = getAdminDb(); const subscriptionRef = db.doc(`studios/${studioId}/subscriptions/${input.subscriptionId}`);
  await db.runTransaction(async (transaction) => {
    const [studio, subscription] = await Promise.all([transaction.get(db.doc(`studios/${studioId}`)), transaction.get(subscriptionRef)]); if (!studio.exists || studio.data()?.status !== "active") throw new Error("INACTIVE_STUDIO"); if (!subscription.exists) throw new Error("SUBSCRIPTION_NOT_FOUND"); const data = subscription.data()!; const customer = await transaction.get(db.doc(`studios/${studioId}/members/${String(data.customerUid)}`)); if (!customer.exists || customer.data()?.status !== "active" || !hasCustomerRole(customer.data())) throw new Error("CUSTOMER_NOT_ELIGIBLE"); const isOperator = principal.roles.some((role) => role === "owner" || role === "staff"); if (!isOperator && String(data.customerUid) !== principal.uid) throw new Error("FORBIDDEN_PAUSE"); if (data.status === "active" && data.resumeOperationId === input.operationId) return; if (data.status !== "paused") throw new Error("SUBSCRIPTION_NOT_PAUSED");
    const timezone = String(studio.data()?.timezone ?? "UTC"); const now = new Date(); const pausePeriods = Array.isArray(data.pausePeriods) ? data.pausePeriods : []; const lastPausePeriod = pausePeriods[pausePeriods.length - 1] as Record<string, unknown> | undefined; const scheduledDays = Number(data.currentPauseDays ?? lastPausePeriod?.days ?? 0); const pauseStartedAt = asDate(data.pauseStartedAt) ?? asDate(lastPausePeriod?.startsAt); if (!pauseStartedAt || scheduledDays < 1) throw new Error("SUBSCRIPTION_INVALID"); const actualDays = Math.min(scheduledDays, calendarDayDifference(pauseStartedAt, now, timezone)); const totalUsed = Number(data.pauseDaysUsed ?? 0); const usedDays = Math.max(0, totalUsed - scheduledDays + actualDays); const historicalEndsAt = asDate(data.endsAt); if (!historicalEndsAt) throw new Error("SUBSCRIPTION_INVALID"); const effectiveEndsAt = effectiveExpiry(historicalEndsAt, usedDays, timezone);
    transaction.update(subscriptionRef, { status: "active", pauseDaysUsed: usedDays, effectiveEndsAt: Timestamp.fromDate(effectiveEndsAt), pauseResumedAt: Timestamp.fromDate(now), resumeOperationId: input.operationId, pauseEndsAt: FieldValue.delete(), pauseStartedAt: FieldValue.delete(), currentPauseDays: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp(), updatedBy: principal.uid }); transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit("subscription.resumed", principal.uid, subscriptionRef.id, { after: { pauseDays: actualDays, usedDays } }));
  });
}

export async function adjustCredits(principal: Principal, raw: unknown) {
  const studioId = requireEntitlementAuthority(principal); const input = creditAdjustmentSchema.parse(raw); const db = getAdminDb(); const subscriptionRef = db.doc(`studios/${studioId}/subscriptions/${input.subscriptionId}`);
  await db.runTransaction(async (transaction) => { const subscription = await transaction.get(subscriptionRef); if (!subscription.exists) throw new Error("SUBSCRIPTION_NOT_FOUND"); const data = subscription.data()!; const ledgerRef = subscriptionRef.collection("ledger").doc(`adjustment-${input.operationId}`); if ((await transaction.get(ledgerRef)).exists) return; const balanceBefore = Number(data.availableCredits ?? 0); const balanceAfter = adjustedBalance(balanceBefore, input.amount); transaction.update(subscriptionRef, { availableCredits: balanceAfter, updatedAt: FieldValue.serverTimestamp(), updatedBy: principal.uid }); transaction.set(ledgerRef, { action: "manual_adjustment", amount: input.amount, balanceBefore, balanceAfter, reason: input.reason, actorUid: principal.uid, createdAt: FieldValue.serverTimestamp(), referenceId: subscriptionRef.id }); transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), audit("credit.adjusted", principal.uid, subscriptionRef.id, { reason: input.reason, before: { availableCredits: balanceBefore }, after: { availableCredits: balanceAfter } })); });
}

export function subscriptionUsableCredits(data: { status: string; endsAt: Date; availableCredits: number }, now = new Date()) { return usableCredits(data.status, data.endsAt, data.availableCredits, now); }

export type CustomerEntitlementView = {
  subscription: {
    id: string;
    planName: string;
    status: string;
    startsAt: string | null;
    endsAt: string | null;
    effectiveEndsAt: string | null;
    availableCredits: number;
    reservedCredits: number;
    usedCredits: number;
    durationMonths: number | null;
    pauseDaysUsed: number;
    pauseAllowanceDays: number;
    pauseEndsAt: string | null;
  } | null;
  ledger: { id: string; action: string; amount: number; createdAt: string | null }[];
};

/** A bounded, customer-owned entitlement view. It never accepts a tenant or customer id from the browser. */
export async function getCustomerEntitlement(principal: Principal): Promise<CustomerEntitlementView> {
  if (!principal.studioId || !principal.roles.includes("customer")) throw new Error("FORBIDDEN_CUSTOMER");
  const db = getAdminDb();
  const memberRef = db.doc(`studios/${principal.studioId}/members/${principal.uid}`);
  let member = await memberRef.get();
  const subscriptionId = String(member.data()?.activeSubscriptionId ?? member.data()?.latestSubscriptionId ?? "");
  if (!subscriptionId) return { subscription: null, ledger: [] };
  await expireSubscriptionIfDue(principal.studioId, subscriptionId);
  member = await memberRef.get();
  const refreshedId = String(member.data()?.activeSubscriptionId ?? member.data()?.latestSubscriptionId ?? subscriptionId);
  const subscriptionRef = db.doc(`studios/${principal.studioId}/subscriptions/${refreshedId}`);
  const subscriptionSnapshot = await subscriptionRef.get();
  if (!subscriptionSnapshot.exists || String(subscriptionSnapshot.data()?.customerUid ?? "") !== principal.uid) return { subscription: null, ledger: [] };
  const data = subscriptionSnapshot.data()!;
  const [ledger, customerBookings] = await Promise.all([
    subscriptionRef.collection("ledger").orderBy("createdAt", "desc").limit(20).get(),
    db.collection(`studios/${principal.studioId}/bookings`).where("customerUid", "==", principal.uid).limit(100).get(),
  ]);
  const terms = data.historicalTerms ?? {};
  const allocation = Number(terms.creditAllocation ?? 0);
  const availableCredits = Number(data.availableCredits ?? 0);
  // Keep this count aligned with the Upcoming booking screen: only a future,
  // confirmed booking reserves a class pass. This avoids displaying a pass as
  // booked after its booking has been cancelled or moved to history.
  const now = new Date();
  const reservedCredits = customerBookings.docs.filter((booking) => {
    const bookingData = booking.data();
    const startsAt = asDate(bookingData?.slotStartsAt);
    return bookingData?.status === "confirmed" && startsAt !== null && startsAt.getTime() > now.getTime();
  }).length;
  return {
    subscription: {
      id: subscriptionSnapshot.id,
      planName: String(terms.planName ?? "Membership"),
      status: String(data.status ?? "inactive"),
      startsAt: asDate(data.startsAt)?.toISOString() ?? null,
      endsAt: asDate(data.endsAt)?.toISOString() ?? null,
      effectiveEndsAt: asDate(data.effectiveEndsAt)?.toISOString() ?? asDate(data.endsAt)?.toISOString() ?? null,
      availableCredits,
      reservedCredits,
      usedCredits: Math.max(0, allocation - availableCredits - reservedCredits),
      durationMonths: Number(terms.durationMonths ?? 0) || null,
      pauseDaysUsed: Number(data.pauseDaysUsed ?? 0),
      pauseAllowanceDays: pauseAllowanceDays(Number(terms.durationMonths ?? 0) || undefined),
      pauseEndsAt: asDate(data.pauseEndsAt)?.toISOString() ?? null,
    },
    ledger: ledger.docs.map((entry) => ({ id: entry.id, action: String(entry.data().action ?? "update"), amount: Number(entry.data().amount ?? 0), createdAt: asDate(entry.data().createdAt)?.toISOString() ?? null })),
  };
}
