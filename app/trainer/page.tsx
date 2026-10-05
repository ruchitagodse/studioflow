import { redirect } from "next/navigation";
import { connection } from "next/server";
import Image from "next/image";
import styles from "@/app/trainer/trainer-dashboard.module.css";
import { requireWorkspace } from "@/lib/auth/server";
import { getAssignedTrainerSlots } from "@/lib/trainer-schedule";
import { trainerSessionStatus, type TrainerSessionStatus } from "@/lib/trainer-schedule-logic";
import studioImage from "@/app/assets/pilates-studio.png";
import { TrainerMobileNav } from "@/app/components/trainer-mobile-nav";
import { getAdminDb } from "@/lib/firebase/admin";

function localDateKey(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function longDate(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, day: "numeric", month: "long", year: "numeric" }).format(date);
}

function displayTrainerDate(localDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) return localDate || "—";
  const [, year, month, day] = match;
  const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1];
  return monthName ? `${day} ${monthName} ${year}` : localDate;
}

function statusClass(status: TrainerSessionStatus) {
  if (status === "in-progress") return styles.inProgress;
  if (status === "completed") return styles.completed;
  if (status === "pending") return styles.pending;
  return styles.draft;
}

function statusLabel(status: TrainerSessionStatus) {
  if (status === "in-progress") return "In progress";
  if (status === "completed") return "Completed";
  if (status === "pending") return "Pending";
  return "Draft";
}

function ScheduleIcon({ name }: { name: "calendar" | "clock" | "location" | "people" | "trainer" }) {
  const paths = {
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
    location: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    people: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3.5 20c.7-4 2.5-6 5.5-6s4.8 2 5.5 6M14.5 15c2.8 0 4.7 1.6 5.5 4.5" /></>,
    trainer: <><circle cx="12" cy="7" r="3" /><path d="M5.5 20c.7-4.2 2.9-6.2 6.5-6.2s5.8 2 6.5 6.2" /></>,
  };
  return <span className={styles.scheduleCardIcon} aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">{paths[name]}</svg></span>;
}

export default async function TrainerWorkspace() {
  await connection();
  let principal;
  let accessError: unknown;
  try { principal = await requireWorkspace("/trainer"); } catch (error) {
    accessError = error;
    console.error("StudioFlow trainer access resolution failed.", error);
  }
  if (!principal) redirect(accessError instanceof Error && accessError.message === "NO_ACTIVE_SESSION" ? "/" : "/access-denied");

  const [slots, memberSnapshot] = await Promise.all([
    getAssignedTrainerSlots(principal),
    getAdminDb().doc(`studios/${principal.studioId}/members/${principal.uid}`).get(),
  ]);
  const timezone = slots[0]?.timezone || "UTC";
  const now = new Date();
  const todayKey = localDateKey(now, timezone);
  const todaySlots = slots.filter((slot) => slot.localDate === todayKey);
  const todayBooked = todaySlots.reduce((total, slot) => total + slot.rosterBookingCount, 0);
  const nextSlot = slots.find((slot) => slot.startsAt.getTime() > now.getTime()) ?? null;
  const trainerName = String(memberSnapshot.data()?.displayName ?? "").trim() || "Trainer";
  const morning = Number(new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hourCycle: "h23" }).format(now)) < 12;

  return <main className={`${styles.page} ${styles.dashboardPage}`}>
    <header className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.kicker}>TRAINER WORKSPACE</p>
        <h1>{morning ? "Good morning" : "Hello"}, {trainerName}.</h1>
        <p className={styles.intro}>{todaySlots.length > 0 ? `Here ${todaySlots.length === 1 ? "is" : "are"} your ${todaySlots.length} assigned ${todaySlots.length === 1 ? "class" : "classes"} for today.` : "Your assigned classes and rosters are ready when you are."}</p>
      </div>
      <div className={styles.heroAside}><Image className={styles.heroVisual} src={studioImage} alt="A calm Pilates studio" sizes="(max-width: 540px) 130px, 230px" priority /><p className={styles.dateContext}><span className={styles.dateIcon} aria-hidden="true">□</span> Today · {longDate(now, timezone)}</p></div>
    </header>

    <section className={styles.summary} aria-label="Today’s schedule summary">
      <article className={styles.metric}><span><i className={styles.metricIcon} aria-hidden="true">♧</i>Today’s classes</span><strong>{todaySlots.length}</strong><small>Assigned to you</small></article>
      <article className={styles.metric}><span><i className={styles.metricIcon} aria-hidden="true">□</i>Booked today</span><strong>{todayBooked}</strong><small>Across today’s classes</small></article>
      <article className={`${styles.metric} ${styles.nextMetric}`}><span><i className={styles.metricIcon} aria-hidden="true">◫</i>Next class</span><strong>{nextSlot ? nextSlot.startTime : "—"}</strong><small>{nextSlot ? `${nextSlot.className} · ${displayTrainerDate(nextSlot.localDate)}` : "No upcoming class"}</small></article>
    </section>

    <section className={styles.schedule} aria-labelledby="assigned-classes">
      <div className={styles.sectionHeader}>
        <div><p className={styles.kicker}>ASSIGNED CLASSES</p><h2 id="assigned-classes">Your schedule</h2></div>
        <span>{slots.length} {slots.length === 1 ? "class" : "classes"} <b aria-hidden="true">›</b></span>
      </div>
      {slots.length === 0 ? <div className={styles.empty}><span aria-hidden="true">◌</span><h3>No classes assigned</h3><p>Your assigned classes will appear here.</p></div> : <div className={styles.classList}>{slots.map((slot) => {
        const available = Math.max(0, slot.capacity - slot.rosterBookingCount);
        const isNext = nextSlot?.id === slot.id;
        const sessionStatus = trainerSessionStatus(slot, now);
        return <article className={`${styles.classCard}${isNext ? ` ${styles.nextCard}` : ""}`} key={slot.id}>
          <div className={styles.cardTop}>
            <div><p className={styles.classDate}><ScheduleIcon name="calendar" />{displayTrainerDate(slot.localDate)}</p><h3>{slot.className}</h3><em className={statusClass(sessionStatus)}><i aria-hidden="true" />{statusLabel(sessionStatus)}</em></div>
            <Image className={styles.classVisual} src={studioImage} alt="" sizes="(max-width: 720px) 34vw, 210px" />
          </div>
          <div className={styles.timeRow}><div><ScheduleIcon name="clock" /><strong>{slot.startTime} — {slot.endTime}</strong></div><span><ScheduleIcon name="location" />{slot.timezone}</span></div>
          <div className={styles.classDetails}>
            <span><ScheduleIcon name="people" /><span>{slot.rosterBookingCount} / {slot.capacity} booked <small>· &nbsp;{available} {available === 1 ? "place" : "places"} open</small></span></span>
            <span><ScheduleIcon name="trainer" /><span>Trainer: <b>{slot.trainerName}</b></span></span>
          </div>
          <footer className={styles.cardFooter}>
            {isNext ? <span className={styles.nextLabel}><i aria-hidden="true">›</i>Next up</span> : <span />}
            {slot.status === "published" ? <a className={styles.rosterLink} href={`/trainer/slots/${slot.id}`}>View roster <span aria-hidden="true">→</span></a> : <span className={styles.unavailable}>Roster opens when published</span>}
          </footer>
        </article>;
      })}</div>}
    </section>
    <TrainerMobileNav active="home" />
  </main>;
}
