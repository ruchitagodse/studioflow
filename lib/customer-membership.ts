import { readDocument, readQuery } from "@/lib/firebase/reads";
import "server-only";

import type { Principal } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { currentMemberships } from "@/lib/membership-display";

/** Resolve renewal pointers only inside the caller's verified studio. */
export async function getCustomerMembership(principal: Principal, customerUid: string, member: Record<string, unknown>) {
  if (!principal.studioId || !principal.roles.some((role) => role === "owner" || role === "staff")) throw new Error("FORBIDDEN_ENTITLEMENTS");
  const subscriptions = getAdminDb().collection(`studios/${principal.studioId}/subscriptions`);
  for (const id of new Set([member.activeSubscriptionId, member.latestSubscriptionId])) {
    if (typeof id !== "string" || !id || id.includes("/")) continue;
    const record = await readDocument(`studios/${principal.studioId}/subscriptions/${id}`);
    if (record.exists && record.data()?.customerUid === customerUid) return record.data();
  }
  // Legacy records may predate the member pointers; retain a bounded fallback.
  const records = await readQuery(subscriptions.where("customerUid", "==", customerUid).limit(50));
  return currentMemberships(records.docs.map((record) => ({ id: record.id, customerUid, status: String(record.data().status), startsAt: record.data().startsAt?.toDate?.().toISOString() ?? "", data: record.data() })))[0]?.data;
}
