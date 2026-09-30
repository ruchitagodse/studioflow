import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import type { Principal } from "@/lib/auth/server";
import { attendanceConsumption, attendanceContextRejection, attendancePaths, attendanceRoleForActor, attendanceWindow, canCorrectAttendance, isAttendanceCandidate, isAttendanceOutcome, type AttendanceOutcome, type AttendanceWindow } from "@/lib/attendance-logic";
import { getAdminDb } from "@/lib/firebase/admin";
import { recordIncidentInTransaction } from "@/lib/incidents";
import { attendanceCorrectionSchema, attendanceMarkSchema, bookingSlotIdSchema } from "@/lib/validation";

type AttendanceRole = "trainer" | "staff" | "owner";

export type RosterEntry = {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  status: "confirmed" | AttendanceOutcome;
};

export type AttendanceRoster = {
  slotId: string;
  className: string;
  trainerName: string;
  localDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  capacity: number;
  confirmedBookingCount: number;
  window: AttendanceWindow;
  role: AttendanceRole;
  entries: RosterEntry[];
};

function asDate(value: unknown) {
  return value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function"
    ? value.toDate() as Date
    : null;
}

function attendanceRole(principal: Principal, member: FirebaseFirestore.DocumentData, slot: FirebaseFirestore.DocumentData): AttendanceRole {
  const roles = Array.isArray(member.roles) ? member.roles.map(String) : [];
  const role = attendanceRoleForActor(roles, principal.uid, String(slot.trainerUid ?? ""));
  if (!role) throw new Error("FORBIDDEN_ATTENDANCE");
  return role;
}

function assertActiveStudioMember(studio: FirebaseFirestore.DocumentSnapshot, member: FirebaseFirestore.DocumentSnapshot) {
  const rejection = attendanceContextRejection(studio.exists && studio.data()?.status === "active", member.exists && member.data()?.status === "active");
  if (rejection) throw new Error(rejection);
}

function assertAttendanceSlot(slot: FirebaseFirestore.DocumentSnapshot) {
  if (!slot.exists || !["published", "completed"].includes(String(slot.data()?.status ?? ""))) throw new Error("SLOT_UNAVAILABLE");
  const startsAt = asDate(slot.data()?.startsAt);
  const endsAt = asDate(slot.data()?.endsAt);
  if (!startsAt || !endsAt) throw new Error("SLOT_UNAVAILABLE");
  return { data: slot.data()!, startsAt, endsAt };
}

function audit(action: string, actorUid: string, targetId: string, detail: Record<string, unknown> = {}) {
  return { action, actorUid, targetId, createdAt: FieldValue.serverTimestamp(), result: "success", ...detail };
}

export async function getAttendanceRoster(principal: Principal, slotId: string): Promise<AttendanceRoster> {
  if (!principal.studioId) throw new Error("FORBIDDEN_ATTENDANCE");
  bookingSlotIdSchema.parse(slotId);
  const studioId = principal.studioId;
  const db = getAdminDb();
  const [studio, member, slot] = await Promise.all([
    db.doc(`studios/${studioId}`).get(),
    db.doc(`studios/${studioId}/members/${principal.uid}`).get(),
    db.doc(`studios/${studioId}/slots/${slotId}`).get(),
  ]);
  assertActiveStudioMember(studio, member);
  const slotContext = assertAttendanceSlot(slot);
  const role = attendanceRole(principal, member.data()!, slotContext.data);
  const [bookingDocs, trainer] = await Promise.all([db.collection(`studios/${studioId}/bookings`).where("slotId", "==", slotId).limit(100).get(), db.doc(`studios/${studioId}/members/${String(slotContext.data.trainerUid ?? "")}`).get()]);
  const eligibleBookings = bookingDocs.docs.filter((doc) => {
    const status = String(doc.data().status ?? "");
    return isAttendanceCandidate(status) || isAttendanceOutcome(status);
  });
  const customerDocs = await Promise.all(eligibleBookings.map((booking) => db.doc(`studios/${studioId}/members/${String(booking.data().customerUid ?? "")}`).get()));
  const entries = eligibleBookings.map((booking, index) => {
    const data = booking.data();
    const customer = customerDocs[index]?.data();
    const status = String(data.status ?? "confirmed");
    return {
      bookingId: booking.id,
      customerName: String(customer?.displayName ?? customer?.email ?? "Customer"),
      customerEmail: String(customer?.email ?? ""),
      status: isAttendanceOutcome(status) ? status : "confirmed",
    } satisfies RosterEntry;
  }).sort((left, right) => left.customerName.localeCompare(right.customerName));
  return {
    slotId,
    className: String(slotContext.data.className ?? "Class"),
    trainerName: String(trainer.data()?.displayName ?? "").trim() || "Trainer",
    localDate: String(slotContext.data.localDate ?? ""),
    startTime: String(slotContext.data.startTime ?? ""),
    endTime: String(slotContext.data.endTime ?? ""),
    timezone: String(slotContext.data.timezone ?? ""),
    capacity: Number(slotContext.data.capacity ?? 0),
    confirmedBookingCount: Number(slotContext.data.confirmedBookingCount ?? 0),
    window: attendanceWindow(slotContext.startsAt, slotContext.endsAt),
    role,
    entries,
  };
}

