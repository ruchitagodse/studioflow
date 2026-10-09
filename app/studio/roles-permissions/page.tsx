import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requireWorkspace } from "@/lib/auth/server";
import styles from "./roles-permissions.module.css";

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
  return <main className={styles.page}>
    <header className={styles.header}>
      <p className={styles.kicker}>TEAM</p>
      <h1>Roles &amp; Permissions</h1>
      <p>Role access is defined by the studio’s approved permissions model.</p>
    </header>
    <section className={styles.panel} aria-labelledby="role-access-title">
      <div className={styles.panelHeading}>
        <div>
          <p className={styles.panelKicker}>ACCESS OVERVIEW</p>
          <h2 id="role-access-title">Current role access</h2>
        </div>
        <span className={styles.count}>{permissions.length} roles</span>
      </div>
      <ul className={styles.list}>{permissions.map(([role, access]) => <li key={role} className={styles.role}>
        <span className={styles.roleMark} aria-hidden="true">{role.slice(0, 1)}</span>
        <span><b>{role}</b><small>{access}</small></span>
      </li>)}</ul>
    </section>
  </main>;
}
