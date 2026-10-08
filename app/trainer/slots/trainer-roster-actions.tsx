"use client";

import { useActionState, useState } from "react";
import { markAttendanceAction, type AttendanceActionState } from "@/app/attendance-actions";
import type { AttendanceRoster } from "@/lib/attendance";
import styles from "./trainer-roster.module.css";

const initial: AttendanceActionState = {};

function MarkActions({ slotId, bookingId, disabled }: { slotId: string; bookingId: string; disabled: boolean }) {
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

export function TrainerRosterActions({ roster }: { roster: AttendanceRoster }) {
  const attended = roster.entries.filter((entry) => entry.status === "attended").length;
  const noShow = roster.entries.filter((entry) => entry.status === "no-show").length;
  const pending = roster.entries.filter((entry) => entry.status === "confirmed").length;
  const notice = roster.window === "open" ? "Attendance is open. Mark each client before the attendance window closes." : roster.window === "before" ? "Attendance opens when this class starts." : "Attendance is locked for this class.";
  return <section className={styles.roster} aria-label="Class attendance">
    <p className={`${styles.windowNotice} ${roster.window === "open" ? styles.windowOpen : ""}`}>{notice}</p>
    {roster.entries.length === 0 ? <p className={styles.empty}>There are no eligible bookings for attendance.</p> : <div className={styles.clients}><h2>Clients ({roster.entries.length})</h2>{roster.entries.map((entry) => <article className={styles.client} key={entry.bookingId}>
      <span className={styles.avatar} aria-hidden="true">{entry.customerName.slice(0, 1).toUpperCase()}</span><b>{entry.customerName}</b>
      {entry.status === "confirmed" ? <><em className={styles.pending}>Pending</em><MarkActions slotId={roster.slotId} bookingId={entry.bookingId} disabled={roster.window !== "open"} /></> : <em className={entry.status === "attended" ? styles.donePresent : styles.doneNoShow}>{entry.status === "attended" ? "Present" : "No-show"}</em>}
    </article>)}</div>}
    <footer className={styles.summary}><span><b>{attended}</b>present</span><span><b>{pending}</b>pending</span><span><b>{noShow}</b>no-show</span></footer>
  </section>;
}