export type AttendanceResult = { bookingId: string; outcome: AttendanceOutcome; idempotent: boolean };

export async function markAttendance(principal: Principal, raw: unknown): Promise<AttendanceResult> {
  if (!principal.studioId) throw new Error("FORBIDDEN_ATTENDANCE");
  const studioId = principal.studioId;
  const input = attendanceMarkSchema.parse(raw);
  const db = getAdminDb();
  const paths = attendancePaths(studioId, input.slotId, input.bookingId);
  const studioRef = db.doc(`studios/${studioId}`);
  const memberRef = db.doc(`studios/${studioId}/members/${principal.uid}`);
  const slotRef = db.doc(paths.slot);
  const bookingRef = db.doc(paths.booking);
  return db.runTransaction(async (transaction) => {
    const [studio, member, slot, booking] = await Promise.all([transaction.get(studioRef), transaction.get(memberRef), transaction.get(slotRef), transaction.get(bookingRef)]);
    assertActiveStudioMember(studio, member);
    const slotContext = assertAttendanceSlot(slot);
    attendanceRole(principal, member.data()!, slotContext.data);
    const window = attendanceWindow(slotContext.startsAt, slotContext.endsAt);
    if (window === "before") throw new Error("ATTENDANCE_NOT_OPEN");
    if (window === "locked") throw new Error("ATTENDANCE_LOCKED");
    if (!booking.exists || String(booking.data()?.slotId ?? "") !== input.slotId) throw new Error("BOOKING_NOT_FOUND");
    const bookingData = booking.data()!;
    const status = String(bookingData.status ?? "");
    if (!isAttendanceCandidate(status)) {
      if (isAttendanceOutcome(status) && bookingData.attendanceOperationId === input.operationId && status === input.outcome) {
        return { bookingId: bookingRef.id, outcome: input.outcome, idempotent: true };
      }
      throw new Error(isAttendanceOutcome(status) ? "ATTENDANCE_ALREADY_RECORDED" : "BOOKING_NOT_ATTENDANCE_ELIGIBLE");
    }
    const subscriptionId = String(bookingData.subscriptionId ?? "");
    const reservationLedgerId = String(bookingData.reservationLedgerId ?? "");
    if (!subscriptionId || !reservationLedgerId) throw new Error("BOOKING_INVALID");
    const subscriptionRef = db.doc(`studios/${studioId}/subscriptions/${subscriptionId}`);
    const consumptionRef = subscriptionRef.collection("ledger").doc(`attendance-${input.operationId}`);
    const [subscription, reservation, existingConsumption] = await Promise.all([
      transaction.get(subscriptionRef),
      transaction.get(subscriptionRef.collection("ledger").doc(reservationLedgerId)),
      transaction.get(consumptionRef),
    ]);
    if (existingConsumption.exists) throw new Error("ATTENDANCE_OPERATION_CONFLICT");
    if (!subscription.exists || !reservation.exists || reservation.data()?.action !== "reservation") throw new Error("BOOKING_INVALID");
    const availableCredits = Number(subscription.data()?.availableCredits ?? 0);
    const reservedCredits = Number(subscription.data()?.reservedCredits ?? 0);
    const counts = attendanceConsumption(availableCredits, reservedCredits, Number(slotContext.data.confirmedBookingCount ?? 0));
    if (input.outcome === "no-show") await recordIncidentInTransaction(transaction, studioId, principal.uid, { bookingId: bookingRef.id, customerUid: String(bookingData.customerUid ?? ""), type: "no-show", sourceTimestamp: new Date() });
    transaction.update(slotRef, { confirmedBookingCount: counts.confirmedBookingCount, updatedAt: FieldValue.serverTimestamp() });
    transaction.update(subscriptionRef, { availableCredits: counts.availableCredits, reservedCredits: counts.reservedCredits, updatedAt: FieldValue.serverTimestamp(), updatedBy: principal.uid });
    transaction.update(bookingRef, {
      status: input.outcome,
      attendanceOutcome: input.outcome,
      attendanceRecordedAt: FieldValue.serverTimestamp(),
      attendanceRecordedBy: principal.uid,
      attendanceOperationId: input.operationId,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: principal.uid,
    });
    transaction.set(consumptionRef, {
      action: "consumption",
      amount: 0,
      balanceBefore: availableCredits,
      balanceAfter: counts.availableCredits,
      reservedCreditsBefore: reservedCredits,
      reservedCreditsAfter: counts.reservedCredits,
      actorUid: principal.uid,
      referenceId: bookingRef.id,
      slotId: slotRef.id,
      reason: `Attendance recorded as ${input.outcome}.`,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.set(db.doc(`studios/${studioId}/auditEvents/attendance-${input.operationId}`), audit("attendance.marked", principal.uid, bookingRef.id, {
      after: { outcome: input.outcome, slotId: slotRef.id, customerUid: String(bookingData.customerUid ?? "") },
    }));
    transaction.set(db.doc(`studios/${studioId}/auditEvents/credit-attendance-${input.operationId}`), audit("credit.consumed", principal.uid, subscriptionRef.id, {
      after: { bookingId: bookingRef.id, outcome: input.outcome, reservedCreditsAfter: counts.reservedCredits },
    }));
    return { bookingId: bookingRef.id, outcome: input.outcome, idempotent: false };
  });
}

export async function correctAttendance(principal: Principal, raw: unknown): Promise<AttendanceResult> {
  if (!principal.studioId) throw new Error("FORBIDDEN_ATTENDANCE");
  const studioId = principal.studioId;
  const input = attendanceCorrectionSchema.parse(raw);
  const db = getAdminDb();
  const paths = attendancePaths(studioId, input.slotId, input.bookingId);
  const studioRef = db.doc(`studios/${studioId}`);
  const memberRef = db.doc(`studios/${studioId}/members/${principal.uid}`);
  const slotRef = db.doc(paths.slot);
  const bookingRef = db.doc(paths.booking);
  return db.runTransaction(async (transaction) => {
    const [studio, member, slot, booking] = await Promise.all([transaction.get(studioRef), transaction.get(memberRef), transaction.get(slotRef), transaction.get(bookingRef)]);
    assertActiveStudioMember(studio, member);
    const slotContext = assertAttendanceSlot(slot);
    const role = attendanceRole(principal, member.data()!, slotContext.data);
    if (!canCorrectAttendance(role)) throw new Error("FORBIDDEN_ATTENDANCE_CORRECTION");
    if (!booking.exists || String(booking.data()?.slotId ?? "") !== input.slotId) throw new Error("BOOKING_NOT_FOUND");
    const bookingData = booking.data()!;
    const before = String(bookingData.status ?? "");
    if (!isAttendanceOutcome(before)) throw new Error("ATTENDANCE_NOT_RECORDED");
    if (bookingData.attendanceCorrectionOperationId === input.operationId && before === input.outcome) {
      return { bookingId: bookingRef.id, outcome: input.outcome, idempotent: true };
    }
    if (before === input.outcome) throw new Error("ATTENDANCE_OUTCOME_UNCHANGED");
    const auditRef = db.doc(`studios/${studioId}/auditEvents/attendance-correction-${input.operationId}`);
    if ((await transaction.get(auditRef)).exists) throw new Error("ATTENDANCE_OPERATION_CONFLICT");
    if (before === "attended" && input.outcome === "no-show") await recordIncidentInTransaction(transaction, studioId, principal.uid, { bookingId: bookingRef.id, customerUid: String(bookingData.customerUid ?? ""), type: "no-show", sourceTimestamp: new Date() });
    transaction.update(bookingRef, {
      status: input.outcome,
      attendanceOutcome: input.outcome,
      attendanceCorrectedAt: FieldValue.serverTimestamp(),
      attendanceCorrectedBy: principal.uid,
      attendanceCorrectionReason: input.reason,
      attendanceCorrectionOperationId: input.operationId,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: principal.uid,
    });
    transaction.set(auditRef, audit("attendance.corrected", principal.uid, bookingRef.id, {
      reason: input.reason,
      before: { outcome: before, customerUid: String(bookingData.customerUid ?? "") },
      after: { outcome: input.outcome, slotId: slotRef.id },
    }));
    return { bookingId: bookingRef.id, outcome: input.outcome, idempotent: false };
  });
}
