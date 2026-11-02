type MembershipRecord = { id: string; customerUid: string; status: string; startsAt: string };

export function recentMemberships<T extends MembershipRecord>(records: readonly T[]): T[] {
  return [...records].sort((a, b) => b.startsAt.localeCompare(a.startsAt) || b.id.localeCompare(a.id));
}

/** Presentation grouping only; renewal and every historical record remain unchanged. */
export function currentMemberships<T extends MembershipRecord>(records: readonly T[]): T[] {
  const byCustomer = new Map<string, T>();
  for (const record of recentMemberships(records)) {
    const existing = byCustomer.get(record.customerUid);
    const isCurrent = record.status === "active" || record.status === "paused";
    const existingIsCurrent = existing?.status === "active" || existing?.status === "paused";
    if (!existing || (isCurrent && !existingIsCurrent)) byCustomer.set(record.customerUid, record);
  }
  return recentMemberships([...byCustomer.values()]);
}
