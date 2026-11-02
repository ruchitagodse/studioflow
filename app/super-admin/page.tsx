import { readPage } from "@/lib/firebase/pagination";
import { ListPagination } from "@/app/components/list-pagination";

import { BrandLogo } from "@/app/components/brand-logo";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireSuperAdmin } from "@/lib/auth/server";
import { LogoutButton } from "@/app/components/logout-button";
import { SuperAdminPanel } from "@/app/components/super-admin-panel";
import { SuperAdminThemeControls } from "@/app/components/super-admin-theme-controls";
import { listApprovedBrandPalettes } from "@/lib/brand-palettes";
import styles from "@/app/components/sprint-one.module.css";

export default async function SuperAdminPage({ searchParams }: { searchParams: Promise<{ after?: string }> }) {
  await connection();
  const { after } = await searchParams;
  let principal;
  let accessError: unknown;
  try { principal = await requireSuperAdmin(); } catch (error) {
    accessError = error;
    console.error("Studio Calendar Super Admin access resolution failed.", error);
  }
  if (!principal) redirect(accessError instanceof Error && accessError.message === "NO_ACTIVE_SESSION" ? "/" : "/access-denied");
  const snapshot = await readPage(getAdminDb().collection("studios").orderBy("createdAt", "desc"), "studios", after);
  const studios = snapshot.docs.map((doc) => ({ id: doc.id, name: String(doc.data().name), timezone: String(doc.data().timezone), status: doc.data().status as "active" | "deactivated" | "archived", ownerEmail: doc.data().initialOwnerEmail as string | null, theme: String(doc.data().settings?.theme ?? "ember-dark"), brandPaletteId: typeof doc.data().settings?.brandPaletteId === "string" ? doc.data().settings.brandPaletteId : null, allowOwnerThemeCustomization: doc.data().settings?.allowOwnerThemeCustomization === true }));
  const palettes = await listApprovedBrandPalettes();
  return <><main className={styles.workspace}><header className={styles.workspaceHeader}><div className={styles.brand}><BrandLogo /> <em className={styles.platformTag}>Platform</em></div><LogoutButton /></header><section className={styles.workspaceMain}><p className={styles.kicker}>SUPER ADMIN</p><h1>Provision studios with care.</h1><p>Platform-level controls are separated from daily studio operations. Every change is validated and recorded through a trusted server operation.</p><SuperAdminPanel studios={studios} /><SuperAdminThemeControls studios={studios} palettes={palettes} /></section></main><ListPagination pathname="/super-admin" after={after} nextCursor={snapshot.nextCursor} /></>;
}
