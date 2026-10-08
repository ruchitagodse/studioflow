"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { markAttendanceAction, type AttendanceActionState } from "@/app/attendance-actions";
import type { AttendanceRoster } from "@/lib/attendance";
import studioImage from "@/app/assets/pilates-studio.png";
import styles from "./trainer-attendance.module.css";

const initial: AttendanceActionState = {};

function timeParts(value: string) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return { time: value, period: "" };
  const hour = Number(match[1]);
  return { time: String(((hour + 11) % 12) + 1).padStart(2, "0"), period: hour >= 12 ? "PM" : "AM" };
}

function StudentActions({ slotId, bookingId, disabled }: { slotId: string; bookingId: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(markAttendanceAction, initial);
  const [operationId] = useState(() => crypto.randomUUID());
  const [outcome, setOutcome] = useState<"attended" | "no-show" | null>(null);
  return <form action={action} className={styles.actions}>
    <input type="hidden" name="slotId" value={slotId} /><input type="hidden" name="bookingId" value={bookingId} /><input type="hidden" name="operationId" value={operationId} />
    <button className={styles.present} name="outcome" value="attended" onClick={() => setOutcome("attended")} disabled={disabled || pending}><span aria-hidden="true">✓</span>{pending && outcome === "attended" ? "Saving…" : "Present"}</button>
    <button className={styles.noShow} name="outcome" value="no-show" onClick={() => setOutcome("no-show")} disabled={disabled || pending}><span aria-hidden="true">×</span>{pending && outcome === "no-show" ? "Saving…" : "No-show"}</button>
    {state.error && <p className={styles.error} role="alert">{state.error}</p>}
    {state.success && <p className={styles.success} role="status">{state.success}</p>}
  </form>;
}

function AttendanceCard({ roster, open, onToggle }: { roster: AttendanceRoster; open: boolean; onToggle: () => void }) {
  const attended = roster.entries.filter((entry) => entry.status === "attended").length;
  const noShow = roster.entries.filter((entry) => entry.status === "no-show").length;
  const pending = roster.entries.filter((entry) => entry.status === "confirmed").length;
  const start = timeParts(roster.startTime);
  const markingDisabled = roster.window !== "open";
  return <article className={`${styles.card}${open ? ` ${styles.expanded}` : ""}`}>
    <button className={styles.cardToggle} type="button" onClick={onToggle} aria-expanded={open} aria-controls={`roster-${roster.slotId}`}>
      <time className={styles.time}><strong>{start.time}</strong><span>{start.period}</span></time>
      <Image className={styles.classImage} src={studioImage} alt="" sizes="48px" />
      <span className={styles.cardCopy}><b>{roster.className}</b><small>{roster.startTime} – {roster.endTime}</small><small className={styles.location}><span aria-hidden="true">⌖</span>{roster.timezone}</small><em><span aria-hidden="true">♙</span>{roster.confirmedBookingCount} / {roster.capacity} booked</em></span>
      <span className={styles.chevron} aria-hidden="true">⌄</span>
    </button>
    {open && <div className={styles.details} id={`roster-${roster.slotId}`}>
      <div className={styles.counts} aria-label="Attendance summary"><span className={styles.countPresent}><b>Present</b>{attended}</span><span className={styles.countPending}><b>Pending</b>{pending}</span><span className={styles.countNoShow}><b>No-show</b>{noShow}</span></div>
      {roster.window !== "open" && <p className={styles.windowNotice}>{roster.window === "before" ? "Attendance opens when this class starts." : "Attendance is locked for this class."}</p>}
      {roster.entries.length === 0 ? <p className={styles.emptyRoster}>There are no eligible bookings for attendance.</p> : <div className={styles.students}><h3>Clients ({roster.entries.length})</h3>{roster.entries.map((entry) => <div className={styles.student} key={entry.bookingId}><span className={styles.avatar} aria-hidden="true">{entry.customerName.slice(0, 1).toUpperCase()}</span><b>{entry.customerName}</b>{entry.status === "confirmed" ? <><em className={styles.pending}>Pending</em><StudentActions slotId={roster.slotId} bookingId={entry.bookingId} disabled={markingDisabled} /></> : <em className={entry.status === "attended" ? styles.donePresent : styles.doneNoShow}>{entry.status === "attended" ? "Present" : "No-show"}</em>}</div>)}</div>}
    </div>}
  </article>;
}

export function TrainerAttendance({ rosters, emptyLabel }: { rosters: AttendanceRoster[]; emptyLabel: string }) {
  const [openSlotId, setOpenSlotId] = useState<string | null>(rosters[0]?.slotId ?? null);
  if (!rosters.length) return <section className={styles.emptyState} aria-live="polite"><span aria-hidden="true">◌</span><h3>No attendance to record</h3><p>{emptyLabel}</p></section>;
  return <div className={styles.cards}>{rosters.map((roster) => <AttendanceCard key={roster.slotId} roster={roster} open={openSlotId === roster.slotId} onToggle={() => setOpenSlotId((current) => current === roster.slotId ? null : roster.slotId)} />)}</div>;
}
