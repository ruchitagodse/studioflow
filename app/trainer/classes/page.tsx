import { redirect } from "next/navigation";
import { connection } from "next/server";
import Image from "next/image";
import Link from "next/link";
import { TrainerMobileNav } from "@/app/components/trainer-mobile-nav";
import studioImage from "@/app/assets/pilates-studio.png";
import { requireWorkspace } from "@/lib/auth/server";
import { getAssignedTrainerSlots } from "@/lib/trainer-schedule";
import styles from "./trainer-classes.module.css";

type View = "today" | "tomorrow" | "week";

function localDateKey(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function calendarWeekRange(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  const firstDate = addDays(dateKey, -daysSinceMonday);
  return { firstDate, lastDate: addDays(firstDate, 6) };
}

function displayDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function shortTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return value;
  const hour = Number(match[1]);
  return { hour: String(((hour + 11) % 12) + 1).padStart(2, "0"), period: hour >= 12 ? "PM" : "AM" };
}

function DateTabs({ active }: { active: View }) {
  const tabs: { value: View; label: string }[] = [{ value: "today", label: "Today" }, { value: "tomorrow", label: "Tomorrow" }, { value: "week", label: "This week" }];
  return <nav className={styles.tabs} aria-label="Class date range">{tabs.map((tab) => <Link key={tab.value} href={tab.value === "today" ? "/trainer/classes" : `/trainer/classes?view=${tab.value}`} aria-current={active === tab.value ? "page" : undefined}>{tab.label}</Link>)}</nav>;
}

export default async function TrainerClassesPage({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/trainer"); } catch { redirect("/access-denied"); }

  const requestedView = (await searchParams).view;
  const view: View = requestedView === "tomorrow" || requestedView === "week" ? requestedView : "today";
  const slots = await getAssignedTrainerSlots(principal);
  const timezone = slots[0]?.timezone || "UTC";
  const today = localDateKey(new Date(), timezone);
  const week = calendarWeekRange(today);
  const firstDate = view === "week" ? week.firstDate : view === "tomorrow" ? addDays(today, 1) : today;
  const lastDate = view === "week" ? week.lastDate : view === "tomorrow" ? addDays(today, 1) : today;
  const visibleSlots = slots.filter((slot) => slot.localDate >= firstDate && slot.localDate <= lastDate).sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
  const slotsByDate = visibleSlots.reduce<Record<string, typeof visibleSlots>>((groups, slot) => {
    (groups[slot.localDate] ??= []).push(slot);
    return groups;
  }, {});

  return <main className={styles.page}>
    <header className={styles.header}>
      <p className={styles.eyebrow}>TRAINER SCHEDULE</p>
      <h1>My classes</h1>
      <DateTabs active={view} />
    </header>

    {visibleSlots.length === 0 ? <section className={styles.empty} aria-live="polite"><span aria-hidden="true">◌</span><h2>No classes scheduled</h2><p>You have no assigned classes in this period.</p></section> : <div className={styles.days}>
      {Object.entries(slotsByDate).map(([date, daySlots]) => <section className={styles.day} key={date} aria-labelledby={`date-${date}`}>
        <header><h2 id={`date-${date}`}>{displayDate(date)}</h2><span>{daySlots.length} {daySlots.length === 1 ? "class" : "classes"}</span></header>
        <div className={styles.classList}>{daySlots.map((slot) => {
          const time = shortTime(slot.startTime);
          return <Link key={slot.id} className={styles.classCard} href={`/trainer/slots/${slot.id}`} aria-label={`Open ${slot.className}, ${slot.localDate}, ${slot.startTime}`}>
            <time className={styles.time} dateTime={slot.startsAt.toISOString()}><strong>{typeof time === "string" ? time : time.hour}</strong>{typeof time !== "string" && <span>{time.period}</span>}</time>
            <Image src={studioImage} alt="" className={styles.classImage} sizes="56px" />
            <span className={styles.classInfo}><b>{slot.className}</b><small>{slot.startTime} – {slot.endTime}</small><small className={styles.location}><span aria-hidden="true">⌖</span>{slot.timezone}</small><em><span aria-hidden="true">♙</span>{slot.rosterBookingCount} / {slot.capacity} booked</em></span>
            <span className={styles.chevron} aria-hidden="true">›</span>
          </Link>;
        })}</div>
      </section>)}
    </div>}
    <TrainerMobileNav active="classes" />
  </main>;
}
