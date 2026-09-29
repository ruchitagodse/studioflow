import "server-only";

import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { resolveTheme, type ThemeId } from "@/lib/theme";
import type { Principal } from "@/lib/auth/server";
import { studioThemeSchema } from "@/lib/validation";

export function studioThemeSettings(data: Record<string, unknown> | undefined) { const settings = data?.settings as Record<string, unknown> | undefined; return { theme: resolveTheme(settings?.theme), allowOwnerThemeCustomization: settings?.allowOwnerThemeCustomization === true }; }

export async function getActiveStudioTheme(principal: Principal | null) { if (!principal?.studioId) return "nature-minimal" as ThemeId; const studio = await getAdminDb().doc(`studios/${principal.studioId}`).get(); return studioThemeSettings(studio.data()).theme; }

export async function updateStudioTheme(actor: Principal, raw: { studioId: string; theme: unknown; allowOwnerThemeCustomization?: unknown }) {
  const input = studioThemeSchema.parse(raw); const theme = resolveTheme(input.theme); const db = getAdminDb(); const studioRef = db.doc(`studios/${input.studioId}`);
  await db.runTransaction(async (transaction) => { const studio = await transaction.get(studioRef); if (!studio.exists) throw new Error("STUDIO_NOT_FOUND"); const current = studioThemeSettings(studio.data()); const superAdmin = actor.superAdmin; const ownerAllowed = actor.studioId === input.studioId && actor.roles.includes("owner") && current.allowOwnerThemeCustomization; if (!superAdmin && !ownerAllowed) throw new Error("FORBIDDEN_THEME_CONFIGURATION"); const settings = { ...(studio.data()?.settings ?? {}), theme, ...(superAdmin && typeof input.allowOwnerThemeCustomization === "boolean" ? { allowOwnerThemeCustomization: input.allowOwnerThemeCustomization } : {}) }; transaction.update(studioRef, { settings, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid }); transaction.set(db.doc(superAdmin ? `platformAuditEvents/${randomUUID()}` : `studios/${input.studioId}/auditEvents/${randomUUID()}`), { action: "studio.theme_updated", actorUid: actor.uid, studioId: input.studioId, createdAt: FieldValue.serverTimestamp(), result: "success" }); });
}
