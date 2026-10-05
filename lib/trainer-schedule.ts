import "server-only";

import type { Principal } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { isSlotStatus, orderTrainerSlots, trainerCanSeeSlot, type TrainerSlot } from "@/lib/trainer-schedule-logic";

export type { TrainerSlot } from "@/lib/trainer-schedule-logic";

function requireTrainer(principal: Principal) {
  if (!principal.studioId || !principal.roles.includes("trainer")) throw new Error("FORBIDDEN_TRAINER_SCHEDULE");
  return principal.studioId;
}

export async function getAssignedTrainerSlots(principal: Principal): Promise<TrainerSlot[]> {
  const studioId = requireTrainer(principal);
  const db = getAdminDb();
  const [docs, trainer] = await Promise.all([db.collection(`studios/${studioId}/slots`).where("trainerUid", "==", principal.uid).limit(100).get(), db.doc(`studios/${studioId}/members/${principal.uid}`).get()]);
  const trainerName = String(trainer.data()?.displayName ?? "").trim();
  const slots = docs.docs.map((doc) => {
    const data = doc.data();
    const status = String(data.status ?? "");
    if (!isSlotStatus(status)) return null;
    return {
      id: doc.id,
      className: String(data.className ?? "Class"),
      trainerUid: String(data.trainerUid),
      trainerName: trainerName || "Trainer",
      localDate: String(data.localDate ?? ""),
      startTime: String(data.startTime ?? ""),
      endTime: String(data.endTime ?? ""),
      timezone: String(data.timezone ?? ""),
      status,
      startsAt: data.startsAt.toDate() as Date,
      endsAt: data.endsAt.toDate() as Date,
      capacity: Number(data.capacity ?? 0),
      confirmedBookingCount: Number(data.confirmedBookingCount ?? 0),
      rosterBookingCount: 0,
    };
  }).filter((slot): slot is TrainerSlot => slot !== null && trainerCanSeeSlot(principal.uid, slot));
  const rosterCounts = new Map<string, number>();
  await Promise.all(slots.map(async (slot) => {
    const bookings = await db.collection(`studios/${studioId}/bookings`).where("slotId", "==", slot.id).limit(Math.max(slot.capacity + 1, 1)).get();
    rosterCounts.set(slot.id, bookings.docs.filter((booking) => ["confirmed", "attended", "no-show"].includes(String(booking.data().status ?? ""))).length);
  }));
  return orderTrainerSlots(slots.map((slot) => ({ ...slot, rosterBookingCount: rosterCounts.get(slot.id) ?? 0 })));
}
