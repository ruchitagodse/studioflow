import { redirect } from "next/navigation";
import { connection } from "next/server";
import { EntitlementManager } from "@/app/components/entitlement-manager";
import { requireWorkspace } from "@/lib/auth/server";
import { isSubscriptionExpired } from "@/lib/entitlement-logic";
import { pauseAllowanceDays } from "@/lib/subscription-lifecycle-logic";
import { expireSubscriptionIfDue, subscriptionUsableCredits } from "@/lib/entitlements";
import { getAdminDb } from "@/lib/firebase/admin";

export default async function EntitlementsPage({ searchParams }: { searchParams: Promise<{ subscription?: string }> }) {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/"); }
  if (!principal.studioId) redirect("/access-denied");
  const studioId = principal.studioId;
  const requestedSubscriptionId = (await searchParams).subscription ?? null;
  const db = getAdminDb();
  const [planDocs, customerDocs, initialSubscriptionDocs] = await Promise.all([
    db.collection(`studios/${studioId}/plans`).orderBy("createdAt", "desc").limit(50).get(),
    db.collection(`studios/${studioId}/members`).where("status", "==", "active").where("roles", "array-contains", "customer").limit(50).get(),
    db.collection(`studios/${studioId}/subscriptions`).orderBy("createdAt", "desc").limit(50).get(),
  ]);
  let subscriptionDocs = initialSubscriptionDocs;
  const expired = await Promise.all(subscriptionDocs.docs.filter((doc) => {
    const data = doc.data(); const effectiveEndsAt = data.effectiveEndsAt ?? data.endsAt;
    return (data.status === "active" || data.status === "paused") && effectiveEndsAt?.toDate && isSubscriptionExpired(effectiveEndsAt.toDate());
  }).map((doc) => expireSubscriptionIfDue(studioId, doc.id)));
  if (expired.some(Boolean)) subscriptionDocs = await db.collection(`studios/${studioId}/subscriptions`).orderBy("createdAt", "desc").limit(50).get();
  const customers = customerDocs.docs.map((doc) => ({ uid: doc.id, name: String(doc.data().displayName ?? "") || String(doc.data().email ?? "Customer"), email: String(doc.data().email ?? "") }));
  const customerNames = new Map(customers.map((customer) => [customer.uid, customer.name]));
  const subscriptions = subscriptionDocs.docs.map((doc) => {
    const data = doc.data(); const endsAt = data.endsAt.toDate() as Date; const effectiveEndsAt = (data.effectiveEndsAt ?? data.endsAt).toDate() as Date; const expiredAtRead = isSubscriptionExpired(effectiveEndsAt);
    const currentStatus = data.status === "active" && expiredAtRead ? "inactive" as const : data.status === "active" || data.status === "paused" ? data.status as "active" | "paused" : "inactive" as const;
    const durationMonths = Number(data.historicalTerms?.durationMonths ?? data.durationMonths ?? 0) || null;
    return { id: doc.id, customerUid: String(data.customerUid), customerName: customerNames.get(String(data.customerUid)) ?? "Historical customer", planName: String(data.historicalTerms?.planName ?? "Plan"), status: currentStatus, inactiveReason: data.status === "active" && expiredAtRead ? "expired" : data.inactiveReason ? String(data.inactiveReason) : null, startsAt: data.startsAt.toDate().toISOString(), endsAt: endsAt.toISOString(), effectiveEndsAt: effectiveEndsAt.toISOString(), availableCredits: Number(data.availableCredits ?? 0), usableCredits: subscriptionUsableCredits({ status: String(data.status), endsAt: effectiveEndsAt, availableCredits: Number(data.availableCredits ?? 0) }), durationMonths, pauseDaysUsed: Number(data.pauseDaysUsed ?? 0), pauseAllowanceDays: pauseAllowanceDays(durationMonths ?? undefined) };
  });
  const plans = planDocs.docs.map((doc) => { const data = doc.data(); return { id: doc.id, name: String(data.name), description: String(data.description ?? ""), pricePaise: Number(data.pricePaise), creditAllocation: Number(data.creditAllocation), validityDays: Number(data.validityDays ?? 0) || null, durationMonths: Number(data.durationMonths ?? 0) || null, status: data.status as "draft" | "active" | "retired" }; });
  let ledger: { id: string; action: string; amount: number; balanceBefore: number; balanceAfter: number; reason: string; createdAt: string }[] = [];
  const selectedSubscriptionId = requestedSubscriptionId && subscriptionDocs.docs.some((doc) => doc.id === requestedSubscriptionId) ? requestedSubscriptionId : null;
  if (selectedSubscriptionId) {
    const ledgerDocs = await db.collection(`studios/${studioId}/subscriptions/${selectedSubscriptionId}/ledger`).orderBy("createdAt", "desc").limit(25).get();
    ledger = ledgerDocs.docs.map((doc) => { const data = doc.data(); return { id: doc.id, action: String(data.action), amount: Number(data.amount), balanceBefore: Number(data.balanceBefore), balanceAfter: Number(data.balanceAfter), reason: String(data.reason ?? ""), createdAt: data.createdAt?.toDate().toISOString() ?? new Date(0).toISOString() }; });
  }
  return <EntitlementManager plans={plans} customers={customers} subscriptions={subscriptions} ledger={ledger} selectedSubscriptionId={selectedSubscriptionId} />;
}
