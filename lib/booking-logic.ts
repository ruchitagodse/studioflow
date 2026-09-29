export type BookingCheck = {
  studioActive: boolean;
  membershipActive: boolean;
  hasCustomerRole: boolean;
  slotPublished: boolean;
  slotStartsAt: Date;
  capacity: number;
  confirmedBookingCount: number;
  hasExistingBooking: boolean;
  subscriptionActive: boolean;
  subscriptionEndsAt: Date | null;
  availableCredits: number;
};

export type BookingRejection =
  | "INACTIVE_STUDIO"
  | "MEMBERSHIP_INACTIVE"
  | "FORBIDDEN_CUSTOMER"
  | "SLOT_UNAVAILABLE"
  | "SLOT_STARTED"
  | "SLOT_FULL"
  | "ALREADY_BOOKED"
  | "NO_ACTIVE_SUBSCRIPTION"
  | "SUBSCRIPTION_EXPIRED"
  | "NO_AVAILABLE_CREDIT";

export function bookingRejection(check: BookingCheck, now = new Date()): BookingRejection | null {
  if (!check.studioActive) return "INACTIVE_STUDIO";
  if (!check.membershipActive) return "MEMBERSHIP_INACTIVE";
  if (!check.hasCustomerRole) return "FORBIDDEN_CUSTOMER";
  if (!check.slotPublished) return "SLOT_UNAVAILABLE";
  if (check.slotStartsAt.getTime() <= now.getTime()) return "SLOT_STARTED";
  if (check.confirmedBookingCount >= check.capacity) return "SLOT_FULL";
  if (check.hasExistingBooking) return "ALREADY_BOOKED";
  if (!check.subscriptionActive || !check.subscriptionEndsAt) return "NO_ACTIVE_SUBSCRIPTION";
  if (check.subscriptionEndsAt.getTime() <= now.getTime()) return "SUBSCRIPTION_EXPIRED";
  if (check.availableCredits < 1) return "NO_AVAILABLE_CREDIT";
  return null;
}

export function bookingDocumentId(slotId: string, customerUid: string, operationId?: string) {
  return operationId ? `${slotId}_${customerUid}_${operationId}` : `${slotId}_${customerUid}`;
}

export function bookingPaths(studioId: string, slotId: string, customerUid: string, operationId?: string) {
  const root = `studios/${studioId}`;
  return {
    slot: `${root}/slots/${slotId}`,
    booking: `${root}/bookings/${bookingDocumentId(slotId, customerUid, operationId)}`,
  };
}

export function hasActiveBooking(statuses: Iterable<string>) {
  return Array.from(statuses).some((status) => status === "confirmed");
}

export function reservationBalance(balance: number) {
  if (balance < 1) throw new Error("NO_AVAILABLE_CREDIT");
  return balance - 1;
}

/** Shared display calculation; confirmedBookingCount remains the trusted source. */
export function remainingSlotCapacity(capacity: number, confirmedBookingCount: number) {
  return Math.max(0, capacity - confirmedBookingCount);
}

export function isIdempotentBookingRetry(existingOperationId: string | undefined, operationId: string) {
  return existingOperationId === operationId;
}

export function reservationRemainsValidAfterSubscriptionExpiry(confirmedAt: Date, subscriptionEndsAt: Date, slotStartsAt: Date) {
  return confirmedAt.getTime() < subscriptionEndsAt.getTime() && subscriptionEndsAt.getTime() < slotStartsAt.getTime();
}

export type CancellationKind = "free" | "late" | "unavailable";

export function cancellationKind(slotStartsAt: Date, now = new Date()): CancellationKind {
  if (now.getTime() >= slotStartsAt.getTime()) return "unavailable";
  return now.getTime() <= slotStartsAt.getTime() - 2 * 60 * 60 * 1000 ? "free" : "late";
}

export function canReschedule(slotStartsAt: Date, now = new Date()) {
  return now.getTime() <= slotStartsAt.getTime() - 2 * 60 * 60 * 1000;
}

export function cancellationBalances(kind: Exclude<CancellationKind, "unavailable">, availableCredits: number, reservedCredits: number, confirmedBookingCount: number) {
  if (reservedCredits < 1 || confirmedBookingCount < 1) throw new Error("BOOKING_INVALID");
  return {
    availableCredits: kind === "free" ? availableCredits + 1 : availableCredits,
    reservedCredits: reservedCredits - 1,
    confirmedBookingCount: confirmedBookingCount - 1,
  };
}

export function rescheduledBookingCounts(originalConfirmedBookingCount: number, targetConfirmedBookingCount: number, targetCapacity: number) {
  if (originalConfirmedBookingCount < 1) throw new Error("BOOKING_INVALID");
  if (targetConfirmedBookingCount >= targetCapacity) throw new Error("SLOT_FULL");
  return { originalConfirmedBookingCount: originalConfirmedBookingCount - 1, targetConfirmedBookingCount: targetConfirmedBookingCount + 1 };
}
