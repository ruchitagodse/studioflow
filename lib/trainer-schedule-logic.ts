export const visibleTrainerSlotStatuses = new Set(["draft", "published"]);
export const slotStatuses = ["draft", "published", "cancelled", "completed"] as const;
export type SlotStatus = (typeof slotStatuses)[number];

export type TrainerSlot = {
  id: string;
  className: string;
  trainerUid: string;
  trainerName: string;
  localDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  status: SlotStatus;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  confirmedBookingCount: number;
};

export function trainerCanSeeSlot(trainerUid: string, slot: Pick<TrainerSlot, "trainerUid" | "status">) {
  return slot.trainerUid === trainerUid && visibleTrainerSlotStatuses.has(slot.status);
}

export function isSlotStatus(status: string): status is SlotStatus {
  return slotStatuses.some((candidate) => candidate === status);
}

/** Upcoming classes are most useful first; recent past classes remain available below them. */
export function orderTrainerSlots<T extends Pick<TrainerSlot, "startsAt">>(slots: T[], now = new Date()): T[] {
  return [...slots].sort((left, right) => {
    const leftFuture = left.startsAt.getTime() >= now.getTime();
    const rightFuture = right.startsAt.getTime() >= now.getTime();
    if (leftFuture !== rightFuture) return leftFuture ? -1 : 1;
    return leftFuture ? left.startsAt.getTime() - right.startsAt.getTime() : right.startsAt.getTime() - left.startsAt.getTime();
  });
}
