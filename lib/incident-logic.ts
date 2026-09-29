export const incidentTypes = ["late-cancellation", "no-show"] as const;
export type IncidentType = (typeof incidentTypes)[number];

export function incidentDocumentId(bookingId: string, type: IncidentType) {
  return `${bookingId}-${type}`;
}

export function incidentCountsTowardReview(status: string) {
  return status === "active";
}

export function reviewRequiredFor(activeIncidentCount: number, threshold = 3) {
  return activeIncidentCount >= threshold;
}

export function rollingWindowStart(now: Date, rollingDays = 30) {
  return new Date(now.getTime() - rollingDays * 24 * 60 * 60 * 1000);
}

export function incidentSourceForBookingStatus(status: string): IncidentType | null {
  return status === "cancelled-late" ? "late-cancellation" : status === "no-show" ? "no-show" : null;
}

export function incidentCorrection(before: string, after: string): "requires-owner-reversal" | "create-no-show" | null {
  if (before === "no-show" && after === "attended") return "requires-owner-reversal";
  if (before === "attended" && after === "no-show") return "create-no-show";
  return null;
}

export function countActiveIncidentsInWindow(incidents: { status: string; sourceTimestamp: Date }[], now: Date, rollingDays = 30) {
  const startsAt = rollingWindowStart(now, rollingDays).getTime();
  return incidents.filter((incident) => incidentCountsTowardReview(incident.status) && incident.sourceTimestamp.getTime() >= startsAt && incident.sourceTimestamp.getTime() <= now.getTime()).length;
}
