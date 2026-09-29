import "server-only";

import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { Principal } from "@/lib/auth/server";
import { bookingPaths, bookingRejection, canReschedule, cancellationBalances, cancellationKind, hasActiveBooking, isIdempotentBookingRetry, remainingSlotCapacity, reservationBalance, rescheduledBookingCounts, type BookingCheck, type CancellationKind } from "@/lib/booking-logic";
import { expireSubscriptionIfDue, subscriptionUsableCredits } from "@/lib/entitlements";
import { getAdminDb } from "@/lib/firebase/admin";
import { recordIncidentInTransaction } from "@/lib/incidents";
import { promoteOneWaitlistEntry } from "@/lib/waitlist";
import { bookingCancellationSchema, bookingRequestSchema, bookingRescheduleSchema, bookingSlotIdSchema } from "@/lib/validation";

type SlotView = {
  id: string;
  className: string;
  trainerName: string;
  localDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  startsAt: string;
  capacity: number;
  confirmedBookingCount: number;
  remainingCapacity: number;
  alreadyBooked: boolean;
};

export type CustomerSubscriptionView = {
  usableCredits: number;
  state: "active" | "inactive" | "none";
  endsAt: string | null;
};

export type CustomerBookingView = {
  id: string;
  slotId: string;
  className: string;
  trainerName: string;
  localDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  startsAt: string;
  status: string;
  isUpcoming: boolean;
  cancellationState: CancellationKind;
  reschedulable: boolean;
};

function requireCustomer(principal: Principal) {
  if (!principal.studioId || !principal.roles.includes("customer")) throw new Error("FORBIDDEN_CUSTOMER");
  return principal.studioId;
}

function asDate(value: unknown) {
  return value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function"
    ? value.toDate() as Date
    : null;
}

function slotView(id: string, data: FirebaseFirestore.DocumentData, alreadyBooked: boolean): SlotView | null {
  const startsAt = asDate(data.startsAt);
  if (!startsAt) return null;
  const capacity = Number(data.capacity ?? 0);
  const confirmedBookingCount = Number(data.confirmedBookingCount ?? 0);
  return {
    id,
    className: String(data.className ?? "Class"),
    trainerName: String(data.trainerName ?? "Trainer"),
    localDate: String(data.localDate ?? ""),
    startTime: String(data.startTime ?? ""),
    endTime: String(data.endTime ?? ""),
    timezone: String(data.timezone ?? ""),
    startsAt: startsAt.toISOString(),
    capacity,
    confirmedBookingCount,
    remainingCapacity: remainingSlotCapacity(capacity, confirmedBookingCount),
    alreadyBooked,
  };
}

async function currentTrainerName(studioId: string, data: FirebaseFirestore.DocumentData) {
  const fallback = String(data.trainerName ?? "Trainer");
  let uid = String(data.trainerUid ?? "");
  if (!uid && data.slotId) {
    const slot = await getAdminDb().doc(`studios/${studioId}/slots/${String(data.slotId)}`).get();
    uid = String(slot.data()?.trainerUid ?? "");
  }
  if (!uid) return fallback;
  const member = await getAdminDb().doc(`studios/${studioId}/members/${uid}`).get();
  return String(member.data()?.displayName ?? "").trim() || fallback;
}

async function currentSubscription(studioId: string, customerUid: string): Promise<CustomerSubscriptionView> {
  const db = getAdminDb();
  const memberRef = db.doc(`studios/${studioId}/members/${customerUid}`);
  let member = await memberRef.get();
  const activeSubscriptionId = member.data()?.activeSubscriptionId;
  if (!activeSubscriptionId) return { usableCredits: 0, state: "none", endsAt: null };
  await expireSubscriptionIfDue(studioId, String(activeSubscriptionId));
  member = await memberRef.get();
  const refreshedId = member.data()?.activeSubscriptionId;
  if (!refreshedId) return { usableCredits: 0, state: "inactive", endsAt: null };
  const subscription = await db.doc(`studios/${studioId}/subscriptions/${refreshedId}`).get();
  if (!subscription.exists) return { usableCredits: 0, state: "none", endsAt: null };
  const data = subscription.data()!;
  const endsAt = asDate(data.effectiveEndsAt) ?? asDate(data.endsAt);
  if (!endsAt) return { usableCredits: 0, state: "inactive", endsAt: null };
  const usableCredits = subscriptionUsableCredits({ status: String(data.status), endsAt, availableCredits: Number(data.availableCredits ?? 0) });
  return { usableCredits, state: usableCredits > 0 ? "active" : data.status === "active" ? "active" : "inactive", endsAt: endsAt.toISOString() };
}

