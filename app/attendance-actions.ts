"use server";

import { revalidatePath } from "next/cache";
import { getCurrentPrincipal } from "@/lib/auth/server";
import { correctAttendance, markAttendance } from "@/lib/attendance";

export type AttendanceActionState = { error?: string; success?: string };

function message(error: unknown) {
  const code = error instanceof Error ? error.message : "We could not save attendance. Please try again.";
  if (error instanceof Error && error.name === "ZodError") return "Choose a valid attendance outcome and provide any required reason.";
  return ({
    NO_ACTIVE_SESSION: "Please sign in again before recording attendance.",
    INACTIVE_STUDIO: "This studio is not active, so attendance cannot be changed.",
    MEMBERSHIP_INACTIVE: "Your studio access is not active.",
    FORBIDDEN_ATTENDANCE: "You do not have access to this class attendance.",
    FORBIDDEN_ATTENDANCE_CORRECTION: "Only studio staff or the owner can correct attendance.",
    SLOT_UNAVAILABLE: "This class is no longer available for attendance.",
    BOOKING_NOT_FOUND: "This booking is no longer available for attendance.",
    BOOKING_NOT_ATTENDANCE_ELIGIBLE: "Only a current confirmed booking can receive attendance.",
    ATTENDANCE_NOT_OPEN: "Attendance opens at the scheduled class start time.",
    ATTENDANCE_LOCKED: "Attendance is locked. Ask studio staff or the owner to correct an existing outcome.",
    ATTENDANCE_ALREADY_RECORDED: "Attendance has already been recorded for this booking.",
    ATTENDANCE_NOT_RECORDED: "There is no attendance outcome to correct.",
    ATTENDANCE_OUTCOME_UNCHANGED: "Choose a different outcome to make a correction.",
    ATTENDANCE_OPERATION_CONFLICT: "This attendance update is already being processed. Refresh and try again.",
    BOOKING_INVALID: "This booking could not be safely updated. Please contact the studio.",
  } as Record<string, string>)[code] ?? code;
}

function revalidateAttendanceViews(slotId: string) {
  revalidatePath("/trainer");
  revalidatePath("/trainer/attendance");
  revalidatePath(`/trainer/slots/${slotId}`);
  revalidatePath(`/studio/attendance/${slotId}`);
  revalidatePath("/studio/schedule");
  revalidatePath("/customer/bookings");
}

async function principalForAttendance() {
  const principal = await getCurrentPrincipal();
  if (!principal) throw new Error("NO_ACTIVE_SESSION");
  return principal;
}

export async function markAttendanceAction(_: AttendanceActionState, form: FormData): Promise<AttendanceActionState> {
  try {
    const result = await markAttendance(await principalForAttendance(), Object.fromEntries(form));
    revalidateAttendanceViews(String(form.get("slotId") ?? ""));
    return { success: result.idempotent ? "Attendance was already recorded." : result.outcome === "attended" ? "Marked attended. The reserved credit was consumed." : "Marked no-show. The reserved credit was consumed." };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function correctAttendanceAction(_: AttendanceActionState, form: FormData): Promise<AttendanceActionState> {
  try {
    const result = await correctAttendance(await principalForAttendance(), Object.fromEntries(form));
    revalidateAttendanceViews(String(form.get("slotId") ?? ""));
    return { success: result.idempotent ? "This correction was already recorded." : `Attendance corrected to ${result.outcome === "no-show" ? "no-show" : "attended"}.` };
  } catch (error) {
    return { error: message(error) };
  }
}
