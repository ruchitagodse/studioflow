import { describe, expect, it } from "vitest";
import { bookingDocumentId, bookingPaths, bookingRejection, canReschedule, cancellationBalances, cancellationKind, hasActiveBooking, isIdempotentBookingRetry, remainingSlotCapacity, reservationBalance, reservationRemainsValidAfterSubscriptionExpiry, rescheduledBookingCounts, type BookingCheck } from "../lib/booking-logic";

const now = new Date("2026-09-25T10:00:00.000Z");
const base: BookingCheck = {
  studioActive: true,
  membershipActive: true,
  hasCustomerRole: true,
  slotPublished: true,
  slotStartsAt: new Date("2026-09-26T10:00:00.000Z"),
  capacity: 2,
  confirmedBookingCount: 0,
  hasExistingBooking: false,
  subscriptionActive: true,
  subscriptionEndsAt: new Date("2026-09-30T10:00:00.000Z"),
  availableCredits: 2,
};

describe("Sprint 4 customer booking rules", () => {
  it("allows a valid customer booking and reserves exactly one credit", () => {
    expect(bookingRejection(base, now)).toBeNull();
    expect(reservationBalance(base.availableCredits)).toBe(1);
  });

  it("uses the confirmed booking count as the single capacity source", () => {
    expect(remainingSlotCapacity(8, 0)).toBe(8);
    expect(remainingSlotCapacity(8, 1)).toBe(7);
    expect(remainingSlotCapacity(8, 2)).toBe(6);
    expect(remainingSlotCapacity(8, 10)).toBe(0);
  });

  it("rejects a duplicate booking and provides stable booking identity for a retry", () => {
    expect(bookingRejection({ ...base, hasExistingBooking: true }, now)).toBe("ALREADY_BOOKED");
    expect(bookingDocumentId("b3d1c4a6-0000-4000-8000-000000000001", "customer-a")).not.toBe(bookingDocumentId("b3d1c4a6-0000-4000-8000-000000000001", "customer-b"));
    expect(isIdempotentBookingRetry("ac253cf0-6c97-4703-b42b-6b0a42d0966f", "ac253cf0-6c97-4703-b42b-6b0a42d0966f")).toBe(true);
    expect(isIdempotentBookingRetry("ac253cf0-6c97-4703-b42b-6b0a42d0966f", "c6e19b91-7259-4cb6-8c98-2a22c0c354e4")).toBe(false);
  });

  it("allows a new operation after a cancelled booking while preserving active-booking protection", () => {
    const slotId = "b3d1c4a6-0000-4000-8000-000000000001";
    const firstOperation = "ac253cf0-6c97-4703-b42b-6b0a42d0966f";
    const rebookOperation = "c6e19b91-7259-4cb6-8c98-2a22c0c354e4";
    expect(bookingDocumentId(slotId, "customer-a", firstOperation)).not.toBe(bookingDocumentId(slotId, "customer-a", rebookOperation));
    expect(hasActiveBooking(["cancelled-free"])).toBe(false);
    expect(hasActiveBooking(["cancelled-late", "voided"])).toBe(false);
    expect(hasActiveBooking(["cancelled-free", "confirmed"])).toBe(true);
  });

  it("uses the verified studio collection root for every slot and booking target", () => {
    const slotId = "b3d1c4a6-0000-4000-8000-000000000001";
    const inStudioA = bookingPaths("studio-a", slotId, "customer-a");
    const inStudioB = bookingPaths("studio-b", slotId, "customer-a");
    expect(inStudioA.slot).toBe("studios/studio-a/slots/b3d1c4a6-0000-4000-8000-000000000001");
    expect(inStudioA.booking).not.toBe(inStudioB.booking);
  });

  it("rejects new bookings without usable credit or a valid active subscription", () => {
    expect(bookingRejection({ ...base, availableCredits: 0 }, now)).toBe("NO_AVAILABLE_CREDIT");
    expect(bookingRejection({ ...base, subscriptionActive: false }, now)).toBe("NO_ACTIVE_SUBSCRIPTION");
    expect(bookingRejection({ ...base, subscriptionEndsAt: now }, now)).toBe("SUBSCRIPTION_EXPIRED");
  });

  it("rejects a full class, a started class, and a non-customer or inactive tenant", () => {
    expect(bookingRejection({ ...base, confirmedBookingCount: 2 }, now)).toBe("SLOT_FULL");
    expect(bookingRejection({ ...base, slotStartsAt: now }, now)).toBe("SLOT_STARTED");
    expect(bookingRejection({ ...base, hasCustomerRole: false }, now)).toBe("FORBIDDEN_CUSTOMER");
    expect(bookingRejection({ ...base, studioActive: false }, now)).toBe("INACTIVE_STUDIO");
  });

  it("allows only one final-seat reservation when the trusted transaction rereads capacity", () => {
    const finalSeat = { ...base, capacity: 1, confirmedBookingCount: 0, availableCredits: 1 };
    expect(bookingRejection(finalSeat, now)).toBeNull();
    const afterFirstCommit = { ...finalSeat, confirmedBookingCount: 1, availableCredits: reservationBalance(finalSeat.availableCredits) };
    expect(bookingRejection(afterFirstCommit, now)).toBe("SLOT_FULL");
  });

  it("keeps a valid reservation after the subscription expires before class", () => {
    expect(reservationRemainsValidAfterSubscriptionExpiry(
      new Date("2026-09-25T10:00:00.000Z"),
      new Date("2026-09-26T10:00:00.000Z"),
      new Date("2026-09-27T10:00:00.000Z"),
    )).toBe(true);
  });

  it("classifies the exact two-hour boundary as a free cancellation", () => {
    const startsAt = new Date("2026-09-26T10:00:00.000Z");
    expect(cancellationKind(startsAt, new Date("2026-09-26T07:59:59.999Z"))).toBe("free");
    expect(cancellationKind(startsAt, new Date("2026-09-26T08:00:00.000Z"))).toBe("free");
    expect(cancellationKind(startsAt, new Date("2026-09-26T08:00:00.001Z"))).toBe("late");
    expect(cancellationKind(startsAt, startsAt)).toBe("unavailable");
  });

  it("allows rescheduling only through the inclusive free-cancellation cutoff", () => {
    const startsAt = new Date("2026-09-26T10:00:00.000Z");
    expect(canReschedule(startsAt, new Date("2026-09-26T08:00:00.000Z"))).toBe(true);
    expect(canReschedule(startsAt, new Date("2026-09-26T08:00:00.001Z"))).toBe(false);
    expect(canReschedule(startsAt, startsAt)).toBe(false);
  });

  it("models cancellation as one reservation resolution, not a second reservation", () => {
    const availableBeforeReservation = 8;
    const availableAfterReservation = reservationBalance(availableBeforeReservation);
    const availableAfterFreeCancellation = availableAfterReservation + 1;
    const availableAfterLateCancellation = availableAfterReservation;
    expect(availableAfterFreeCancellation).toBe(8);
    expect(availableAfterLateCancellation).toBe(7);
  });

  it("returns a free-cancellation credit and capacity exactly once", () => {
    expect(cancellationBalances("free", 7, 1, 1)).toEqual({ availableCredits: 8, reservedCredits: 0, confirmedBookingCount: 0 });
  });

  it("supports a free-cancel then rebook balance and capacity sequence", () => {
    const cancelled = cancellationBalances("free", 7, 1, 1);
    const rebookedCredits = reservationBalance(cancelled.availableCredits);
    expect(rebookedCredits).toBe(7);
    expect(cancelled.confirmedBookingCount + 1).toBe(1);
    expect(remainingSlotCapacity(8, cancelled.confirmedBookingCount + 1)).toBe(7);
  });

  it("consumes a late-cancellation reservation without returning usable credit", () => {
    expect(cancellationBalances("late", 7, 1, 1)).toEqual({ availableCredits: 7, reservedCredits: 0, confirmedBookingCount: 0 });
  });

  it("moves one confirmed seat atomically and leaves a full target unchanged", () => {
    expect(rescheduledBookingCounts(1, 2, 3)).toEqual({ originalConfirmedBookingCount: 0, targetConfirmedBookingCount: 3 });
    expect(() => rescheduledBookingCounts(1, 3, 3)).toThrow("SLOT_FULL");
  });
});
