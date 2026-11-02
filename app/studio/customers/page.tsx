import { readPage } from "@/lib/firebase/pagination";
import { ListPagination } from "@/app/components/list-pagination";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { CustomersManager } from "@/app/components/customers-manager";
import { requireWorkspace } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCustomerMembership } from "@/lib/customer-membership";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ after?: string }> }) {
  await connection();
  const { after } = await searchParams;
  let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/access-denied"); }
  const db = getAdminDb(); const studioId = principal.studioId!;
  const customerDocs = await readPage(db.collection(`studios/${studioId}/members`).where("roles", "array-contains", "customer"), `studios/${studioId}/members`, after);
  const customerMembers = [...customerDocs.docs].sort((left, right) => {
    const leftUpdated = left.data().updatedAt?.toMillis?.() ?? 0;
    const rightUpdated = right.data().updatedAt?.toMillis?.() ?? 0;
    return rightUpdated - leftUpdated;
  });
  const subscriptions = await Promise.all(customerMembers.map((member) => getCustomerMembership(principal, member.id, member.data())));
  const customers = customerMembers.map((doc, index) => { const data = doc.data(); const subscription = subscriptions[index]; return { uid: doc.id, name: String(data.displayName ?? "").trim() || String(data.email ?? "Customer"), email: String(data.email ?? ""), status: data.status === "inactive" ? "inactive" as const : "active" as const, subscription: subscription ? String(subscription.historicalTerms?.planName ?? "Subscription") : "No active subscription", credits: subscription ? Number(subscription.availableCredits ?? 0) : null }; });
  return <><CustomersManager customers={customers} /><ListPagination pathname="/studio/customers" after={after} nextCursor={customerDocs.nextCursor} /></>;
}
