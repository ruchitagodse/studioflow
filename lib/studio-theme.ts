import { readDocument, withFirestoreQuota } from "@/lib/firebase/reads";
import "server-only";

import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { resolveTheme, type ThemeId } from "@/lib/theme";
import type { Principal } from "@/lib/auth/server";
import { studioThemeSchema } from "@/lib/validation";
import { paletteVariables, type BrandPalette } from "@/lib/brand-palettes";

export function studioThemeSettings(data: Record<string, unknown> | undefined) { const settings = data?.settings as Record<string, unknown> | undefined; return { theme: settings?.theme === "custom-brand" ? "custom-brand" : resolveTheme(settings?.theme), brandPaletteId: typeof settings?.brandPaletteId === "string" ? settings.brandPaletteId : null, allowOwnerThemeCustomization: settings?.allowOwnerThemeCustomization === true }; }

export async function getActiveStudioTheme(principal: Principal | null) { if (!principal?.studioId) return "ember-dark" as ThemeId; const studio = await readDocument(`studios/${principal.studioId}`); return studioThemeSettings(studio.data()).theme; }

export async function getActiveStudioAppearance(principal: Principal | null) { if (!principal?.studioId) return { theme: "ember-dark", variables: {} }; const studio = await readDocument(`studios/${principal.studioId}`); const settings = studioThemeSettings(studio.data()); if (settings.theme !== "custom-brand" || !settings.brandPaletteId) return { theme: settings.theme, variables: {} }; const palette = await readDocument(`brandPalettes/${settings.brandPaletteId}`); if (!palette.exists || palette.data()?.status !== "active") return { theme: "ember-dark", variables: {} }; return { theme: settings.theme, variables: paletteVariables({ id: palette.id, ...palette.data() } as BrandPalette) }; }

export async function updateStudioTheme(actor: Principal, raw: { studioId: string; theme: unknown; brandPaletteId?: unknown; allowOwnerThemeCustomization?: unknown }) {
  const input = studioThemeSchema.parse(raw); const db = getAdminDb(); const studioRef = db.doc(`studios/${input.studioId}`);
  await withFirestoreQuota(() => db.runTransaction(async (transaction) => { const studio = await transaction.get(studioRef); if (!studio.exists) throw new Error("STUDIO_NOT_FOUND"); const current = studioThemeSettings(studio.data()); const superAdmin = actor.superAdmin; const ownerAllowed = actor.studioId === input.studioId && actor.roles.includes("owner") && current.allowOwnerThemeCustomization; if (!superAdmin && !ownerAllowed) throw new Error("FORBIDDEN_THEME_CONFIGURATION"); if (input.theme === "custom-brand") { if (!input.brandPaletteId) throw new Error("BRAND_PALETTE_REQUIRED"); const palette = await transaction.get(db.doc(`brandPalettes/${input.brandPaletteId}`)); if (!palette.exists || palette.data()?.status !== "active") throw new Error("BRAND_PALETTE_UNAVAILABLE"); } const settings: Record<string, unknown> = { ...(studio.data()?.settings ?? {}), theme: input.theme, ...(superAdmin && typeof input.allowOwnerThemeCustomization === "boolean" ? { allowOwnerThemeCustomization: input.allowOwnerThemeCustomization } : {}) }; if (input.theme === "custom-brand") settings.brandPaletteId = input.brandPaletteId; else delete settings.brandPaletteId; transaction.update(studioRef, { settings, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid }); transaction.set(db.doc(superAdmin ? `platformAuditEvents/${randomUUID()}` : `studios/${input.studioId}/auditEvents/${randomUUID()}`), { action: "studio.theme_updated", actorUid: actor.uid, studioId: input.studioId, createdAt: FieldValue.serverTimestamp(), result: "success" }); }));
}
