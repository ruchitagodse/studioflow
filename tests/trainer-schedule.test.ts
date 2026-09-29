import { describe, expect, it } from "vitest";
import { trainerCanSeeSlot, type TrainerSlot } from "../lib/trainer-schedule-logic";

const assignedSlot: TrainerSlot = {
  id: "slot-a", className: "Reformer foundations", trainerUid: "trainer-a", trainerName: "Trainer A", localDate: "2026-10-08", startTime: "09:00", endTime: "09:50", timezone: "Asia/Kolkata", status: "published", startsAt: new Date("2026-10-08T03:30:00.000Z"), endsAt: new Date("2026-10-08T04:20:00.000Z"), capacity: 8, confirmedBookingCount: 2,
};

describe("trainer slot visibility", () => {
  it("shows a non-cancelled slot only to its assigned trainer UID", () => {
    expect(trainerCanSeeSlot("trainer-a", assignedSlot)).toBe(true);
    expect(trainerCanSeeSlot("trainer-b", assignedSlot)).toBe(false);
  });

  it("does not show cancelled or completed slots even to the assigned trainer", () => {
    expect(trainerCanSeeSlot("trainer-a", { ...assignedSlot, status: "cancelled" })).toBe(false);
    expect(trainerCanSeeSlot("trainer-a", { ...assignedSlot, status: "completed" })).toBe(false);
  });
});
