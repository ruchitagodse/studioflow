import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requireWorkspace } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";
import styles from "./staff.module.css";

export default async function StaffPage() {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/"); }
  if (!principal.roles.includes("owner") || !principal.studioId) redirect("/access-denied");
  const docs = await getAdminDb().collection(`studios/${principal.studioId}/members`).where("roles", "array-contains", "staff").get();
  const staff = docs.docs.map((doc) => ({ uid: doc.id, name: String(doc.data().displayName ?? "") || "Name not provided", email: String(doc.data().email ?? ""), status: doc.data().status === "inactive" ? "inactive" : "active" }));
  return <main className={styles.page}>
    <header className={styles.header}>
      <p className={styles.kicker}>TEAM</p>
      <h1>Staff</h1>
      <p>View staff members separately from trainer management.</p>
    </header>
    <section className={styles.panel} aria-labelledby="staff-members-title">
      <div className={styles.panelHeading}>
        <div>
          <p className={styles.panelKicker}>STAFF DIRECTORY</p>
          <h2 id="staff-members-title">Staff members</h2>
        </div>
        <span className={styles.count}>{staff.length} {staff.length === 1 ? "member" : "members"}</span>
      </div>
      {staff.length ? <ul className={styles.list}>{staff.map((member) => <li key={member.uid} className={styles.member}>
        <span className={styles.avatar} aria-hidden="true">{member.name.slice(0, 1).toUpperCase()}</span>
        <span className={styles.memberDetails}><b>{member.name}</b><small>{member.email || "Email not available"}</small></span>
        <em className={member.status === "active" ? styles.active : styles.inactive}><i aria-hidden="true" />{member.status}</em>
      </li>)}</ul> : <div className={styles.empty}><b>No staff members yet</b><p>Staff accounts will appear here once they are added to this studio.</p></div>}
    </section>
  </main>;
}
