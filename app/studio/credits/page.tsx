import { connection } from "next/server";
import { EntitlementManager } from "@/app/components/entitlement-manager";
import { getEntitlementData } from "@/app/studio/entitlements/data";

export default async function CreditsPage({ searchParams }: { searchParams: Promise<{ subscription?: string }> }) {
  await connection();
  return <EntitlementManager {...await getEntitlementData((await searchParams).subscription ?? null)} view="credits" />;
}
