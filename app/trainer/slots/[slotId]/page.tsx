import { redirect } from "next/navigation";
import { connection } from "next/server";
import { TrainerMobileNav } from "@/app/components/trainer-mobile-nav";
import { requireWorkspace } from "@/lib/auth/server";
import { getAttendanceRoster } from "@/lib/attendance";
import { TrainerRosterActions } from "../trainer-roster-actions";
import styles from "../trainer-roster.module.css";

function RosterIcon({ name }: { name: "calendar" | "clock" | "pin" | "trainer" | "people" }) {
  const paths = {
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    trainer: <><circle cx="12" cy="7" r="3" /><path d="M5.5 20c.7-4.2 2.9-6.2 6.5-6.2s5.8 2 6.5 6.2" /></>,
    people: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3.5 20c.7-4 2.5-6 5.5-6s4.8 2 5.5 6M14.5 15c2.8 0 4.7 1.6 5.5 4.5" /></>,
  };
  return <span className={styles.icon} aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">{paths[name]}</svg></span>;
}

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
  return <main className={styles.page}>
    <a className={styles.back} href="/trainer/classes"><span aria-hidden="true">←</span> My classes</a>
    <header className={styles.header}>
      <p className={styles.kicker}>CLASS ATTENDANCE</p>
      <h1>{roster.className}</h1>
      <div className={styles.slotMeta} aria-label="Class details">
        <span><RosterIcon name="calendar" />{roster.localDate}</span>
        <span><RosterIcon name="clock" />{roster.startTime} – {roster.endTime}</span>
        <span><RosterIcon name="pin" />{roster.timezone}</span>
      </div>
    </header>
    <section className={styles.facts} aria-label="Class summary">
      <div><RosterIcon name="trainer" /><span>Trainer<strong>{roster.trainerName}</strong></span></div>
      <div><RosterIcon name="people" /><span>Booked<strong>{roster.confirmedBookingCount} / {roster.capacity}</strong></span></div>
    </section>
    <TrainerRosterActions roster={roster} />
    <TrainerMobileNav active="attendance" />
  </main>;
}
