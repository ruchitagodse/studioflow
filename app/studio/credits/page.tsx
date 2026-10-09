import { connection } from "next/server";
import { EntitlementManager } from "@/app/components/entitlement-manager";
import { getEntitlementData } from "@/app/studio/entitlements/data";

export default async function CreditsPage({ searchParams }: { searchParams: Promise<{ subscription?: string; customer?: string }> }) {
  await connection();
  const { subscription, customer } = await searchParams;
  const customerUid = typeof customer === "string" && customer ? customer : null;
  return <EntitlementManager {...await getEntitlementData(subscription ?? null, customerUid)} view="credits" customerUid={customerUid} />;
}
