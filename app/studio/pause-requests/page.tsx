import { connection } from "next/server";
import { StudioPauseBoard } from "@/app/components/studio-pause-board";
import { getEntitlementData } from "@/app/studio/entitlements/data";

export default async function PauseRequestsPage() {
  await connection();
  const { subscriptions, timezone } = await getEntitlementData(null, null, "pauses");
  return <StudioPauseBoard subscriptions={subscriptions} timezone={timezone} />;
}
