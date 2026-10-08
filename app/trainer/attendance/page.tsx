import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { TrainerMobileNav } from "@/app/components/trainer-mobile-nav";
import { requireWorkspace } from "@/lib/auth/server";
import { getAttendanceRoster, type AttendanceRoster } from "@/lib/attendance";
import { getAssignedTrainerSlots } from "@/lib/trainer-schedule";
import { TrainerAttendance } from "./trainer-attendance";
import styles from "./trainer-attendance.module.css";

type View = "today" | "upcoming" | "history";

function localDateKey(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function displayDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

function DateTabs({ active }: { active: View }) {
  const tabs: { value: View; label: string }[] = [{ value: "today", label: "Today" }, { value: "upcoming", label: "Upcoming" }, { value: "history", label: "History" }];
  return <nav className={styles.tabs} aria-label="Attendance period">{tabs.map((tab) => <Link key={tab.value} href={tab.value === "today" ? "/trainer/attendance" : `/trainer/attendance?view=${tab.value}`} aria-current={active === tab.value ? "page" : undefined}>{tab.label}</Link>)}</nav>;
}

export default async function TrainerAttendancePage({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/trainer"); } catch { redirect("/access-denied"); }

  const requestedView = (await searchParams).view;
  const view: View = requestedView === "upcoming" || requestedView === "history" ? requestedView : "today";
  const slots = await getAssignedTrainerSlots(principal);
  const timezone = slots[0]?.timezone || "UTC";
  const today = localDateKey(new Date(), timezone);
  const eligibleSlots = slots.filter((slot) => slot.status === "published" || slot.status === "completed");
  const filteredSlots = eligibleSlots.filter((slot) => view === "today" ? slot.localDate === today : view === "upcoming" ? slot.localDate > today : slot.localDate < today).sort((left, right) => view === "history" ? right.startsAt.getTime() - left.startsAt.getTime() : left.startsAt.getTime() - right.startsAt.getTime());
  const results = await Promise.all(filteredSlots.map(async (slot) => {
    try { return await getAttendanceRoster(principal, slot.id); } catch (error) { console.error("StudioFlow trainer attendance list failed for slot.", error); return null; }
  }));
  const rosters = results.filter((roster): roster is AttendanceRoster => roster !== null);

  return <main className={styles.page}>
    <header className={styles.header}>
      <p className={styles.eyebrow}>TRAINER WORKSPACE</p>
      <h1>Attendance</h1>
      <p>Mark student attendance</p>
      <DateTabs active={view} />
    </header>
    <section className={styles.schedule} aria-labelledby="attendance-date">
      <header className={styles.scheduleHeader}><h2 id="attendance-date">{view === "today" ? `Today · ${displayDate(today)}` : view === "upcoming" ? "Upcoming classes" : "Attendance history"}</h2><span>{rosters.length} {rosters.length === 1 ? "class" : "classes"}</span></header>
      <TrainerAttendance rosters={rosters} emptyLabel={view === "today" ? "No classes scheduled for today." : view === "upcoming" ? "No upcoming classes assigned." : "No earlier classes to show."} />
    </section>
    <TrainerMobileNav active="attendance" />
  </main>;
}
