import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requireWorkspace } from "@/lib/auth/server";
import styles from "@/app/components/trainer-manager.module.css";
import shared from "@/app/components/schedule.module.css";

const permissions = [
  ["Owner", "Manage membership invitations and access, studio-controlled settings, and all staff operations."],
  ["Staff", "Manage classes, schedules, customers, and other operational work within the studio."],
  ["Trainer", "View assigned classes and complete the trainer attendance workflow."],
];

export default async function RolesPermissionsPage() {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/"); }
  if (!principal.roles.includes("owner")) redirect("/access-denied");
  return <main className={`${shared.page} ${shared.studioPolish} ${styles.page}`}><header className={styles.header}><div><p className={shared.kicker}>TEAM</p><h1>Roles &amp; Permissions</h1><p>Role access is defined by the studio’s approved permissions model.</p></div></header><section className={styles.panel}><h2>Current role access</h2><ul className={styles.invitations}>{permissions.map(([role, access]) => <li key={role}><b>{role}</b><span>{access}</span></li>)}</ul><p className={shared.note}>Role behavior follows <code>docs/ROLES_PERMISSIONS.md</code>. Changes to the permissions model require product approval.</p></section></main>;
}
