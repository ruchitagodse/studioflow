import { describe, expect, it } from "vitest";
import { adjustedBalance, canAssignSubscription, isSubscriptionExpired, usableCredits } from "../lib/entitlement-logic";
import { creditAdjustmentSchema, planInputSchema, subscriptionAssignmentSchema } from "../lib/validation";

describe("Sprint 3 entitlement rules", () => {
  it("accepts only fixed-credit plan input with an informational INR price", () => {
    expect(planInputSchema.safeParse({ name: "Eight classes", priceInr: "3000.00", creditAllocation: "8", validityDays: "30", status: "active", operationId: "5b2577c5-6648-4d46-b520-c3227605ab4b" }).success).toBe(true);
    expect(planInputSchema.safeParse({ name: "Eight classes", priceInr: "3000.001", creditAllocation: "8", validityDays: "30", status: "active", operationId: "5b2577c5-6648-4d46-b520-c3227605ab4b" }).success).toBe(false);
  });

  it("keeps one active subscription as the assignment invariant", () => {
    expect(canAssignSubscription(0)).toBe(true);
    expect(canAssignSubscription(1)).toBe(false);
    expect(subscriptionAssignmentSchema.safeParse({ customerUid: "customer", planId: "plan", operationId: "5b2577c5-6648-4d46-b520-c3227605ab4b" }).success).toBe(true);
  });

  it("does not expose expired or inactive credits and never permits a negative balance", () => {
    const now = new Date("2026-09-25T10:00:00.000Z");
    expect(usableCredits("active", new Date("2026-09-26T10:00:00.000Z"), 8, now)).toBe(8);
    expect(usableCredits("active", new Date("2026-09-25T10:00:00.000Z"), 8, now)).toBe(0);
    expect(usableCredits("inactive", new Date("2026-09-26T10:00:00.000Z"), 8, now)).toBe(0);
    expect(isSubscriptionExpired(new Date(0))).toBe(true);
    expect(adjustedBalance(3, -2)).toBe(1);
    expect(() => adjustedBalance(3, -4)).toThrow("NEGATIVE_CREDIT_BALANCE");
    expect(creditAdjustmentSchema.safeParse({ subscriptionId: "subscription", amount: "0", reason: "Correction", operationId: "5b2577c5-6648-4d46-b520-c3227605ab4b" }).success).toBe(false);
  });
});