async function existingBookingIds(studioId: string, customerUid: string) {
  const db = getAdminDb();
  const bookings = await db.collection(`studios/${studioId}/bookings`)
    .where("customerUid", "==", customerUid)
    .limit(50)
    .get();
  return new Set(bookings.docs.filter((doc) => doc.data().status === "confirmed").map((doc) => String(doc.data().slotId)));
}

export async function getCustomerSchedule(principal: Principal) {
  const studioId = requireCustomer(principal);
  const db = getAdminDb();
  const [studio, slots, bookedSlotIds, subscription] = await Promise.all([
    db.doc(`studios/${studioId}`).get(),
    db.collection(`studios/${studioId}/slots`).where("startsAt", ">", Timestamp.fromDate(new Date())).orderBy("startsAt", "asc").limit(100).get(),
    existingBookingIds(studioId, principal.uid),
    currentSubscription(studioId, principal.uid),
  ]);
  if (!studio.exists || studio.data()?.status !== "active") throw new Error("INACTIVE_STUDIO");
  const visibleSlots = slots.docs.filter((doc) => doc.data().status === "published").slice(0, 60);
  const slotViews = await Promise.all(visibleSlots.map(async (doc) => {
    const view = slotView(doc.id, doc.data(), bookedSlotIds.has(doc.id));
    return view ? { ...view, trainerName: await currentTrainerName(studioId, doc.data()) } : null;
  }));
  return {
    studioName: String(studio.data()?.name ?? "Studio"),
    timezone: String(studio.data()?.timezone ?? ""),
    subscription,
    slots: slotViews.filter((slot): slot is SlotView => slot !== null),
  };
}

export async function getCustomerSlot(principal: Principal, slotId: string) {
  const studioId = requireCustomer(principal);
  bookingSlotIdSchema.parse(slotId);
  const db = getAdminDb();
  const [studio, slot, bookedSlotIds, subscription] = await Promise.all([
    db.doc(`studios/${studioId}`).get(),
    db.doc(`studios/${studioId}/slots/${slotId}`).get(),
    existingBookingIds(studioId, principal.uid),
    currentSubscription(studioId, principal.uid),
  ]);
  if (!studio.exists || studio.data()?.status !== "active") throw new Error("INACTIVE_STUDIO");
  if (!slot.exists || slot.data()?.status !== "published") return null;
  const initialView = slotView(slot.id, slot.data()!, bookedSlotIds.has(slot.id));
  const view = initialView ? { ...initialView, trainerName: await currentTrainerName(studioId, slot.data()!) } : null;
  if (!view) return null;
  return { slot: view, subscription, started: new Date(view.startsAt).getTime() <= Date.now() };
}

export async function getCustomerBookings(principal: Principal): Promise<CustomerBookingView[]> {
  const studioId = requireCustomer(principal);
  const db = getAdminDb();
  const bookings = await db.collection(`studios/${studioId}/bookings`).where("customerUid", "==", principal.uid).limit(50).get();
  const now = Date.now();
  const sorted = bookings.docs.sort((left, right) => Number(right.data().slotStartsAt?.toMillis?.() ?? 0) - Number(left.data().slotStartsAt?.toMillis?.() ?? 0));
  const trainerNames = await Promise.all(sorted.map((doc) => currentTrainerName(studioId, doc.data())));
  return sorted.map((doc, index) => {
    const data = doc.data();
    const slotStartsAt = asDate(data.slotStartsAt);
    const isConfirmed = String(data.status ?? "confirmed") === "confirmed";
    const startsAt = slotStartsAt ?? new Date(0);
    return {
      id: doc.id,
      slotId: String(data.slotId ?? ""),
      className: String(data.className ?? "Class"),
      trainerName: trainerNames[index],
      localDate: String(data.localDate ?? ""),
      startTime: String(data.startTime ?? ""),
      endTime: String(data.endTime ?? ""),
      timezone: String(data.timezone ?? ""),
      startsAt: slotStartsAt?.toISOString() ?? "",
      status: String(data.status ?? "confirmed"),
      isUpcoming: isConfirmed && startsAt.getTime() > now,
      cancellationState: isConfirmed ? cancellationKind(startsAt, new Date(now)) : "unavailable",
      reschedulable: isConfirmed && canReschedule(startsAt, new Date(now)),
    };
  });
}

