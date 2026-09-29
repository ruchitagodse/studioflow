import { describe, expect, it } from "vitest";
import { attendanceConsumption, attendanceContextRejection, attendancePaths, attendanceRoleForActor, attendanceWindow, canCorrectAttendance, isAttendanceCandidate, isAttendanceOutcome, trainerCanMarkAttendance } from "../lib/attendance-logic";
import { attendanceCorrectionSchema, attendanceMarkSchema } from "../lib/validation";

const startsAt = new Date("2026-10-08T03:30:00.000Z");
const endsAt = new Date("2026-10-08T04:20:00.000Z");
const operationId = "5b2577c5-6648-4d46-b520-c3227605ab4b";
const mark = { slotId: "5b2577c5-6648-4d46-b520-c3227605ab4b", bookingId: "booking-a", outcome: "attended", operationId };

describe("Sprint 6 attendance rules", () => {
  it("opens at the exact slot start and stays open through the inclusive 30-minute boundary", () => {
    expect(attendanceWindow(startsAt, endsAt, new Date("2026-10-08T03:29:59.999Z"))).toBe("before");
    expect(attendanceWindow(startsAt, endsAt, startsAt)).toBe("open");
    expect(attendanceWindow(startsAt, endsAt, new Date("2026-10-08T04:50:00.000Z"))).toBe("open");
    expect(attendanceWindow(startsAt, endsAt, new Date("2026-10-08T04:50:00.001Z"))).toBe("locked");
  });

  it("permits only the two approved factual outcomes", () => {
    expect(isAttendanceOutcome("attended")).toBe(true);
    expect(isAttendanceOutcome("no-show")).toBe(true);
    expect(isAttendanceOutcome("late")).toBe(false);
    expect(attendanceMarkSchema.safeParse(mark).success).toBe(true);
    expect(attendanceMarkSchema.safeParse({ ...mark, outcome: "excused" }).success).toBe(false);
  });

  it("allows an assigned trainer and prevents another trainer from acting on the slot", () => {
    expect(trainerCanMarkAttendance("trainer-a", "trainer-a")).toBe(true);
    expect(trainerCanMarkAttendance("trainer-b", "trainer-a")).toBe(false);
    expect(attendanceRoleForActor(["trainer"], "trainer-a", "trainer-a")).toBe("trainer");
    expect(attendanceRoleForActor(["trainer"], "trainer-b", "trainer-a")).toBeNull();
    expect(attendanceRoleForActor(["staff"], "staff-a", "trainer-a")).toBe("staff");
    expect(attendanceRoleForActor(["owner"], "owner-a", "trainer-a")).toBe("owner");
    expect(attendanceRoleForActor(["customer"], "customer-a", "trainer-a")).toBeNull();
  });

  it("rejects inactive studio or membership context before attendance authorization", () => {
    expect(attendanceContextRejection(false, true)).toBe("INACTIVE_STUDIO");
    expect(attendanceContextRejection(true, false)).toBe("MEMBERSHIP_INACTIVE");
    expect(attendanceContextRejection(true, true)).toBeNull();
  });

  it("limits eligible attendance candidates to current confirmed bookings", () => {
    expect(isAttendanceCandidate("confirmed")).toBe(true);
    expect(isAttendanceCandidate("cancelled-free")).toBe(false);
    expect(isAttendanceCandidate("cancelled-late")).toBe(false);
    expect(isAttendanceCandidate("attended")).toBe(false);
    expect(isAttendanceCandidate("no-show")).toBe(false);
  });

  it("consumes the existing reservation exactly once for both attended and no-show outcomes", () => {
    expect(attendanceConsumption(3, 1, 1)).toEqual({ availableCredits: 3, reservedCredits: 0, confirmedBookingCount: 0 });
    expect(() => attendanceConsumption(3, 0, 0)).toThrow("BOOKING_INVALID");
  });

  it("models a concurrent retry against the post-commit reservation state without double consumption", () => {
    const first = attendanceConsumption(3, 1, 1);
    expect(first.reservedCredits).toBe(0);
    expect(() => attendanceConsumption(first.availableCredits, first.reservedCredits, first.confirmedBookingCount)).toThrow("BOOKING_INVALID");
  });

  it("roots slot and booking targets in the verified studio, preventing cross-studio paths", () => {
    const inStudioA = attendancePaths("studio-a", mark.slotId, mark.bookingId);
    const inStudioB = attendancePaths("studio-b", mark.slotId, mark.bookingId);
    expect(inStudioA.slot).toBe(`studios/studio-a/slots/${mark.slotId}`);
    expect(inStudioA.booking).toBe(`studios/studio-a/bookings/${mark.bookingId}`);
    expect(inStudioA.booking).not.toBe(inStudioB.booking);
  });

  it("allows correction only for staff or owner and always requires a reason", () => {
    expect(canCorrectAttendance("trainer")).toBe(false);
    expect(canCorrectAttendance("staff")).toBe(true);
    expect(canCorrectAttendance("owner")).toBe(true);
    expect(attendanceCorrectionSchema.safeParse({ ...mark, outcome: "no-show", reason: "Customer confirmed they did not attend." }).success).toBe(true);
    expect(attendanceCorrectionSchema.safeParse({ ...mark, outcome: "no-show", reason: "" }).success).toBe(false);
  });
});
