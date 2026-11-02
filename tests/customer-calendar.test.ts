import { describe, expect, it } from "vitest";
import { calendarWeek, shiftCalendarDate, upcomingCalendarDays } from "../lib/customer-calendar";
import { resolveTheme, studioThemes } from "../lib/theme";
import { studioThemeSchema } from "../lib/validation";

describe("studio calendar dates", () => {
  it("starts on studio-local today instead of showing the passed days of the week", () => {
    expect(upcomingCalendarDays("2026-11-01", "2026-11-01")).toEqual(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"]);
  });
  it("clamps previous navigation and stale anchors to today", () => {
    expect(upcomingCalendarDays("2026-10-25", "2026-11-01")[0]).toBe("2026-11-01");
  });
  it("allows future weeks across the year boundary", () => {
    const days = upcomingCalendarDays("2026-12-28", "2026-11-01");
    expect(days[0]).toBe("2026-12-28");
    expect(days[6]).toBe("2027-01-03");
  });
  it("keeps Sunday in its Monday-start week across month boundaries", () => {
    expect(calendarWeek("2026-11-01")).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
  });
  it("navigates across a leap day and year boundary", () => {
    expect(shiftCalendarDate("2028-02-28", 1)).toBe("2028-02-29");
    expect(shiftCalendarDate("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("Ember Dark appearance", () => {
  it("defaults to Ember and accepts it at the trusted settings boundary", () => {
    expect(resolveTheme(undefined)).toBe("ember-dark");
    expect(studioThemeSchema.parse({ studioId: "studio", theme: "ember-dark" }).theme).toBe("ember-dark");
    expect(studioThemes[resolveTheme(undefined)].background).toBe("#121617");
  });
  it("preserves explicitly chosen studio themes", () => {
    expect(resolveTheme("nature-minimal")).toBe("nature-minimal");
    expect(resolveTheme("dark-modern")).toBe("dark-modern");
  });
});
