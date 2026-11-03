import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { StudioAction,StudioIcon } from "@/app/components/studio-icon";
import { readDocument } from "@/lib/firebase/reads";
import { requireWorkspace } from "@/lib/auth/server";
import { getAttendanceRoster, type AttendanceRoster } from "@/lib/attendance";
import { getAssignedTrainerSlots } from "@/lib/trainer-schedule";
import { TrainerAttendance } from "./trainer-attendance";
import styles from "../trainer-ui.module.css";

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
  return <nav className={styles.tabs} aria-label="Attendance period">{tabs.map((tab) => <Link prefetch={false} key={tab.value} href={tab.value === "today" ? "/trainer/attendance" : `/trainer/attendance?view=${tab.value}`} aria-current={active === tab.value ? "page" : undefined}><StudioAction icon={tab.value==="today"?"calendar":tab.value==="upcoming"?"clock":"history"}>{tab.label}</StudioAction></Link>)}</nav>;
}

export default async function TrainerAttendancePage({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/trainer"); } catch { redirect("/access-denied"); }

  const requestedView = (await searchParams).view;
  const view: View = requestedView === "upcoming" || requestedView === "history" ? requestedView : "today";
  const [slots,studio] = await Promise.all([getAssignedTrainerSlots(principal),readDocument(`studios/${principal.studioId}`)]);
  const timezone = String(studio.data()?.timezone ?? "UTC");
  const today = localDateKey(new Date(), timezone);
  const eligibleSlots = slots.filter((slot) => slot.status === "published" || slot.status === "completed");
  const filteredSlots = eligibleSlots.filter((slot) => view === "today" ? slot.localDate === today : view === "upcoming" ? slot.localDate > today : slot.localDate < today).sort((left, right) => view === "history" ? right.startsAt.getTime() - left.startsAt.getTime() : left.startsAt.getTime() - right.startsAt.getTime());
  const results = await Promise.all(filteredSlots.map(async (slot) => {
    try { return await getAttendanceRoster(principal, slot.id); } catch (error) { console.error("Studio Calendar trainer attendance list failed for slot.", error); return null; }
  }));
  const rosters = results.filter((roster): roster is AttendanceRoster => roster !== null).map(roster=>({...roster,entries:roster.entries.map(entry=>({...entry,customerEmail:""}))}));

  return <main className={styles.page}>
    <header className={styles.header}>
      <h1><StudioAction icon="check">Attendance</StudioAction></h1>
    </header>
    <DateTabs active={view} />
    <section className={styles.schedule} aria-labelledby="attendance-date">
      <header className={styles.sectionHeading}><h2 id="attendance-date">{view === "today" ? displayDate(today) : view === "upcoming" ? "Upcoming classes" : "Attendance history"}</h2><span className={styles.muted}>{rosters.length} {rosters.length === 1 ? "class" : "classes"}</span></header>
      <TrainerAttendance rosters={rosters} emptyLabel={view === "today" ? "No classes scheduled for today." : view === "upcoming" ? "No upcoming classes assigned." : "No earlier classes to show."} />
    </section>
    <p className={styles.timezone}><StudioIcon name="clock"/>Studio time · {timezone}</p>
  </main>;
}
