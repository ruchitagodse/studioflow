import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { requireWorkspace } from "@/lib/auth/server";
import { getAttendanceRoster } from "@/lib/attendance";
import { AttendanceRosterActions } from "@/app/components/attendance-roster";
import { StudioAction,StudioIcon } from "@/app/components/studio-icon";
import { trainerDisplayDate } from "@/lib/trainer-display";
import styles from "../../trainer-ui.module.css";

export default async function TrainerRosterPage({params}:{params:Promise<{slotId:string}>}) {
  await connection();let principal;
  try{principal=await requireWorkspace("/trainer");}catch{redirect("/access-denied");}
  const {slotId}=await params;let roster;
  try{roster=await getAttendanceRoster(principal,slotId);}catch{redirect("/access-denied");}
  return <main className={styles.page}>
    <Link prefetch={false} href="/trainer/classes" className={styles.textLink}><StudioAction icon="back">My classes</StudioAction></Link>
    <header className={styles.header}><p className={styles.eyebrow}>{trainerDisplayDate(roster.localDate)}</p><h1>{roster.className}</h1><p><StudioAction icon="clock">{roster.startTime} – {roster.endTime}</StudioAction></p></header>
    <div className={styles.summary}><div><span><StudioAction icon="user">Trainer</StudioAction></span><b>{roster.trainerName}</b></div><div><span><StudioAction icon="users">Clients on roster</StudioAction></span><strong>{roster.entries.length}</strong></div></div>
    <AttendanceRosterActions roster={{...roster,role:"trainer",entries:roster.entries.map(entry=>({...entry,customerEmail:""}))}}/>
    <p className={styles.timezone}><StudioIcon name="clock"/>Studio time · {roster.timezone}</p>
  </main>;
}
