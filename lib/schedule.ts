import "server-only";

import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { promoteWaitlistUntilFull } from "@/lib/waitlist";
import type { Principal } from "@/lib/auth/server";
import { studioLocalInstant } from "@/lib/schedule-time";

const statuses = ["draft", "active", "retired"] as const;
const slotStatuses = ["draft", "published", "cancelled", "completed"] as const;
const classSchema = z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(400).optional(), durationMinutes: z.coerce.number().int().min(15).max(240), status: z.enum(statuses), operationId: z.string().uuid() });
const slotSchema = z.object({ classId: z.string().min(1), localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), startTime: z.string().regex(/^\d{2}:\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/), trainerUid: z.string().min(1), capacity: z.coerce.number().int().min(1).max(100), status: z.enum(slotStatuses), operationId: z.string().uuid() });
const classUpdateSchema = classSchema.omit({ operationId: true }).extend({ classId: z.string().min(1) });
const slotCancelSchema = z.object({ slotId: z.string().min(1) });
const slotUpdateSchema = z.object({
  slotId: z.string().min(1),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  trainerUid: z.string().min(1),
  capacity: z.coerce.number().int().min(1).max(100),
  status: z.enum(slotStatuses),
  operationId: z.string().uuid(),
});

function assertScheduleAuthority(principal: Principal) {
  if (!principal.studioId || !principal.roles.some((role) => role === "owner" || role === "staff")) throw new Error("FORBIDDEN_SCHEDULE");
  return principal.studioId;
}


export async function createClass(principal: Principal, raw: unknown) {
  const studioId = assertScheduleAuthority(principal); const input = classSchema.parse(raw); const db = getAdminDb(); const ref = db.doc(`studios/${studioId}/classes/${input.operationId}`);
  await db.runTransaction(async (tx) => { if ((await tx.get(ref)).exists) return; tx.set(ref, { name: input.name, description: input.description ?? "", durationMinutes: input.durationMinutes, status: input.status, createdAt: FieldValue.serverTimestamp(), createdBy: principal.uid }); tx.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), { action: "class.created", actorUid: principal.uid, targetId: ref.id, createdAt: FieldValue.serverTimestamp(), result: "success" }); });
  return ref.id;
}

export async function createSlot(principal: Principal, raw: unknown) {
  const studioId = assertScheduleAuthority(principal); const input = slotSchema.parse(raw); const db = getAdminDb(); const studio = await db.doc(`studios/${studioId}`).get(); const timezone = studio.data()?.timezone as string | undefined; if (!timezone) throw new Error("STUDIO_TIMEZONE_REQUIRED");
  const [classSnapshot, trainerSnapshot] = await Promise.all([db.doc(`studios/${studioId}/classes/${input.classId}`).get(), db.doc(`studios/${studioId}/members/${input.trainerUid}`).get()]);
  if (!classSnapshot.exists || classSnapshot.data()?.status === "retired") throw new Error("CLASS_UNAVAILABLE"); const trainer = trainerSnapshot.data(); if (!trainerSnapshot.exists || trainer?.status !== "active" || !Array.isArray(trainer.roles) || !trainer.roles.includes("trainer")) throw new Error("TRAINER_NOT_ELIGIBLE");
  const start = studioLocalInstant(input.localDate, input.startTime, timezone); const end = studioLocalInstant(input.localDate, input.endTime, timezone); if (end <= start) throw new Error("SLOT_END_MUST_FOLLOW_START"); if (input.status === "published" && !input.trainerUid) throw new Error("PUBLISHED_SLOT_REQUIRES_TRAINER");
  const ref = db.doc(`studios/${studioId}/slots/${input.operationId}`);
  await db.runTransaction(async (tx) => { if ((await tx.get(ref)).exists) return; const overlap = await tx.get(db.collection(`studios/${studioId}/slots`).where("trainerUid", "==", input.trainerUid).where("status", "in", ["draft", "published"])); if (overlap.docs.some((doc) => { const data = doc.data(); return data.startsAt.toDate() < end && data.endsAt.toDate() > start; })) throw new Error("TRAINER_SLOT_OVERLAP"); tx.set(ref, { classId: classSnapshot.id, className: classSnapshot.data()?.name, trainerUid: input.trainerUid, trainerName: trainer.email ?? "Trainer", capacity: input.capacity, confirmedBookingCount: 0, status: input.status, localDate: input.localDate, startTime: input.startTime, endTime: input.endTime, timezone, startsAt: Timestamp.fromDate(start), endsAt: Timestamp.fromDate(end), createdAt: FieldValue.serverTimestamp(), createdBy: principal.uid }); tx.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), { action: "slot.created", actorUid: principal.uid, targetId: ref.id, createdAt: FieldValue.serverTimestamp(), result: "success" }); });
  return ref.id;
}

