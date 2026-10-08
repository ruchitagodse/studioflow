import { redirect } from "next/navigation";
import { connection } from "next/server";
import { CustomersManager } from "@/app/components/customers-manager";
import { requireWorkspace } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";

export default async function CustomersPage() {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/access-denied"); }
  const db = getAdminDb(); const studioId = principal.studioId!;
  const customerDocs = await db.collection(`studios/${studioId}/members`).where("roles", "array-contains", "customer").limit(100).get();
  const customerMembers = [...customerDocs.docs].sort((left, right) => {
    const leftUpdated = left.data().updatedAt?.toMillis?.() ?? 0;
    const rightUpdated = right.data().updatedAt?.toMillis?.() ?? 0;
    return rightUpdated - leftUpdated;
  });
  const customerIds = customerMembers.map((doc) => doc.id);
  const subscriptions = await Promise.all(customerIds.map((uid) => db.collection(`studios/${studioId}/subscriptions`).where("customerUid", "==", uid).limit(1).get()));
  const customers = customerMembers.map((doc, index) => { const data = doc.data(); const subscription = subscriptions[index]?.docs[0]?.data(); return { uid: doc.id, name: String(data.displayName ?? "").trim() || String(data.email ?? "Customer"), email: String(data.email ?? ""), status: data.status === "inactive" ? "inactive" as const : "active" as const, subscription: subscription ? String(subscription.historicalTerms?.planName ?? "Subscription") : "No active subscription", credits: subscription ? Number(subscription.availableCredits ?? 0) : null }; });
  return <CustomersManager customers={customers} />;
}
