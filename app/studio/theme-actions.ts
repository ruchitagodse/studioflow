"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireWorkspace } from "@/lib/auth/server";
import { updateStudioTheme } from "@/lib/studio-theme";
import { resolveTheme } from "@/lib/theme";
import { themePreferenceCookieName } from "@/lib/theme-preference";

export async function ownerThemeAction(formData: FormData) {
  try { const principal = await requireWorkspace("/studio"); if (!principal.studioId) throw new Error("FORBIDDEN_THEME_CONFIGURATION"); const theme = resolveTheme(formData.get("theme")); await updateStudioTheme(principal, { studioId: principal.studioId, theme }); (await cookies()).set(themePreferenceCookieName, theme, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 }); revalidatePath("/"); revalidatePath("/studio"); return { error: null }; } catch (error) { return { error: error instanceof Error && error.message === "FORBIDDEN_THEME_CONFIGURATION" ? "Theme customization is not enabled for this studio." : "Unable to update the studio theme." }; }
}
