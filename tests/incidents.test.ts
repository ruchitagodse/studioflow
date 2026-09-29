import { describe, expect, it } from "vitest";
import { countActiveIncidentsInWindow, incidentCorrection, incidentCountsTowardReview, incidentDocumentId, incidentSourceForBookingStatus, reviewRequiredFor, rollingWindowStart } from "../lib/incident-logic";

describe("Sprint 7 Incident Policy", () => {
  it("uses one deterministic Incident identity for each qualifying booking source", () => {
    expect(incidentDocumentId("booking-a", "no-show")).toBe("booking-a-no-show");
    expect(incidentDocumentId("booking-a", "no-show")).toBe(incidentDocumentId("booking-a", "no-show"));
    expect(incidentDocumentId("booking-a", "late-cancellation")).not.toBe(incidentDocumentId("booking-a", "no-show"));
  });
  it("counts only active Incidents and includes the threshold-triggering third Incident", () => {
    expect(incidentCountsTowardReview("active")).toBe(true);
    expect(incidentCountsTowardReview("waived")).toBe(false);
    expect(incidentCountsTowardReview("reversed")).toBe(false);
    expect(reviewRequiredFor(2)).toBe(false);
    expect(reviewRequiredFor(3)).toBe(true);
  });
  it("uses an exact rolling 30-day trusted-time boundary", () => {
    expect(rollingWindowStart(new Date("2026-10-31T10:00:00.000Z")).toISOString()).toBe("2026-10-01T10:00:00.000Z");
  });
  it("creates sources only for late cancellation and no-show", () => {
    expect(incidentSourceForBookingStatus("cancelled-late")).toBe("late-cancellation");
    expect(incidentSourceForBookingStatus("no-show")).toBe("no-show");
    for (const status of ["cancelled-free", "attended", "confirmed", "voided", "rescheduled-original"]) expect(incidentSourceForBookingStatus(status)).toBeNull();
  });
  it("keeps a staff factual correction separate from Owner Incident reversal", () => {
    expect(incidentCorrection("no-show", "attended")).toBe("requires-owner-reversal");
    expect(incidentCorrection("attended", "no-show")).toBe("create-no-show");
    expect(incidentCorrection("attended", "attended")).toBeNull();
  });
  it("excludes waived, reversed, and outside-window Incidents from the current policy", () => {
    const now = new Date("2026-10-31T10:00:00.000Z");
    expect(countActiveIncidentsInWindow([
      { status: "active", sourceTimestamp: new Date("2026-10-01T10:00:00.000Z") },
      { status: "active", sourceTimestamp: new Date("2026-10-31T09:00:00.000Z") },
      { status: "waived", sourceTimestamp: new Date("2026-10-30T10:00:00.000Z") },
      { status: "reversed", sourceTimestamp: new Date("2026-10-30T10:00:00.000Z") },
      { status: "active", sourceTimestamp: new Date("2026-10-01T09:59:59.999Z") },
    ], now)).toBe(2);
  });
  it("derives current review from active in-window Incidents only", () => {
    const now = new Date("2026-10-31T10:00:00.000Z");
    const count = countActiveIncidentsInWindow([
      { status: "active", sourceTimestamp: new Date("2026-10-30T10:00:00.000Z") },
      { status: "active", sourceTimestamp: new Date("2026-10-29T10:00:00.000Z") },
      { status: "active", sourceTimestamp: new Date("2026-10-28T10:00:00.000Z") },
      { status: "waived", sourceTimestamp: new Date("2026-10-27T10:00:00.000Z") },
      { status: "reversed", sourceTimestamp: new Date("2026-10-26T10:00:00.000Z") },
    ], now);
    expect(count).toBe(3);
    expect(reviewRequiredFor(count)).toBe(true);
    expect(false && reviewRequiredFor(count)).toBe(false);
  });
});
