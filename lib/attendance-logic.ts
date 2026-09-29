export const attendanceOutcomes = ["attended", "no-show"] as const;
export type AttendanceOutcome = (typeof attendanceOutcomes)[number];
export type AttendanceWindow = "before" | "open" | "locked";

export function attendanceContextRejection(studioActive: boolean, membershipActive: boolean) {
  if (!studioActive) return "INACTIVE_STUDIO";
  if (!membershipActive) return "MEMBERSHIP_INACTIVE";
  return null;
}

export function attendanceWindow(startsAt: Date, endsAt: Date, now = new Date()): AttendanceWindow {
  if (now.getTime() < startsAt.getTime()) return "before";
  return now.getTime() <= endsAt.getTime() + 30 * 60 * 1000 ? "open" : "locked";
}

export function isAttendanceOutcome(value: string): value is AttendanceOutcome {
  return attendanceOutcomes.some((outcome) => outcome === value);
}

export function isAttendanceCandidate(status: string) {
  return status === "confirmed";
}

export function trainerCanMarkAttendance(actorUid: string, trainerUid: string) {
  return actorUid === trainerUid;
}

export function attendanceRoleForActor(roles: Iterable<string>, actorUid: string, trainerUid: string): "trainer" | "staff" | "owner" | null {
  const assignedRoles = new Set(roles);
  if (assignedRoles.has("owner")) return "owner";
  if (assignedRoles.has("staff")) return "staff";
  return assignedRoles.has("trainer") && trainerCanMarkAttendance(actorUid, trainerUid) ? "trainer" : null;
}

export function attendancePaths(studioId: string, slotId: string, bookingId: string) {
  const root = `studios/${studioId}`;
  return { slot: `${root}/slots/${slotId}`, booking: `${root}/bookings/${bookingId}` };
}

export function attendanceConsumption(availableCredits: number, reservedCredits: number, confirmedBookingCount: number) {
  if (reservedCredits < 1 || confirmedBookingCount < 1) throw new Error("BOOKING_INVALID");
  return {
    availableCredits,
    reservedCredits: reservedCredits - 1,
    confirmedBookingCount: confirmedBookingCount - 1,
  };
}

export function canCorrectAttendance(role: "trainer" | "staff" | "owner") {
  return role === "staff" || role === "owner";
}