export async function updateClass(principal: Principal, raw: unknown) {
  const studioId = assertScheduleAuthority(principal); const input = classUpdateSchema.parse(raw); const db = getAdminDb(); const ref = db.doc(`studios/${studioId}/classes/${input.classId}`);
  await db.runTransaction(async (tx) => { const current = await tx.get(ref); if (!current.exists) throw new Error("CLASS_NOT_FOUND"); const before = current.data(); tx.update(ref, { name: input.name, description: input.description ?? "", durationMinutes: input.durationMinutes, status: input.status, updatedAt: FieldValue.serverTimestamp(), updatedBy: principal.uid }); tx.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), { action: input.status === "retired" ? "class.retired" : "class.updated", actorUid: principal.uid, targetId: ref.id, before: { name: before?.name, status: before?.status }, createdAt: FieldValue.serverTimestamp(), result: "success" }); });
}

export async function updateSlot(principal: Principal, raw: unknown) {
  const studioId = assertScheduleAuthority(principal); const input = slotUpdateSchema.parse(raw); const db = getAdminDb(); const studio = await db.doc(`studios/${studioId}`).get(); const timezone = studio.data()?.timezone as string | undefined;
  if (!timezone) throw new Error("STUDIO_TIMEZONE_REQUIRED");
  const start = studioLocalInstant(input.localDate, input.startTime, timezone); const end = studioLocalInstant(input.localDate, input.endTime, timezone);
  if (end <= start) throw new Error("SLOT_END_MUST_FOLLOW_START");
  const slotRef = db.doc(`studios/${studioId}/slots/${input.slotId}`); const auditRef = db.doc(`studios/${studioId}/auditEvents/${input.operationId}`);
  let capacityIncreased = false;
  await db.runTransaction(async (tx) => {
    const [slotSnapshot, trainerSnapshot, priorAudit] = await Promise.all([tx.get(slotRef), tx.get(db.doc(`studios/${studioId}/members/${input.trainerUid}`)), tx.get(auditRef)]);
    if (priorAudit.exists) return;
    if (!slotSnapshot.exists) throw new Error("SLOT_NOT_FOUND");
    const current = slotSnapshot.data()!;
    if (current.status === "cancelled" || current.status === "completed") throw new Error("SLOT_NOT_EDITABLE");
    const trainer = trainerSnapshot.data();
    if (!trainerSnapshot.exists || trainer?.status !== "active" || !Array.isArray(trainer.roles) || !trainer.roles.includes("trainer")) throw new Error("TRAINER_NOT_ELIGIBLE");
    const confirmedBookingCount = Number(current.confirmedBookingCount ?? 0);
    if (input.capacity < confirmedBookingCount) throw new Error("CAPACITY_BELOW_BOOKINGS");
    const changesBookedExperience = current.localDate !== input.localDate || current.startTime !== input.startTime || current.endTime !== input.endTime || current.trainerUid !== input.trainerUid || current.status !== input.status;
    if (confirmedBookingCount > 0 && changesBookedExperience) throw new Error("SLOT_HAS_BOOKINGS");
    const overlap = await tx.get(db.collection(`studios/${studioId}/slots`).where("trainerUid", "==", input.trainerUid).where("status", "in", ["draft", "published"]));
    if (overlap.docs.some((doc) => { if (doc.id === slotRef.id) return false; const data = doc.data(); return data.startsAt.toDate() < end && data.endsAt.toDate() > start; })) throw new Error("TRAINER_SLOT_OVERLAP");
    tx.update(slotRef, { trainerUid: input.trainerUid, trainerName: trainer.email ?? "Trainer", capacity: input.capacity, status: input.status, localDate: input.localDate, startTime: input.startTime, endTime: input.endTime, timezone, startsAt: Timestamp.fromDate(start), endsAt: Timestamp.fromDate(end), updatedAt: FieldValue.serverTimestamp(), updatedBy: principal.uid });
    capacityIncreased = input.capacity > Number(current.capacity ?? 0) && input.status === "published";
    tx.set(auditRef, { action: "slot.updated", actorUid: principal.uid, targetId: slotRef.id, createdAt: FieldValue.serverTimestamp(), result: "success" });
  });
  if (capacityIncreased) await promoteWaitlistUntilFull(studioId, input.slotId, principal.uid);
}

export async function cancelSlot(principal: Principal, raw: unknown) {
  const studioId = assertScheduleAuthority(principal); const { slotId } = slotCancelSchema.parse(raw); const db = getAdminDb(); const ref = db.doc(`studios/${studioId}/slots/${slotId}`);
  await db.runTransaction(async (tx) => { const slot = await tx.get(ref); if (!slot.exists) throw new Error("SLOT_NOT_FOUND"); if (slot.data()?.status === "cancelled") return; const bookings = await tx.get(db.collection(`studios/${studioId}/bookings`).where("slotId", "==", slotId).limit(1)); if (!bookings.empty) throw new Error("SLOT_HAS_BOOKINGS"); tx.update(ref, { status: "cancelled", cancelledAt: FieldValue.serverTimestamp(), cancelledBy: principal.uid }); tx.set(db.doc(`studios/${studioId}/auditEvents/${randomUUID()}`), { action: "slot.cancelled", actorUid: principal.uid, targetId: slotId, createdAt: FieldValue.serverTimestamp(), result: "success" }); });
}

export { classSchema, slotSchema, slotUpdateSchema, studioLocalInstant };
