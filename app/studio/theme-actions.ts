"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireWorkspace } from "@/lib/auth/server";
import { updateStudioTheme } from "@/lib/studio-theme";
import { themePreferenceCookieName } from "@/lib/theme-preference";

export async function ownerThemeAction(formData: FormData) {
  try { const principal = await requireWorkspace("/studio"); if (!principal.studioId) throw new Error("FORBIDDEN_THEME_CONFIGURATION"); const selected = String(formData.get("theme") ?? "nature-minimal"); const [kind, brandPaletteId] = selected.split(":", 2); const theme = kind === "custom-brand" ? kind : selected; await updateStudioTheme(principal, { studioId: principal.studioId, theme, brandPaletteId }); (await cookies()).set(themePreferenceCookieName, selected, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 }); revalidatePath("/", "layout"); revalidatePath("/studio"); return { error: null }; } catch (error) { return { error: error instanceof Error && error.message === "FORBIDDEN_THEME_CONFIGURATION" ? "Theme customization is not enabled for this studio." : "Unable to update the studio theme." }; }
}
