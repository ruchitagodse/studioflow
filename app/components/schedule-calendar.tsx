"use client";

import { StudioIcon, StudioAction } from "@/app/components/studio-icon";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { calendarLabel, calendarWeek, shiftCalendarDate } from "@/lib/customer-calendar";
import styles from "./studio-daily-calendar.module.css";

export type CalendarSlot = { id: string; className: string; trainerUid: string; trainerName: string; localDate: string; startTime: string; endTime: string; capacity: number; confirmedBookingCount: number; status: string; isPast: boolean };

export function ScheduleCalendar({ slots, onSelect, onViewAll, date, today }: { date?: string; period?: "day" | "week" | "month"; today?: string; slots: CalendarSlot[]; onSelect: (slot: CalendarSlot) => void; onViewAll: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [trainer, setTrainer] = useState("all");
  const [status, setStatus] = useState("all");
  const selected = date ?? today ?? new Date().toISOString().slice(0, 10);
  const days = calendarWeek(selected);
  const visible = slots.filter((slot) => slot.localDate === selected && (trainer === "all" || slot.trainerUid === trainer) && (status === "all" || slot.status === status) && `${slot.className} ${slot.trainerName}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => a.startTime.localeCompare(b.startTime) || a.className.localeCompare(b.className));
  const trainers = [...new Map(slots.map((slot) => [slot.trainerUid, slot.trainerName])).entries()];
  const filterCount = Number(trainer !== "all") + Number(status !== "all");
  const navigate = (next: string) => startTransition(() => router.push(`/studio/schedule?date=${next}&view=week`));
  const cancelledCount = visible.filter((slot) => slot.status === "cancelled").length;

  return <section className={styles.surface} aria-label="Studio calendar" aria-busy={pending}>
    <header className={styles.header}>
      <h1>Schedule</h1>
      <div className={styles.controls}>
        <button type="button" disabled={pending} onClick={() => navigate(today ?? selected)}><StudioAction icon="calendar">Today</StudioAction></button>
        <button type="button" disabled={pending} aria-label="Previous week" onClick={() => navigate(shiftCalendarDate(selected, -7))}><StudioIcon name="back" /></button>
        <button type="button" disabled={pending} aria-label="Next week" onClick={() => navigate(shiftCalendarDate(selected, 7))}><StudioIcon name="arrow" /></button>
      </div>
    </header>
    <div className={styles.range}>
      <p>{calendarLabel(days[0], { day: "numeric", month: "short" })} – {calendarLabel(days[6], { day: "numeric", month: "short", year: "numeric" })}</p>
      <label><span className="sr-only">Go to studio date</span><input type="date" value={selected} disabled={pending} onChange={(event) => { if (event.target.value) navigate(event.target.value); }} /></label>
    </div>
    <div className={styles.week} role="group" aria-label="Choose a studio date">
      {days.map((day) => {
        const count = slots.filter((slot) => slot.localDate === day && slot.status !== "cancelled").length;
        return <button type="button" key={day} disabled={pending} aria-pressed={selected === day} aria-label={`${calendarLabel(day, { weekday: "long", day: "numeric", month: "long" })}${day === today ? ", today" : ""}`} onClick={() => navigate(day)}>
          <span>{calendarLabel(day, { weekday: "short" })}</span>
          <strong><time dateTime={day} aria-current={day === today ? "date" : undefined}>{day.slice(-2)}</time></strong>
          <i aria-hidden="true" data-listed={count > 0} />
        </button>;
      })}
    </div>
    <div className={styles.listHeader}>
      <div><h2>{calendarLabel(selected, { weekday: "long", day: "numeric", month: "short" })}</h2><p>{pending ? "Loading schedule…" : `${visible.length} listed slot${visible.length === 1 ? "" : "s"}${cancelledCount ? ` · ${cancelledCount} cancelled` : ""}`}</p></div>
      <button type="button" onClick={onViewAll}><StudioAction icon="list">View list</StudioAction></button>
    </div>
    <div className={styles.tools}>
      <label className={styles.search}><span className="sr-only">Search classes or trainers</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search class or trainer…" /></label>
      <details className={styles.filters}><summary><StudioIcon name="filter" /> Filters{filterCount ? ` (${filterCount})` : ""}</summary><div className={styles.filterPanel}>
        <label>Trainer<select value={trainer} onChange={(event) => setTrainer(event.target.value)}><option value="all">All trainers</option>{trainers.map(([uid, name]) => <option key={uid} value={uid}>{name}</option>)}</select></label>
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{[...new Set(slots.map((slot) => slot.status))].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <button type="button" onClick={() => { setTrainer("all"); setStatus("all"); }}>Clear filters</button>
      </div></details>
    </div>
    {(filterCount > 0 || query) && <p className={styles.filterNote}>Showing filtered slots for this date.</p>}
    <div className={styles.slots} aria-live="polite">
      {!visible.length && <div className={styles.empty}><h3>{query || filterCount ? "No matching slots" : "No slots listed for this day"}</h3><p>{query || filterCount ? "Try another search or clear the filters." : "Choose another date or create a slot."}</p></div>}
      {visible.map((slot) => {
        const cancelled = slot.status === "cancelled";
        const editable = !slot.isPast && !["cancelled", "completed"].includes(slot.status);
        const available = Math.max(0, slot.capacity - slot.confirmedBookingCount);
        return <article key={slot.id} className={styles.card} data-cancelled={cancelled}>
          <div className={styles.cardTop}><span className={styles.time}><StudioIcon name="clock" />{slot.startTime}–{slot.endTime}</span><span className={styles.status}>{cancelled ? "Cancelled" : `${slot.status}${slot.isPast ? " · Past" : ""}`}</span></div>
          <h3>{slot.className}</h3><p className={styles.trainer}><StudioIcon name="user" />With {slot.trainerName}</p>
          {cancelled ? <p className={styles.cancelledNotice}><StudioIcon name="close" /> Session cancelled · This class will not take place.</p> : <div className={styles.facts}><span><b>{slot.confirmedBookingCount} / {slot.capacity}</b> booked</span>{!slot.isPast && slot.status !== "completed" && <span>{available ? `${available} seats available` : "Full"}</span>}</div>}
          <div className={styles.actions}>
            {["published", "completed"].includes(slot.status) && <a href={`/studio/attendance/${slot.id}`}><StudioAction icon="users">View roster</StudioAction></a>}
            {editable && <button type="button" aria-label={`Edit ${slot.className} at ${slot.startTime}`} onClick={() => onSelect(slot)}><StudioAction icon="edit">Edit slot</StudioAction></button>}
          </div>
        </article>;
      })}
    </div>
  </section>;
}
