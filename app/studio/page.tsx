import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ProtectedWorkspace } from "@/app/components/protected-workspace";
import { requireWorkspace } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { studioThemeSettings } from "@/lib/studio-theme";
import { StudioAppearance } from "@/app/components/studio-appearance";

export default async function StudioWorkspace() {
  await connection();
  let principal;
  let accessError: unknown;
  try { principal = await requireWorkspace("/studio"); } catch (error) {
    accessError = error;
    console.error("StudioFlow studio access resolution failed.", error);
  }
  if (!principal) redirect(accessError instanceof Error && accessError.message === "NO_ACTIVE_SESSION" ? "/" : "/access-denied");
  const settings = principal.studioId ? studioThemeSettings((await getAdminDb().doc(`studios/${principal.studioId}`).get()).data()) : null;
  return <><ProtectedWorkspace name={principal.email?.split("@")[0] ?? "there"} role={principal.roles.includes("owner") ? "Studio owner" : "Studio administrator"} />{principal.roles.includes("owner") && settings?.allowOwnerThemeCustomization && <StudioAppearance theme={settings.theme} />}</>;
}
