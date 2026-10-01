"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/auth/server";
import { cancelCustomerBooking, createBooking, rescheduleCustomerBooking } from "@/lib/bookings";

export type BookingActionState = { error?: string; success?: string; bookingId?: string };

function message(error: unknown) {
  const code = error instanceof Error ? error.message : "We could not complete that booking. Please try again.";
  if (error instanceof Error && error.name === "ZodError") return "Please choose a valid class and try again.";
  if (code.includes("FAILED_PRECONDITION")) return "We’re updating the studio booking service. Please try again shortly.";
  return ({
    NO_ACTIVE_SESSION: "Please sign in again before booking.",
    FORBIDDEN_WORKSPACE: "You do not have access to book for this studio.",
    FORBIDDEN_CUSTOMER: "You do not have customer access for this studio.",
    INACTIVE_STUDIO: "This studio is not currently accepting bookings.",
    MEMBERSHIP_INACTIVE: "Your studio access is not active.",
    SLOT_UNAVAILABLE: "This class is no longer available for booking.",
    SLOT_STARTED: "This class has already started and can no longer be booked.",
    SLOT_FULL: "This class just filled. Please choose another available class.",
    ALREADY_BOOKED: "You already have a booking for this class.",
    NO_ACTIVE_SUBSCRIPTION: "An active subscription is required to book a class.",
    SUBSCRIPTION_EXPIRED: "Your subscription has expired and cannot be used for a new booking.",
    NO_AVAILABLE_CREDIT: "You do not have an available credit for this booking.",
    BOOKING_NOT_FOUND: "This booking is no longer available.",
    BOOKING_NOT_CANCELLABLE: "This booking can no longer be cancelled.",
    BOOKING_NOT_RESCHEDULABLE: "This booking can no longer be rescheduled.",
    CANCELLATION_AFTER_START: "This class has already started and can no longer be cancelled or rescheduled.",
    RESCHEDULE_CUTOFF_PASSED: "Rescheduling is available until two hours before your class starts.",
    RESCHEDULE_SAME_SLOT: "Choose a different class to reschedule.",
    BOOKING_INVALID: "This booking could not be safely updated. Please contact your studio.",
  } as Record<string, string>)[code] ?? code;
}

function revalidateCustomerBookingViews() {
  revalidatePath("/customer"); revalidatePath("/customer/bookings"); revalidatePath("/customer/entitlements"); revalidatePath("/studio/schedule");
}

export async function createBookingAction(_: BookingActionState, form: FormData): Promise<BookingActionState> {
  try {
    const principal = await requireWorkspace("/customer");
    const result = await createBooking(principal, Object.fromEntries(form));
    revalidatePath("/customer");
    revalidatePath("/customer/bookings");
    revalidatePath(`/customer/slots/${String(form.get("slotId") ?? "")}`);
    return {
      success: result.idempotent ? "Your booking is already confirmed." : "Your class is booked. One credit has been reserved.",
      bookingId: result.bookingId,
    };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function cancelBookingAction(_: BookingActionState, form: FormData): Promise<BookingActionState> {
  try {
    const principal = await requireWorkspace("/customer"); const result = await cancelCustomerBooking(principal, Object.fromEntries(form)); revalidateCustomerBookingViews();
    return { success: result.kind === "free" ? "Your booking was cancelled and your credit was returned." : "Your booking was cancelled. This late cancellation consumed your reserved credit.", bookingId: result.bookingId };
  } catch (error) { return { error: message(error) }; }
}

export async function rescheduleBookingAction(_: BookingActionState, form: FormData): Promise<BookingActionState> {
  try {
    const principal = await requireWorkspace("/customer"); const result = await rescheduleCustomerBooking(principal, Object.fromEntries(form)); revalidateCustomerBookingViews();
    return { success: result.idempotent ? "Your reschedule is already confirmed." : "Your booking has been rescheduled. Your reserved credit moved with it.", bookingId: result.bookingId };
  } catch (error) { return { error: message(error) }; }
}
