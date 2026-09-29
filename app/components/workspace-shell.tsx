import { getCurrentPrincipal } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { WorkspaceProfileMenu } from "./workspace-profile-menu";
import { WorkspaceLiveRefresh } from "./workspace-live-refresh";
import styles from "./workspace-shell.module.css";

type WorkspaceShellProps = {
  workspace: "/customer" | "/trainer" | "/studio";
  homeHref: string;
  children: React.ReactNode;
};

function roleLabel(roles: string[]) {
  return roles.map((role) => role === "staff" ? "Staff / Admin" : role[0]?.toUpperCase() + role.slice(1)).join(" · ");
}

type ShellData = { name: string; role: string; studioName: string; workspaceLinks: { href: string; label: string }[] };

async function loadShellData(workspace: WorkspaceShellProps["workspace"]): Promise<ShellData | null> {
  try {
    const principal = await getCurrentPrincipal();
    if (!principal || !principal.studioId) return null;
    const canUseWorkspace = workspace === "/customer" ? principal.roles.includes("customer") : workspace === "/trainer" ? principal.roles.includes("trainer") : principal.roles.some((role) => role === "owner" || role === "staff");
    if (!canUseWorkspace) return null;
    const db = getAdminDb();
    const [studioSnapshot, memberSnapshot] = await Promise.all([
      db.doc(`studios/${principal.studioId}`).get(),
      db.doc(`studios/${principal.studioId}/members/${principal.uid}`).get(),
    ]);
    const name = String(memberSnapshot.data()?.displayName ?? "").trim() || principal.email?.split("@")[0] || "Studio member";
    const studioName = String(studioSnapshot.data()?.name ?? "StudioFlow Pilates").trim() || "StudioFlow Pilates";
    const workspaceLinks = workspace === "/studio" && principal.roles.includes("trainer") ? [{ href: "/trainer", label: "Switch to Trainer view" }] : workspace === "/trainer" && principal.roles.some((role) => role === "owner" || role === "staff") ? [{ href: "/studio", label: "Switch to Staff view" }] : [];
    return { name, studioName, role: roleLabel(principal.roles), workspaceLinks };
  } catch {
    return null;
  }
}

/** Presentation-only chrome; route pages remain the authority for access. */
export async function WorkspaceShell({ workspace, homeHref, children }: WorkspaceShellProps) {
  const data = await loadShellData(workspace);
  if (!data) return <>{children}</>;
  return <div className={styles.shell}><WorkspaceLiveRefresh />
    <header className={styles.header}>
      <a className={styles.brand} href={homeHref} aria-label="StudioFlow workspace home"><span>S</span><b>studioflow</b></a>
      <WorkspaceProfileMenu name={data.name} role={data.role} studioName={data.studioName} customerProfile={workspace === "/customer"} workspaceLinks={data.workspaceLinks} />
    </header>
    {children}
  </div>;
}
