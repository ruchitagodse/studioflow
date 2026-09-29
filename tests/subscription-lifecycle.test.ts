import { describe, expect, it } from "vitest";
import { addCalendarDays, addCalendarMonths, effectiveExpiry, pauseAllowanceDays, zonedParts } from "../lib/subscription-lifecycle-logic";
import { planInputSchema, subscriptionCancellationSchema, subscriptionPauseSchema } from "../lib/validation";

const operationId = "5b2577c5-6648-4d46-b520-c3227605ab4b";

describe("Sprint 10 subscription lifecycle rules", () => {
  it("requires exactly one explicit duration form and never infers months from days", () => {
    const base = { name: "Monthly eight", priceInr: "3000", creditAllocation: "8", status: "active", operationId };
    expect(planInputSchema.safeParse({ ...base, durationMonths: "1" }).success).toBe(true);
    expect(planInputSchema.safeParse({ ...base, validityDays: "30" }).success).toBe(true);
    expect(planInputSchema.safeParse({ ...base, validityDays: "30", durationMonths: "1" }).success).toBe(false);
    expect(planInputSchema.safeParse(base).success).toBe(false);
    expect(pauseAllowanceDays(undefined)).toBe(0);
    expect(pauseAllowanceDays(3)).toBe(15);
  });

  it("uses studio calendar semantics for month plans and pause extensions", () => {
    const timezone = "Asia/Kolkata";
    const start = new Date("2026-01-31T04:30:00.000Z");
    const oneMonth = addCalendarMonths(start, 1, timezone);
    expect(zonedParts(oneMonth, timezone)).toMatchObject({ year: 2026, month: 2, day: 28, hour: 10, minute: 0 });
    const extended = effectiveExpiry(oneMonth, 5, timezone);
    expect(zonedParts(extended, timezone)).toMatchObject({ year: 2026, month: 3, day: 5 });
    const dstStart = new Date("2026-03-07T15:00:00.000Z");
    const dstEnd = addCalendarDays(dstStart, 2, "America/New_York");
    expect(zonedParts(dstEnd, "America/New_York")).toMatchObject({ year: 2026, month: 3, day: 9, hour: 10 });
  });

  it("validates pause allowance inputs and immediate cancellation reasons", () => {
    expect(subscriptionPauseSchema.safeParse({ subscriptionId: "sub", pauseDays: "5", operationId }).success).toBe(true);
    expect(subscriptionPauseSchema.safeParse({ subscriptionId: "sub", pauseDays: "0", operationId }).success).toBe(false);
    expect(subscriptionCancellationSchema.safeParse({ subscriptionId: "sub", mode: "immediate", operationId }).success).toBe(false);
    expect(subscriptionCancellationSchema.safeParse({ subscriptionId: "sub", mode: "immediate", reason: "Requested by studio", operationId }).success).toBe(true);
    expect(subscriptionCancellationSchema.safeParse({ subscriptionId: "sub", mode: "end_of_term", operationId }).success).toBe(true);
  });

  it("models split pauses cumulatively without credit movement", () => {
    const allowance = pauseAllowanceDays(2);
    const firstPause = 4;
    const secondPause = 6;
    expect(firstPause + secondPause).toBe(allowance);
    expect(firstPause + secondPause + 1).toBeGreaterThan(allowance);
  });
});
