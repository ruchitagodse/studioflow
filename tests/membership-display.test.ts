import { describe, expect, it } from "vitest";
import { currentMemberships, recentMemberships } from "../lib/membership-display";

const expired = { id: "old", customerUid: "sam", status: "inactive", startsAt: "2026-09-28T00:00:00Z" };
const renewed = { id: "new", customerUid: "sam", status: "active", startsAt: "2026-11-01T00:00:00Z" };

describe("current membership boards", () => {
  it("shows the renewed membership once without mutating history", () => {
    const records = [expired, renewed];
    expect(currentMemberships(records)).toEqual([renewed]);
    expect(records).toEqual([expired, renewed]);
    expect(recentMemberships(records)).toEqual([renewed, expired]);
  });
  it("shows the newest inactive record if no active membership exists", () => {
    const latest = { ...renewed, status: "inactive" };
    expect(currentMemberships([expired, latest])).toEqual([latest]);
  });
  it("prefers an active or paused membership to a later inactive record", () => {
    const correction = { ...expired, id: "later", startsAt: "2026-11-02T00:00:00Z" };
    expect(currentMemberships([correction, renewed])).toEqual([renewed]);
    expect(currentMemberships([correction, { ...renewed, status: "paused" }])[0].id).toBe("new");
  });
  it("groups by customer identity rather than matching names", () => {
    const other = { ...renewed, customerUid: "other", id: "other-plan" };
    expect(currentMemberships([expired, renewed, other])).toHaveLength(2);
    expect(currentMemberships([])).toEqual([]);
  });
});
