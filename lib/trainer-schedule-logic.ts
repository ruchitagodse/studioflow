export const visibleTrainerSlotStatuses = new Set(["draft", "published", "completed"]);
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
  rosterBookingCount: number;
};

export type TrainerSessionStatus = "pending" | "in-progress" | "completed" | "draft";

/** Presentation-only session state for trainers; it never changes the Slot lifecycle. */
export function trainerSessionStatus(slot: Pick<TrainerSlot, "status" | "startsAt" | "endsAt">, now = new Date()): TrainerSessionStatus {
  if (slot.status === "draft") return "draft";
  if (slot.status === "completed") return "completed";
  if (now.getTime() < slot.startsAt.getTime()) return "pending";
  if (now.getTime() < slot.endsAt.getTime()) return "in-progress";
  return "completed";
}

export function trainerCanSeeSlot(trainerUid: string, slot: Pick<TrainerSlot, "trainerUid" | "status">) {
  return slot.trainerUid === trainerUid && visibleTrainerSlotStatuses.has(slot.status);
}

export function isSlotStatus(status: string): status is SlotStatus {
  return slotStatuses.some((candidate) => candidate === status);
}

/** Active classes first, then pending work, followed by completed session history. */
export function orderTrainerSlots<T extends Pick<TrainerSlot, "startsAt" | "endsAt" | "status">>(slots: T[], now = new Date()): T[] {
  return [...slots].sort((left, right) => {
    const rank = (slot: T) => {
      const sessionStatus = trainerSessionStatus(slot, now);
      if (sessionStatus === "in-progress") return 0;
      if (sessionStatus === "pending" || sessionStatus === "draft") return 1;
      return 2;
    };
    const leftRank = rank(left);
    const rightRank = rank(right);
    if (leftRank !== rightRank) return leftRank - rightRank;
    return leftRank === 1 ? left.startsAt.getTime() - right.startsAt.getTime() : right.startsAt.getTime() - left.startsAt.getTime();
  });
}