export type BookingResult = { bookingId: string; idempotent: boolean };

export async function createBooking(principal: Principal, raw: unknown): Promise<BookingResult> {
  const studioId = requireCustomer(principal);
  const input = bookingRequestSchema.parse(raw);
  const db = getAdminDb();
  const paths = bookingPaths(studioId, input.slotId, principal.uid, input.operationId);
  const slotRef = db.doc(paths.slot);
  const memberRef = db.doc(`studios/${studioId}/members/${principal.uid}`);
  const bookingRef = db.doc(paths.booking);

  return db.runTransaction(async (transaction) => {
    const [studio, member, slot, existingBooking, customerSlotBookings] = await Promise.all([
      transaction.get(db.doc(`studios/${studioId}`)),
      transaction.get(memberRef),
      transaction.get(slotRef),
      transaction.get(bookingRef),
      transaction.get(db.collection(`studios/${studioId}/bookings`).where("customerUid", "==", principal.uid).where("slotId", "==", input.slotId)),
    ]);
    if (existingBooking.exists) {
      if (isIdempotentBookingRetry(String(existingBooking.data()?.operationId ?? ""), input.operationId)) return { bookingId: bookingRef.id, idempotent: true };
      throw new Error("ALREADY_BOOKED");
    }
    if (hasActiveBooking(customerSlotBookings.docs.map((doc) => String(doc.data().status ?? "")))) throw new Error("ALREADY_BOOKED");
    const slotData = slot.exists ? slot.data()! : null;
    const subscriptionId = member.data()?.activeSubscriptionId;
    const subscriptionRef = subscriptionId ? db.doc(`studios/${studioId}/subscriptions/${subscriptionId}`) : null;
    const subscription = subscriptionRef ? await transaction.get(subscriptionRef) : null;
    const startsAt = slotData ? asDate(slotData.startsAt) : null;
    const endsAt = subscription?.exists ? asDate(subscription.data()?.effectiveEndsAt) ?? asDate(subscription.data()?.endsAt) : null;
    const check: BookingCheck = {
      studioActive: studio.exists && studio.data()?.status === "active",
      membershipActive: member.exists && member.data()?.status === "active",
      hasCustomerRole: Array.isArray(member.data()?.roles) && member.data()?.roles.includes("customer"),
      slotPublished: slotData?.status === "published",
      slotStartsAt: startsAt ?? new Date(0),
      capacity: Number(slotData?.capacity ?? 0),
      confirmedBookingCount: Number(slotData?.confirmedBookingCount ?? 0),
      hasExistingBooking: false,
      subscriptionActive: Boolean(subscription?.exists && subscription.data()?.status === "active"),
      subscriptionEndsAt: endsAt,
      availableCredits: Number(subscription?.data()?.availableCredits ?? 0),
    };
    const rejection = bookingRejection(check, new Date());
    if (rejection) throw new Error(rejection);
    const balanceAfter = reservationBalance(check.availableCredits);
    const reservationRef = subscriptionRef!.collection("ledger").doc(`reservation-${input.operationId}`);
    transaction.update(slotRef, { confirmedBookingCount: check.confirmedBookingCount + 1, updatedAt: FieldValue.serverTimestamp() });
    transaction.update(subscriptionRef!, {
      availableCredits: balanceAfter,
      reservedCredits: Number(subscription!.data()?.reservedCredits ?? 0) + 1,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: principal.uid,
    });
    transaction.set(bookingRef, {
      slotId: slotRef.id,
      customerUid: principal.uid,
      subscriptionId: subscriptionRef!.id,
      reservationLedgerId: reservationRef.id,
      operationId: input.operationId,
      status: "confirmed",
      className: String(slotData!.className ?? "Class"),
      trainerUid: String(slotData!.trainerUid ?? ""),
      trainerName: String(slotData!.trainerName ?? "Trainer"),
      localDate: String(slotData!.localDate ?? ""),
      startTime: String(slotData!.startTime ?? ""),
      endTime: String(slotData!.endTime ?? ""),
      timezone: String(slotData!.timezone ?? ""),
      slotStartsAt: slotData!.startsAt,
      slotEndsAt: slotData!.endsAt,
      createdAt: FieldValue.serverTimestamp(),
      confirmedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(reservationRef, {
      action: "reservation",
      amount: -1,
      balanceBefore: check.availableCredits,
      balanceAfter,
      reservedCreditsAfter: Number(subscription!.data()?.reservedCredits ?? 0) + 1,
      actorUid: principal.uid,
      referenceId: bookingRef.id,
      slotId: slotRef.id,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), {
      action: "booking.confirmed", actorUid: principal.uid, targetId: bookingRef.id,
      createdAt: FieldValue.serverTimestamp(), result: "success", after: { slotId: slotRef.id, subscriptionId: subscriptionRef!.id },
    });
    transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), {
      action: "credit.reserved", actorUid: principal.uid, targetId: subscriptionRef!.id,
      createdAt: FieldValue.serverTimestamp(), result: "success", after: { bookingId: bookingRef.id, amount: -1, balanceAfter },
    });
    return { bookingId: bookingRef.id, idempotent: false };
  });
}

