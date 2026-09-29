import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AttendanceRosterActions } from "@/app/components/attendance-roster";
import styles from "@/app/components/attendance.module.css";
import { requireWorkspace } from "@/lib/auth/server";
import { getAttendanceRoster } from "@/lib/attendance";

export default async function TrainerRosterPage({ params }: { params: Promise<{ slotId: string }> }) {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/trainer"); } catch { redirect("/access-denied"); }
  const { slotId } = await params;
  let roster;
  try { roster = await getAttendanceRoster(principal, slotId); } catch (error) {
    console.error("StudioFlow trainer roster failed.", error);
    redirect("/access-denied");
  }
  return <main className={styles.page}><a className={styles.back} href="/trainer">← Assigned classes</a><header className={styles.header}><p className={styles.kicker}>CLASS ROSTER</p><h1>{roster.className}</h1><p>{roster.localDate} · {roster.startTime}–{roster.endTime} · {roster.timezone}</p></header><section className={styles.facts}><span><b>Trainer:</b> {roster.trainerName}</span><span><b>Booked:</b> {roster.confirmedBookingCount} / {roster.capacity}</span></section><AttendanceRosterActions roster={roster} /></main>;
}
