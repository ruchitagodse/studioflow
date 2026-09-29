export type WaitlistStatus = "active" | "promoted" | "withdrawn" | "ineligible" | "expired-at-class-start";
export function waitlistEntryId(slotId: string, customerUid: string) { return `${slotId}_${customerUid}`; }
export function canJoinWaitlist(input: { studioActive: boolean; memberActive: boolean; customer: boolean; published: boolean; full: boolean; future: boolean; subscriptionActive: boolean; usableCredits: number }) {
  return input.studioActive && input.memberActive && input.customer && input.published && input.full && input.future && input.subscriptionActive && input.usableCredits > 0;
}
export function waitlistPosition(entries: { id: string; createdAt: Date; status: string }[], entryId: string) {
  return entries.filter((entry) => entry.status === "active").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)).findIndex((entry) => entry.id === entryId) + 1;
}
