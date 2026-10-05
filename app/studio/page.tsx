import { redirect } from "next/navigation";
import { connection } from "next/server";
import { StudioDashboard } from "@/app/components/studio-dashboard";
import { requireWorkspace } from "@/lib/auth/server";

export default async function StudioWorkspace() {
  await connection();
  let principal;
  let accessError: unknown;
  try { principal = await requireWorkspace("/studio"); } catch (error) {
    accessError = error;
    console.error("StudioFlow studio access resolution failed.", error);
  }
  if (!principal) redirect(accessError instanceof Error && accessError.message === "NO_ACTIVE_SESSION" ? "/" : "/access-denied");
  return <StudioDashboard principal={principal} />;
}
