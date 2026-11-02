import { describe, expect, it } from "vitest";
import { scheduleWindow } from "../lib/schedule-window";

describe("bounded studio schedule periods", () => {
  it("loads only the requested calendar month across a year boundary", () => {
    expect(scheduleWindow("2026-12-31", "2026-11-02", "month")).toEqual({ date: "2026-12-31", view: "month", start: "2026-12-01", end: "2027-01-01" });
  });
  it("loads a Monday-to-Monday week even when it crosses months", () => {
    expect(scheduleWindow("2026-11-01", "2026-11-02", "week")).toMatchObject({ start: "2026-10-26", end: "2026-11-02" });
  });
  it("loads a single studio-local date", () => {
    expect(scheduleWindow("2026-11-02", "2026-11-02", "day")).toMatchObject({ start: "2026-11-02", end: "2026-11-03" });
  });
  it("rejects invalid dates and unknown periods", () => {
    expect(scheduleWindow("2026-02-30", "2026-11-02", "all")).toMatchObject({ date: "2026-11-02", view: "month" });
  });
});
