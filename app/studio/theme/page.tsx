import { readDocument } from "@/lib/firebase/reads";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { StudioAppearance } from "@/app/components/studio-appearance";
import { requireWorkspace } from "@/lib/auth/server";
import { listApprovedBrandPalettes, paletteVariables } from "@/lib/brand-palettes";
import { studioThemeSettings } from "@/lib/studio-theme";

export default async function StudioThemePage() {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/access-denied"); }
  if (!principal.studioId || !principal.roles.includes("owner")) redirect("/access-denied");

  const settings = studioThemeSettings((await readDocument(`studios/${principal.studioId}`)).data());
  if (!settings.allowOwnerThemeCustomization) redirect("/access-denied");
  const palettes = (await listApprovedBrandPalettes()).map(palette => {
    const variables = paletteVariables(palette);
    return { ...palette, text: variables["--color-text"], buttonText: variables["--color-button-text"] };
  });

  return <main>
    <StudioAppearance theme={settings.theme} brandPaletteId={settings.brandPaletteId} palettes={palettes} />
  </main>;
}
