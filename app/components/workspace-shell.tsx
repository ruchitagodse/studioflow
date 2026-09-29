import { getCurrentPrincipal } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { WorkspaceProfileMenu } from "./workspace-profile-menu";
import styles from "./workspace-shell.module.css";

type WorkspaceShellProps = {
  workspace: "/customer" | "/trainer" | "/studio";
  homeHref: string;
  children: React.ReactNode;
};

function roleLabel(workspace: WorkspaceShellProps["workspace"], roles: string[]) {
  if (workspace === "/customer") return "Customer";
  if (workspace === "/trainer") return "Trainer";
  return roles.includes("owner") ? "Owner" : "Staff / Admin";
}

type ShellData = { name: string; role: string; studioName: string };

async function loadShellData(workspace: WorkspaceShellProps["workspace"]): Promise<ShellData | null> {
  try {
    const principal = await getCurrentPrincipal();
    if (!principal || principal.workspace !== workspace || !principal.studioId) return null;
    const db = getAdminDb();
    const [studioSnapshot, memberSnapshot] = await Promise.all([
      db.doc(`studios/${principal.studioId}`).get(),
      db.doc(`studios/${principal.studioId}/members/${principal.uid}`).get(),
    ]);
    const name = String(memberSnapshot.data()?.displayName ?? "").trim() || principal.email?.split("@")[0] || "Studio member";
    const studioName = String(studioSnapshot.data()?.name ?? "StudioFlow Pilates").trim() || "StudioFlow Pilates";
    return { name, studioName, role: roleLabel(workspace, principal.roles) };
  } catch {
    return null;
  }
}

/** Presentation-only chrome; route pages remain the authority for access. */
export async function WorkspaceShell({ workspace, homeHref, children }: WorkspaceShellProps) {
  const data = await loadShellData(workspace);
  if (!data) return <>{children}</>;
  return <div className={styles.shell}>
    <header className={styles.header}>
      <a className={styles.brand} href={homeHref} aria-label="StudioFlow workspace home"><span>S</span><b>studioflow</b></a>
      <WorkspaceProfileMenu name={data.name} role={data.role} studioName={data.studioName} customerProfile={workspace === "/customer"} />
    </header>
    {children}
  </div>;
}
