import { describe, expect, it } from "vitest";
import { calendarWeek, shiftCalendarDate } from "../lib/customer-calendar";
import { resolveTheme, studioThemes } from "../lib/theme";
import { studioThemeSchema } from "../lib/validation";

describe("studio calendar dates", () => {
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