function assertCustomerContext(studio: FirebaseFirestore.DocumentSnapshot, member: FirebaseFirestore.DocumentSnapshot) {
  if (!studio.exists || studio.data()?.status !== "active") throw new Error("INACTIVE_STUDIO");
  if (!member.exists || member.data()?.status !== "active") throw new Error("MEMBERSHIP_INACTIVE");
  if (!Array.isArray(member.data()?.roles) || !member.data()?.roles.includes("customer")) throw new Error("FORBIDDEN_CUSTOMER");
}

export type CancellationResult = { bookingId: string; kind: "free" | "late"; idempotent: boolean };

export async function cancelCustomerBooking(principal: Principal, raw: unknown): Promise<CancellationResult> {
  const studioId = requireCustomer(principal); const input = bookingCancellationSchema.parse(raw); const db = getAdminDb();
  const bookingRef = db.doc(`studios/${studioId}/bookings/${input.bookingId}`); const memberRef = db.doc(`studios/${studioId}/members/${principal.uid}`);
  let openedSlotId: string | null = null;
  const result = await db.runTransaction(async (transaction) => {
    const [studio, member, booking] = await Promise.all([transaction.get(db.doc(`studios/${studioId}`)), transaction.get(memberRef), transaction.get(bookingRef)]);
    assertCustomerContext(studio, member);
    if (!booking.exists || booking.data()?.customerUid !== principal.uid) throw new Error("BOOKING_NOT_FOUND");
    const bookingData = booking.data()!;
    if (bookingData.status !== "confirmed") {
      if (bookingData.cancellationOperationId === input.operationId && (bookingData.status === "cancelled-free" || bookingData.status === "cancelled-late")) return { bookingId: bookingRef.id, kind: bookingData.status === "cancelled-free" ? "free" as const : "late" as const, idempotent: true };
      throw new Error("BOOKING_NOT_CANCELLABLE");
    }
    const startsAt = asDate(bookingData.slotStartsAt); const slotId = String(bookingData.slotId ?? ""); const subscriptionId = String(bookingData.subscriptionId ?? ""); const reservationLedgerId = String(bookingData.reservationLedgerId ?? "");
    if (!startsAt || !slotId || !subscriptionId || !reservationLedgerId) throw new Error("BOOKING_INVALID");
    const kind = cancellationKind(startsAt);
    if (kind === "unavailable") throw new Error("CANCELLATION_AFTER_START");
    const slotRef = db.doc(`studios/${studioId}/slots/${slotId}`); const subscriptionRef = db.doc(`studios/${studioId}/subscriptions/${subscriptionId}`); const ledgerRef = subscriptionRef.collection("ledger").doc(`cancellation-${input.operationId}`);
    const [slot, subscription, reservation, existingLedger] = await Promise.all([transaction.get(slotRef), transaction.get(subscriptionRef), transaction.get(subscriptionRef.collection("ledger").doc(reservationLedgerId)), transaction.get(ledgerRef)]);
    if (existingLedger.exists) return { bookingId: bookingRef.id, kind, idempotent: true };
    if (!slot.exists || !subscription.exists || !reservation.exists || reservation.data()?.action !== "reservation") throw new Error("BOOKING_INVALID");
    const bookingCount = Number(slot.data()?.confirmedBookingCount ?? 0); const availableCredits = Number(subscription.data()?.availableCredits ?? 0); const reservedCredits = Number(subscription.data()?.reservedCredits ?? 0);
    const outcome = cancellationBalances(kind, availableCredits, reservedCredits, bookingCount);
    if (kind === "late") await recordIncidentInTransaction(transaction, studioId, principal.uid, { bookingId: bookingRef.id, customerUid: principal.uid, type: "late-cancellation", sourceTimestamp: new Date() });
    transaction.update(slotRef, { confirmedBookingCount: outcome.confirmedBookingCount, updatedAt: FieldValue.serverTimestamp() });
    transaction.update(subscriptionRef, { availableCredits: outcome.availableCredits, reservedCredits: outcome.reservedCredits, updatedAt: FieldValue.serverTimestamp(), updatedBy: principal.uid });
    transaction.update(bookingRef, { status: kind === "free" ? "cancelled-free" : "cancelled-late", cancelledAt: FieldValue.serverTimestamp(), cancellationKind: kind, cancellationOperationId: input.operationId, updatedAt: FieldValue.serverTimestamp() });
    transaction.set(ledgerRef, { action: kind === "free" ? "release" : "consumption", amount: kind === "free" ? 1 : 0, balanceBefore: availableCredits, balanceAfter: outcome.availableCredits, reservedCreditsBefore: reservedCredits, reservedCreditsAfter: outcome.reservedCredits, actorUid: principal.uid, referenceId: bookingRef.id, slotId, createdAt: FieldValue.serverTimestamp() });
    transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), { action: kind === "free" ? "booking.cancelled_free" : "booking.cancelled_late", actorUid: principal.uid, targetId: bookingRef.id, createdAt: FieldValue.serverTimestamp(), result: "success", after: { slotId, creditOutcome: kind === "free" ? "released" : "consumed" } });
    transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), { action: kind === "free" ? "credit.released" : "credit.consumed", actorUid: principal.uid, targetId: subscriptionRef.id, createdAt: FieldValue.serverTimestamp(), result: "success", after: { bookingId: bookingRef.id, balanceAfter: outcome.availableCredits, reservedCreditsAfter: outcome.reservedCredits } });
    openedSlotId = slotId;
    return { bookingId: bookingRef.id, kind, idempotent: false };
  });
  if (openedSlotId) await promoteOneWaitlistEntry(studioId, openedSlotId, principal.uid);
  return result;
}

