import { readDocument, readQuery } from "@/lib/firebase/reads";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/server";
import { isSubscriptionExpired } from "@/lib/entitlement-logic";
import { pauseAllowanceDays } from "@/lib/subscription-lifecycle-logic";
import { expireSubscriptionIfDue, subscriptionUsableCredits } from "@/lib/entitlements";
import { getAdminDb } from "@/lib/firebase/admin";

export async function getEntitlementData(requestedSubscriptionId: string | null, requestedCustomerUid: string | null = null, view: "plans" | "subscriptions" | "credits" | "pauses" = "subscriptions") {
  let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/"); }
  if (!principal.studioId) redirect("/access-denied");
  const studioId = principal.studioId;
  const db = getAdminDb();
  const subscriptionsRef = db.collection(`studios/${studioId}/subscriptions`);
  const empty = { docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] };
  const loadSubscriptions = () => view === "plans" ? Promise.resolve(empty) : requestedCustomerUid
    ? readQuery(subscriptionsRef.where("customerUid", "==", requestedCustomerUid).limit(50))
    : readQuery(subscriptionsRef.orderBy("createdAt", "desc").limit(50));
  const [planDocs, customerDocs, initialSubscriptionDocs] = await Promise.all([
    view === "pauses" ? Promise.resolve(empty) : readQuery(db.collection(`studios/${studioId}/plans`).orderBy("createdAt", "desc").limit(50)),
    view === "plans" ? Promise.resolve(empty) : readQuery(db.collection(`studios/${studioId}/members`).where("status", "==", "active").where("roles", "array-contains", "customer").limit(50)),
    loadSubscriptions(),
  ]);
  let subscriptionDocs = initialSubscriptionDocs;
  const expired = await Promise.all(subscriptionDocs.docs.filter((doc) => {
    const data = doc.data(); const effectiveEndsAt = data.effectiveEndsAt ?? data.endsAt;
    return (data.status === "active" || data.status === "paused") && effectiveEndsAt?.toDate && isSubscriptionExpired(effectiveEndsAt.toDate());
  }).map((doc) => expireSubscriptionIfDue(studioId, doc.id)));
  if (expired.some(Boolean)) subscriptionDocs = await loadSubscriptions();
  const customers = customerDocs.docs.map((doc) => ({ uid: doc.id, name: String(doc.data().displayName ?? "") || String(doc.data().email ?? "Customer"), email: String(doc.data().email ?? "") }));
  const subscriptions = subscriptionDocs.docs.map((doc) => {
    const data = doc.data(); const endsAt = data.endsAt.toDate() as Date; const effectiveEndsAt = (data.effectiveEndsAt ?? data.endsAt).toDate() as Date; const expiredAtRead = isSubscriptionExpired(effectiveEndsAt);
    const currentStatus = data.status === "active" && expiredAtRead ? "inactive" as const : data.status === "active" || data.status === "paused" ? data.status as "active" | "paused" : "inactive" as const;
    const durationMonths = Number(data.historicalTerms?.durationMonths ?? data.durationMonths ?? 0) || null;
    const allocation = Number(data.historicalTerms?.creditAllocation ?? 0);
    const availableCredits = Number(data.availableCredits ?? 0); const reservedCredits = Number(data.reservedCredits ?? 0);
    const customer = customers.find((item) => item.uid === String(data.customerUid));
    return { id: doc.id, customerUid: String(data.customerUid), customerName: customer?.name ?? "Historical customer", customerEmail: customer?.email ?? "", planName: String(data.historicalTerms?.planName ?? "Plan"), status: currentStatus, inactiveReason: data.status === "active" && expiredAtRead ? "expired" : data.inactiveReason ? String(data.inactiveReason) : null, startsAt: data.startsAt.toDate().toISOString(), endsAt: endsAt.toISOString(), effectiveEndsAt: effectiveEndsAt.toISOString(), availableCredits, reservedCredits, usedCredits: Math.max(0, allocation - availableCredits - reservedCredits), usableCredits: subscriptionUsableCredits({ status: String(data.status), endsAt: effectiveEndsAt, availableCredits }), durationMonths, pauseDaysUsed: Number(data.pauseDaysUsed ?? 0), pauseAllowanceDays: pauseAllowanceDays(durationMonths ?? undefined), pauseEndsAt: data.pauseEndsAt?.toDate?.().toISOString() ?? null };
  });
  const plans = planDocs.docs.map((doc) => { const data = doc.data(); return { id: doc.id, name: String(data.name), description: String(data.description ?? ""), pricePaise: Number(data.pricePaise), creditAllocation: Number(data.creditAllocation), validityDays: Number(data.validityDays ?? 0) || null, durationMonths: Number(data.durationMonths ?? 0) || null, status: data.status as "draft" | "active" | "retired" }; });
  const selectedSubscriptionId = requestedSubscriptionId && subscriptionDocs.docs.some((doc) => doc.id === requestedSubscriptionId) ? requestedSubscriptionId : null;
  let ledger: { id: string; action: string; amount: number; balanceBefore: number; balanceAfter: number; reason: string; createdAt: string }[] = [];
  if (selectedSubscriptionId) {
    const ledgerDocs = await readQuery(db.collection(`studios/${studioId}/subscriptions/${selectedSubscriptionId}/ledger`).orderBy("createdAt", "desc").limit(25));
    ledger = ledgerDocs.docs.map((doc) => { const data = doc.data(); return { id: doc.id, action: String(data.action), amount: Number(data.amount), balanceBefore: Number(data.balanceBefore), balanceAfter: Number(data.balanceAfter), reason: String(data.reason ?? ""), createdAt: data.createdAt?.toDate().toISOString() ?? new Date(0).toISOString() }; });
  }
  const studio = view === "pauses" ? await readDocument(`studios/${studioId}`) : null;
  const timezone = String(studio?.data()?.timezone ?? "UTC");
  return { plans, customers, subscriptions, ledger, selectedSubscriptionId, timezone };
}
