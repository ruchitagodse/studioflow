import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requireWorkspace } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";
import styles from "@/app/components/trainer-manager.module.css";
import shared from "@/app/components/schedule.module.css";

export default async function StaffPage() {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/"); }
  if (!principal.roles.includes("owner") || !principal.studioId) redirect("/access-denied");
  const docs = await getAdminDb().collection(`studios/${principal.studioId}/members`).where("roles", "array-contains", "staff").get();
  const staff = docs.docs.map((doc) => ({ uid: doc.id, name: String(doc.data().displayName ?? "") || "Name not provided", email: String(doc.data().email ?? ""), status: doc.data().status === "inactive" ? "inactive" : "active" }));
  return <main className={`${shared.page} ${shared.studioPolish} ${styles.page}`}><header className={styles.header}><div><p className={shared.kicker}>TEAM</p><h1>Staff</h1><p>View staff members separately from trainer management.</p></div></header><section className={styles.panel}><h2>Staff members</h2>{staff.length ? <ul className={styles.invitations}>{staff.map((member) => <li key={member.uid}><span><b>{member.name}</b><small>{member.email}</small></span><em data-status={member.status}>{member.status}</em></li>)}</ul> : <p className={shared.empty}>No staff members are available.</p>}</section></main>;
}
