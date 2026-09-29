import { redirect } from "next/navigation";
import { connection } from "next/server";
import Image from "next/image";
import styles from "@/app/trainer/trainer-dashboard.module.css";
import { requireWorkspace } from "@/lib/auth/server";
import { getAssignedTrainerSlots } from "@/lib/trainer-schedule";
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

function statusClass(status: string) {
  if (status === "published") return styles.published;
  if (status === "completed") return styles.completed;
  return styles.draft;
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
  const todayBooked = todaySlots.reduce((total, slot) => total + slot.confirmedBookingCount, 0);
  const nextSlot = slots.find((slot) => slot.startsAt.getTime() > now.getTime()) ?? null;
  const trainerName = String(memberSnapshot.data()?.displayName ?? "").trim() || "Trainer";
  const morning = Number(new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hourCycle: "h23" }).format(now)) < 12;

  return <main className={styles.page}>
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
      <article className={`${styles.metric} ${styles.nextMetric}`}><span><i className={styles.metricIcon} aria-hidden="true">◫</i>Next class</span><strong>{nextSlot ? nextSlot.startTime : "—"}</strong><small>{nextSlot ? `${nextSlot.className} · ${nextSlot.localDate}` : "No upcoming class"}</small></article>
    </section>

    <section className={styles.schedule} aria-labelledby="assigned-classes">
      <div className={styles.sectionHeader}>
        <div><p className={styles.kicker}>ASSIGNED CLASSES</p><h2 id="assigned-classes">Your schedule</h2></div>
        <span>{slots.length} {slots.length === 1 ? "class" : "classes"}</span>
      </div>
      {slots.length === 0 ? <div className={styles.empty}><span aria-hidden="true">◌</span><h3>No classes assigned</h3><p>Your assigned classes will appear here.</p></div> : <div className={styles.classList}>{slots.map((slot) => {
        const available = Math.max(0, slot.capacity - slot.confirmedBookingCount);
        const isNext = nextSlot?.id === slot.id;
        return <article className={`${styles.classCard}${isNext ? ` ${styles.nextCard}` : ""}`} key={slot.id}>
          <div className={styles.cardTop}>
            <div><p className={styles.classDate}>{slot.localDate}</p><h3>{slot.className}</h3><em className={statusClass(slot.status)}>{slot.status}</em></div>
            <Image className={styles.classVisual} src={studioImage} alt="" sizes="110px" />
          </div>
          <div className={styles.timeRow}><strong>{slot.startTime} — {slot.endTime}</strong><span>{slot.timezone}</span></div>
          <div className={styles.classDetails}>
            <span><b aria-hidden="true">◉</b>{slot.confirmedBookingCount} / {slot.capacity} booked <small>{available} {available === 1 ? "place" : "places"} open</small></span>
            <span>Trainer: <b>{slot.trainerName}</b></span>
          </div>
          <footer className={styles.cardFooter}>
            {isNext ? <span className={styles.nextLabel}>Next up</span> : <span />}
            {slot.status === "published" ? <a className={styles.rosterLink} href={`/trainer/slots/${slot.id}`}>View roster <span aria-hidden="true">→</span></a> : <span className={styles.unavailable}>Roster opens when published</span>}
          </footer>
        </article>;
      })}</div>}
    </section>
    <TrainerMobileNav active="home" />
  </main>;
}
