import { readDocument } from "@/lib/firebase/reads";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { requireWorkspace } from "@/lib/auth/server";
import { StudioAction,StudioIcon } from "@/app/components/studio-icon";
import { LogoutButton } from "@/app/components/logout-button";
import styles from "../trainer-ui.module.css";

export default async function TrainerProfilePage() {
  await connection();let principal;
  try{principal=await requireWorkspace("/trainer");}catch{redirect("/access-denied");}
  const [member,studio]=await Promise.all([readDocument(`studios/${principal.studioId}/members/${principal.uid}`),readDocument(`studios/${principal.studioId}`)]);
  const name=String(member.data()?.displayName??"").trim()||"Trainer";
  const initials=name.split(/\s+/).slice(0,2).map(word=>word[0]).join("").toUpperCase();
  return <main className={styles.page}><header className={styles.header}><h1><StudioAction icon="user">Profile</StudioAction></h1></header>
    <div className={styles.profileIdentity}><span className={styles.avatar} aria-hidden="true">{initials}</span><div><h2>{name}</h2><p>{principal.email??"Email not available"}</p></div></div>
    <section className={styles.profilePanel} aria-labelledby="trainer-account"><h2 id="trainer-account">Your account</h2><dl className={styles.profileDetails}><div><dt><StudioAction icon="user">Role</StudioAction></dt><dd>Trainer</dd></div><div><dt><StudioAction icon="membership">Studio</StudioAction></dt><dd>{String(studio.data()?.name??"Your studio")}</dd></div><div><dt><StudioAction icon="clock">Studio time</StudioAction></dt><dd>{String(studio.data()?.timezone??"UTC")}</dd></div></dl></section>
    <nav className={styles.profileLinks} aria-label="Trainer shortcuts"><Link prefetch={false} href="/trainer/classes"><StudioAction icon="calendar">My classes</StudioAction><StudioIcon name="arrow"/></Link><Link prefetch={false} href="/trainer/attendance"><StudioAction icon="check">Attendance</StudioAction><StudioIcon name="arrow"/></Link></nav>
    <LogoutButton className={styles.signout} withIcon/>
  </main>;
}