export type RescheduleResult = { bookingId: string; idempotent: boolean };

export async function rescheduleCustomerBooking(principal: Principal, raw: unknown): Promise<RescheduleResult> {
  const studioId = requireCustomer(principal); const input = bookingRescheduleSchema.parse(raw); const db = getAdminDb();
  const originalRef = db.doc(`studios/${studioId}/bookings/${input.bookingId}`); const memberRef = db.doc(`studios/${studioId}/members/${principal.uid}`); const targetPaths = bookingPaths(studioId, input.targetSlotId, principal.uid, input.operationId); const targetSlotRef = db.doc(targetPaths.slot); const targetBookingRef = db.doc(targetPaths.booking);
  let openedSlotId: string | null = null;
  const result = await db.runTransaction(async (transaction) => {
    const [studio, member, original, targetSlot, targetBooking, targetCustomerBookings] = await Promise.all([transaction.get(db.doc(`studios/${studioId}`)), transaction.get(memberRef), transaction.get(originalRef), transaction.get(targetSlotRef), transaction.get(targetBookingRef), transaction.get(db.collection(`studios/${studioId}/bookings`).where("customerUid", "==", principal.uid).where("slotId", "==", input.targetSlotId))]);
    assertCustomerContext(studio, member);
    if (!original.exists || original.data()?.customerUid !== principal.uid) throw new Error("BOOKING_NOT_FOUND");
    const originalData = original.data()!;
    if (originalData.status !== "confirmed") {
      if (originalData.rescheduleOperationId === input.operationId && originalData.rescheduledToBookingId) return { bookingId: String(originalData.rescheduledToBookingId), idempotent: true };
      throw new Error("BOOKING_NOT_RESCHEDULABLE");
    }
    const originalSlotId = String(originalData.slotId ?? ""); const originalStartsAt = asDate(originalData.slotStartsAt); const subscriptionId = String(originalData.subscriptionId ?? ""); const reservationLedgerId = String(originalData.reservationLedgerId ?? "");
    if (!originalSlotId || !originalStartsAt || !subscriptionId || !reservationLedgerId) throw new Error("BOOKING_INVALID");
    if (input.targetSlotId === originalSlotId) throw new Error("RESCHEDULE_SAME_SLOT");
    if (originalStartsAt.getTime() <= Date.now()) throw new Error("CANCELLATION_AFTER_START");
    if (!canReschedule(originalStartsAt)) throw new Error("RESCHEDULE_CUTOFF_PASSED");
    if (targetBooking.exists || hasActiveBooking(targetCustomerBookings.docs.map((doc) => String(doc.data().status ?? "")))) throw new Error("ALREADY_BOOKED");
    const targetData = targetSlot.exists ? targetSlot.data()! : null; const targetStartsAt = targetData ? asDate(targetData.startsAt) : null;
    if (!targetData || targetData.status !== "published") throw new Error("SLOT_UNAVAILABLE");
    if (!targetStartsAt || targetStartsAt.getTime() <= Date.now()) throw new Error("SLOT_STARTED");
    const targetCount = Number(targetData.confirmedBookingCount ?? 0); if (targetCount >= Number(targetData.capacity ?? 0)) throw new Error("SLOT_FULL");
    const originalSlotRef = db.doc(`studios/${studioId}/slots/${originalSlotId}`); const subscriptionRef = db.doc(`studios/${studioId}/subscriptions/${subscriptionId}`); const reservationRef = subscriptionRef.collection("ledger").doc(reservationLedgerId);
    const [originalSlot, subscription, reservation] = await Promise.all([transaction.get(originalSlotRef), transaction.get(subscriptionRef), transaction.get(reservationRef)]);
    if (!originalSlot.exists || !subscription.exists || !reservation.exists || reservation.data()?.action !== "reservation") throw new Error("BOOKING_INVALID");
    const originalCount = Number(originalSlot.data()?.confirmedBookingCount ?? 0); if (Number(subscription.data()?.reservedCredits ?? 0) < 1) throw new Error("BOOKING_INVALID");
    const counts = rescheduledBookingCounts(originalCount, targetCount, Number(targetData.capacity ?? 0));
    transaction.update(originalSlotRef, { confirmedBookingCount: counts.originalConfirmedBookingCount, updatedAt: FieldValue.serverTimestamp() });
    transaction.update(targetSlotRef, { confirmedBookingCount: counts.targetConfirmedBookingCount, updatedAt: FieldValue.serverTimestamp() });
    transaction.update(originalRef, { status: "cancelled-free", rescheduledAt: FieldValue.serverTimestamp(), rescheduleOperationId: input.operationId, rescheduledToBookingId: targetBookingRef.id, updatedAt: FieldValue.serverTimestamp() });
    transaction.set(targetBookingRef, { slotId: targetSlotRef.id, customerUid: principal.uid, subscriptionId, reservationLedgerId, operationId: input.operationId, status: "confirmed", rescheduledFromBookingId: originalRef.id, className: String(targetData.className ?? "Class"), trainerUid: String(targetData.trainerUid ?? ""), trainerName: String(targetData.trainerName ?? "Trainer"), localDate: String(targetData.localDate ?? ""), startTime: String(targetData.startTime ?? ""), endTime: String(targetData.endTime ?? ""), timezone: String(targetData.timezone ?? ""), slotStartsAt: targetData.startsAt, slotEndsAt: targetData.endsAt, createdAt: FieldValue.serverTimestamp(), confirmedAt: FieldValue.serverTimestamp() });
    transaction.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), { action: "booking.rescheduled", actorUid: principal.uid, targetId: targetBookingRef.id, createdAt: FieldValue.serverTimestamp(), result: "success", before: { bookingId: originalRef.id, slotId: originalSlotId }, after: { slotId: targetSlotRef.id, reservationLedgerId } });
    openedSlotId = originalSlotId;
    return { bookingId: targetBookingRef.id, idempotent: false };
  });
  if (openedSlotId) await promoteOneWaitlistEntry(studioId, openedSlotId, principal.uid);
  return result;
}
