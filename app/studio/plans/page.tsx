import { connection } from "next/server";
import { EntitlementManager } from "@/app/components/entitlement-manager";
import { getEntitlementData } from "@/app/studio/entitlements/data";

export default async function PlansPage() {
  await connection();
  return <EntitlementManager {...await getEntitlementData(null)} view="plans" />;
}
