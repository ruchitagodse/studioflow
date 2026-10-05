import { redirect } from "next/navigation";
import { connection } from "next/server";
import { StudioAppearance } from "@/app/components/studio-appearance";
import { requireWorkspace } from "@/lib/auth/server";
import { listApprovedBrandPalettes } from "@/lib/brand-palettes";
import { getAdminDb } from "@/lib/firebase/admin";
import { studioThemeSettings } from "@/lib/studio-theme";

export default async function StudioThemePage() {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/access-denied"); }
  if (!principal.studioId || !principal.roles.includes("owner")) redirect("/access-denied");

  const settings = studioThemeSettings((await getAdminDb().doc(`studios/${principal.studioId}`).get()).data());
  if (!settings.allowOwnerThemeCustomization) redirect("/access-denied");
  const palettes = await listApprovedBrandPalettes();

  return <main style={{ minHeight: "100dvh", padding: "clamp(24px, 4vw, 56px)", background: "var(--canvas)" }}>
    <StudioAppearance theme={settings.theme} brandPaletteId={settings.brandPaletteId} palettes={palettes} />
  </main>;
}
