export type StudioActivityCategory = "schedule" | "bookings" | "memberships" | "credits" | "attendance" | "incidents" | "waitlist" | "access" | "other";

const labels: Record<string, string> = {
  "booking.created": "Booking created", "booking.confirmed": "Booking confirmed", "booking.cancelled": "Booking cancelled", "booking.cancelled_free": "Booking cancelled within the free window", "booking.cancelled_late": "Late booking cancellation", "booking.cancelled_subscription": "Booking cancelled with membership", "booking.rescheduled": "Booking rescheduled",
  "class.created": "Class created", "class.updated": "Class updated", "class.retired": "Class retired", "slot.created": "Session scheduled", "slot.updated": "Session updated", "slot.cancelled": "Session cancelled",
  "attendance.marked": "Attendance recorded", "attendance.corrected": "Attendance corrected",
  "credit.adjusted": "Credits adjusted", "credit.consumed": "Class credit used", "credit.expired": "Credits expired", "credit.issued": "Credits added", "credit.released": "Reserved credit released", "credit.reserved": "Credit reserved for a booking",
  "subscription.created": "Membership created", "subscription.activated": "Membership activated", "subscription.renewed": "Membership renewed", "subscription.expired": "Membership expired", "subscription.cancelled": "Membership cancelled", "subscription.cancellation_requested": "End-of-term cancellation requested", "subscription.pause_started": "Membership paused", "subscription.pause_ended": "Membership pause ended", "subscription.resumed": "Membership resumed",
  "plan.created": "Plan created", "plan.updated": "Plan updated", "plan.activated": "Plan activated", "plan.retired": "Plan retired",
  "incident.created": "Incident recorded", "incident.waived": "Incident waived", "incident.reversed": "Incident reversed", "incident.reviewed": "Incident review acknowledged", "incident.threshold_reached": "Incident review threshold reached", "incident.review_state_changed": "Incident review state updated", "incident.policy_created": "Incident policy created", "incident.policy_activated": "Incident policy activated", "incident.policy_deactivated": "Incident policy deactivated",
  "waitlist.joined": "Customer joined a waitlist", "waitlist.promoted": "Waitlist place converted to a booking", "waitlist.removed": "Waitlist entry removed", "waitlist.withdrawn": "Customer left a waitlist", "waitlist.ineligible": "Waitlist entry became ineligible", "waitlist.expired_at_class_start": "Waitlist entry expired at class start",
  "membership.invited": "Invitation created", "membership.invitation_reissued": "Invitation link replaced", "membership.invitation_revoked": "Invitation revoked", "membership.provisioned": "Studio access provisioned", "membership.activated": "Studio access activated", "membership.deactivated": "Studio access deactivated", "membership.revoked": "Studio access revoked", "membership.role_changed": "Studio role updated", "membership.profile_updated": "Member profile updated", "membership.password_changed": "Member password changed",
};

export function studioActivityLabel(action: string) {
  if (labels[action]) return labels[action];
  const words = action.replace(/[._-]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "Studio activity recorded";
}

export function studioActivityCategory(action: string): StudioActivityCategory {
  const prefix = action.split(".")[0];
  if (prefix === "slot" || prefix === "class") return "schedule";
  if (prefix === "booking") return "bookings";
  if (prefix === "subscription" || prefix === "plan") return "memberships";
  if (prefix === "credit") return "credits";
  if (prefix === "attendance") return "attendance";
  if (prefix === "incident") return "incidents";
  if (prefix === "waitlist") return "waitlist";
  if (prefix === "membership") return "access";
  return "other";
}

export function studioActivityDetail(data: Record<string, unknown>) {
  const after = data.after && typeof data.after === "object" ? data.after as Record<string, unknown> : {};
  const reason = typeof data.reason === "string" ? data.reason.trim() : "";
  const outcome = typeof after.outcome === "string" ? after.outcome.replace(/[-_]/g, " ") : "";
  return [outcome ? `Outcome: ${outcome}` : "", reason].filter(Boolean).join(" · ");
}

export function studioActivityDestination(action: string, targetId: string, data: Record<string, unknown>) {
  const after = data.after && typeof data.after === "object" ? data.after as Record<string, unknown> : {};
  if (action.startsWith("attendance.") && typeof after.slotId === "string") return `/studio/attendance/${encodeURIComponent(after.slotId)}`;
  const category = studioActivityCategory(action);
  if (category === "schedule" || category === "bookings" || category === "attendance") return "/studio/schedule";
  if (category === "credits") return targetId ? `/studio/credits?subscription=${encodeURIComponent(targetId)}` : "/studio/credits";
  if (category === "memberships") return action.startsWith("plan.") ? "/studio/plans" : "/studio/subscriptions";
  if (category === "incidents") return "/studio/incidents";
  if (category === "waitlist") return "/studio/waitlist";
  if (category === "access") return "/studio/customers";
  return "/studio";
}
