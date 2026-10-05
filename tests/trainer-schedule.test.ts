import { describe, expect, it } from "vitest";
import { orderTrainerSlots, trainerCanSeeSlot, trainerSessionStatus, type TrainerSlot } from "../lib/trainer-schedule-logic";

const assignedSlot: TrainerSlot = {
  id: "slot-a", className: "Reformer foundations", trainerUid: "trainer-a", trainerName: "Trainer A", localDate: "2026-10-08", startTime: "09:00", endTime: "09:50", timezone: "Asia/Kolkata", status: "published", startsAt: new Date("2026-10-08T03:30:00.000Z"), endsAt: new Date("2026-10-08T04:20:00.000Z"), capacity: 8, confirmedBookingCount: 2, rosterBookingCount: 2,
};

describe("trainer slot visibility", () => {
  it("shows a non-cancelled slot only to its assigned trainer UID", () => {
    expect(trainerCanSeeSlot("trainer-a", assignedSlot)).toBe(true);
    expect(trainerCanSeeSlot("trainer-b", assignedSlot)).toBe(false);
  });

  it("shows completed slots but excludes cancelled slots from the trainer schedule", () => {
    expect(trainerCanSeeSlot("trainer-a", { ...assignedSlot, status: "cancelled" })).toBe(false);
    expect(trainerCanSeeSlot("trainer-a", { ...assignedSlot, status: "completed" })).toBe(true);
  });

  it("puts active sessions first, then pending classes, then completed history", () => {
    const now = new Date("2026-10-08T03:30:00.000Z");
    const ordered = orderTrainerSlots([
      { ...assignedSlot, id: "past-old", startsAt: new Date("2026-10-06T03:30:00.000Z"), endsAt: new Date("2026-10-06T04:20:00.000Z") },
      { ...assignedSlot, id: "future-later", startsAt: new Date("2026-10-10T03:30:00.000Z") },
      { ...assignedSlot, id: "past-recent", startsAt: new Date("2026-10-07T03:30:00.000Z"), endsAt: new Date("2026-10-07T04:20:00.000Z") },
      { ...assignedSlot, id: "active", startsAt: new Date("2026-10-08T03:00:00.000Z"), endsAt: new Date("2026-10-08T04:00:00.000Z") },
      { ...assignedSlot, id: "future-next", startsAt: new Date("2026-10-09T03:30:00.000Z") },
    ], now);
    expect(ordered.map((slot) => slot.id)).toEqual(["active", "future-next", "future-later", "past-recent", "past-old"]);
  });

  it("derives a trainer-facing session label without changing the slot lifecycle", () => {
    expect(trainerSessionStatus(assignedSlot, new Date("2026-10-08T03:00:00.000Z"))).toBe("pending");
    expect(trainerSessionStatus(assignedSlot, new Date("2026-10-08T03:45:00.000Z"))).toBe("in-progress");
    expect(trainerSessionStatus(assignedSlot, new Date("2026-10-08T04:30:00.000Z"))).toBe("completed");
    expect(trainerSessionStatus({ ...assignedSlot, status: "completed" }, new Date("2026-10-08T04:30:00.000Z"))).toBe("completed");
  });
});
