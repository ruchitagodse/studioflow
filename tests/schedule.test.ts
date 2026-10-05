import { describe, expect, it } from "vitest";
import { isFutureSlotStart, studioLocalInstant } from "../lib/schedule-time";
describe("studio schedule time", () => {
  it("converts a studio-local India time to a stable instant", () => expect(studioLocalInstant("2026-10-08", "09:00", "Asia/Kolkata").toISOString()).toBe("2026-10-08T03:30:00.000Z"));
  it("rejects a nonexistent local time during DST spring-forward", () => expect(() => studioLocalInstant("2026-03-08", "02:30", "America/New_York")).toThrow("NONEXISTENT_STUDIO_TIME"));
  it("accepts only starts strictly after the current instant", () => {
    const now = new Date("2026-10-05T04:30:00.000Z");
    expect(isFutureSlotStart(new Date("2026-10-05T04:30:00.000Z"), now)).toBe(false);
    expect(isFutureSlotStart(new Date("2026-10-05T04:30:00.001Z"), now)).toBe(true);
  });
});
