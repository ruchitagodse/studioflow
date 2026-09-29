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
