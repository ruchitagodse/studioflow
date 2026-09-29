import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AttendanceRosterActions } from "@/app/components/attendance-roster";
import styles from "@/app/components/attendance.module.css";
import internalStyles from "@/app/components/studio-internal.module.css";
import { requireWorkspace } from "@/lib/auth/server";
import { getAttendanceRoster } from "@/lib/attendance";

export default async function StudioAttendancePage({ params }: { params: Promise<{ slotId: string }> }) {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/access-denied"); }
  const { slotId } = await params;
  let roster;
  try { roster = await getAttendanceRoster(principal, slotId); } catch (error) {
    console.error("StudioFlow attendance roster failed.", error);
    redirect("/access-denied");
  }
  return <main className={`${styles.page} ${internalStyles.shell}`}><a className={`${styles.back} ${internalStyles.back}`} href="/studio">← Studio dashboard</a><header className={`${styles.header} ${internalStyles.header}`}><p className={styles.kicker}>STUDIO ATTENDANCE</p><h1>{roster.className}</h1><p>{roster.localDate} · {roster.startTime}–{roster.endTime} · {roster.timezone}</p></header><section className={styles.facts}><span><b>Trainer:</b> {roster.trainerName}</span><span><b>Booked:</b> {roster.confirmedBookingCount} / {roster.capacity}</span></section><div className={internalStyles.roster}><AttendanceRosterActions roster={roster} /></div></main>;
}
