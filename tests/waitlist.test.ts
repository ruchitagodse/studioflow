import { describe, expect, it } from "vitest";
import { canJoinWaitlist, waitlistEntryId, waitlistPosition } from "../lib/waitlist-logic";
const eligible = { studioActive: true, memberActive: true, customer: true, published: true, full: true, future: true, subscriptionActive: true, usableCredits: 1 };
describe("Sprint 8 waitlist rules", () => {
  it("requires a full published future slot and current customer entitlement", () => {
    expect(canJoinWaitlist(eligible)).toBe(true);
    expect(canJoinWaitlist({ ...eligible, full: false })).toBe(false);
    expect(canJoinWaitlist({ ...eligible, usableCredits: 0 })).toBe(false);
    expect(canJoinWaitlist({ ...eligible, memberActive: false })).toBe(false);
  });
  it("uses deterministic one-entry identity", () => {
    expect(waitlistEntryId("slot-a", "customer-a")).toBe(waitlistEntryId("slot-a", "customer-a"));
    expect(waitlistEntryId("slot-a", "customer-a")).not.toBe(waitlistEntryId("slot-a", "customer-b"));
  });
  it("calculates FIFO position dynamically with document identity tie-break", () => {
    const now = new Date("2026-10-01T10:00:00.000Z");
    const entries = [{ id: "b", createdAt: now, status: "active" }, { id: "a", createdAt: now, status: "active" }, { id: "z", createdAt: now, status: "withdrawn" }];
    expect(waitlistPosition(entries, "a")).toBe(1);
    expect(waitlistPosition(entries, "b")).toBe(2);
    expect(waitlistPosition(entries, "z")).toBe(0);
  });
});
