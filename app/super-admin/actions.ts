"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireSuperAdmin } from "@/lib/auth/server";
import { provisionStudio, updateStudioLifecycle, updateStudioManagement } from "@/lib/provisioning";
import { updateStudioTheme } from "@/lib/studio-theme";
import { themePreferenceCookieName } from "@/lib/theme-preference";
import { createBrandPalette } from "@/lib/brand-palettes";

export type ProvisionState = { error?: string; success?: { studioId: string; ownerUid: string; ownerEmail: string | null; ownerRecoveryLink: string | null } };

export async function provisionStudioAction(_: ProvisionState, formData: FormData): Promise<ProvisionState> {
  try {
    const principal = await requireSuperAdmin();
    const result = await provisionStudio(principal.uid, { name: String(formData.get("name") ?? ""), timezone: String(formData.get("timezone") ?? ""), ownerMode: String(formData.get("ownerMode") ?? "assign") as "assign" | "create", ownerUid: String(formData.get("ownerUid") ?? "") || undefined, ownerEmail: String(formData.get("ownerEmail") ?? "") || undefined });
    revalidatePath("/super-admin");
    return { success: result };
  } catch (error) { return { error: provisionError(error) }; }
}

export async function lifecycleAction(formData: FormData) {
  try { const principal = await requireSuperAdmin(); await updateStudioLifecycle(principal.uid, { studioId: String(formData.get("studioId") ?? ""), status: String(formData.get("status") ?? "") }); revalidatePath("/super-admin"); return { error: null }; } catch (error) { return { error: provisionError(error) }; }
}

export async function studioManagementAction(formData: FormData) { try { const principal = await requireSuperAdmin(); await updateStudioManagement(principal.uid, { studioId: String(formData.get("studioId") ?? ""), name: String(formData.get("name") ?? ""), status: String(formData.get("status") ?? "") }); revalidatePath("/super-admin"); return { error: null }; } catch (error) { return { error: provisionError(error) }; } }

export async function studioThemeAction(formData: FormData) {
  try { const principal = await requireSuperAdmin(); const selected = String(formData.get("theme") ?? "nature-minimal"); const [kind, brandPaletteId] = selected.split(":", 2); const theme = kind === "custom-brand" ? kind : selected; await updateStudioTheme(principal, { studioId: String(formData.get("studioId") ?? ""), theme, brandPaletteId, allowOwnerThemeCustomization: formData.get("allowOwnerThemeCustomization") === "on" }); (await cookies()).set(themePreferenceCookieName, selected, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 }); revalidatePath("/", "layout"); revalidatePath("/super-admin"); return { error: null }; } catch (error) { return { error: provisionError(error) }; }
}

export async function createBrandPaletteAction(formData: FormData) { try { const principal = await requireSuperAdmin(); await createBrandPalette(principal.uid, Object.fromEntries(formData)); revalidatePath("/super-admin"); return { error: null }; } catch (error) { return { error: provisionError(error) }; } }

function provisionError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to complete the requested change.";
  if (message.includes("OWNER_ALREADY_HAS_STUDIO")) return "This user already has a StudioFlow studio membership.";
  if (message.includes("user-not-found")) return "No Firebase user exists for that owner UID.";
  if (message.includes("FORBIDDEN_SUPER_ADMIN")) return "Only an active Super Admin can perform this action.";
  if (message.includes("STUDIO_NOT_FOUND")) return "That studio no longer exists.";
  return message;
}
