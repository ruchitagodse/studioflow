"use client";

import { useActionState, useState } from "react";
import { correctAttendanceAction, markAttendanceAction, type AttendanceActionState } from "@/app/attendance-actions";
import styles from "./attendance.module.css";

type Entry = { bookingId: string; customerName: string; customerEmail: string; status: "confirmed" | "attended" | "no-show" };
type Roster = { slotId: string; window: "before" | "open" | "locked"; role: "trainer" | "staff" | "owner"; entries: Entry[] };
const initial: AttendanceActionState = {};

function AttendanceIcon({ name }: { name: "info" | "person" | "check" | "cross" | "lock" }) {
  const paths = {
    info: <><circle cx="12" cy="12" r="8" /><path d="M12 11v5M12 8h.01" /></>,
    person: <><circle cx="12" cy="8" r="3" /><path d="M5.5 20c.7-4.2 2.9-6.2 6.5-6.2s5.8 2 6.5 6.2" /></>,
    check: <><circle cx="12" cy="12" r="8" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></>,
    cross: <><circle cx="12" cy="12" r="8" /><path d="m9 9 6 6m0-6-6 6" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  };
  return <span className={styles.icon} aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">{paths[name]}</svg></span>;
}

function MarkActions({ slotId, bookingId, disabled }: { slotId: string; bookingId: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(markAttendanceAction, initial);
  const [operationId] = useState(() => crypto.randomUUID());
  const [savingOutcome, setSavingOutcome] = useState<"attended" | "no-show" | null>(null);
  return <form action={action} className={styles.markForm}>
    <input type="hidden" name="slotId" value={slotId} /><input type="hidden" name="bookingId" value={bookingId} /><input type="hidden" name="operationId" value={operationId} />
    <button className={styles.attendedButton} name="outcome" value="attended" onClick={() => setSavingOutcome("attended")} disabled={disabled || pending}><AttendanceIcon name="check" />{pending && savingOutcome === "attended" ? "Saving…" : "Attended"}</button>
    <button className={styles.noShowButton} name="outcome" value="no-show" onClick={() => setSavingOutcome("no-show")} disabled={disabled || pending}><AttendanceIcon name="cross" />{pending && savingOutcome === "no-show" ? "Saving…" : "No-show"}</button>
    {state.error && <p className={styles.error} role="alert">{state.error}</p>}{state.success && <p className={styles.success} role="status">{state.success}</p>}
  </form>;
}

function Correction({ slotId, bookingId, current }: { slotId: string; bookingId: string; current: "attended" | "no-show" }) {
  const [state, action, pending] = useActionState(correctAttendanceAction, initial);
  const [operationId] = useState(() => crypto.randomUUID());
  const next = current === "attended" ? "no-show" : "attended";
  return <details className={styles.correction}><summary>Correct outcome</summary><form action={action} className={styles.correctionForm}>
    <input type="hidden" name="slotId" value={slotId} /><input type="hidden" name="bookingId" value={bookingId} /><input type="hidden" name="operationId" value={operationId} /><input type="hidden" name="outcome" value={next} />
    <p>Change to <b>{next === "no-show" ? "No-show" : "Attended"}</b>. The original outcome remains in the audit history.</p>
    <label>Reason <input name="reason" minLength={2} maxLength={300} required disabled={pending} /></label>
    <button disabled={pending}>{pending ? "Saving…" : "Save correction"}</button>
    {state.error && <p className={styles.error} role="alert">{state.error}</p>}{state.success && <p className={styles.success} role="status">{state.success}</p>}
  </form></details>;
}

export function AttendanceRosterActions({ roster }: { roster: Roster }) {
  const attended = roster.entries.filter((entry) => entry.status === "attended").length;
  const noShow = roster.entries.filter((entry) => entry.status === "no-show").length;
  const canCorrect = roster.role === "owner" || roster.role === "staff";
  const windowNotice = roster.window === "before"
    ? <><b>Attendance has not opened yet.</b> Marking becomes available at the scheduled class start.</>
    : roster.window === "locked"
      ? <><b>Attendance window closed — marking is unavailable.</b> Initial attendance can only be recorded from class start until 30 minutes after the scheduled end. Owner/Staff may correct an outcome already recorded, with a reason.</>
      : <><b>Attendance is open.</b> Mark outcomes before 30 minutes after the scheduled class end.</>;
  const windowClass = roster.window === "open" ? styles.windowOpen : roster.window === "locked" ? styles.windowLocked : styles.windowBefore;
  return <section className={styles.roster} aria-label="Attendance roster"><div className={`${styles.window} ${windowClass}`}><AttendanceIcon name="info" /><p>{windowNotice}</p></div>
    {roster.entries.length === 0 ? <p className={styles.empty}>There are no eligible confirmed bookings in this roster.</p> : <div className={styles.rows}>{roster.entries.map((entry) => <article key={entry.bookingId} className={styles.row}><div className={styles.customer}><span className={styles.avatar} aria-hidden="true"><span>{entry.customerName.slice(0, 1)}</span></span><div><b>{entry.customerName}</b>{entry.customerEmail && <span>{entry.customerEmail}</span>}</div></div><div className={styles.rowActions}>{entry.status === "confirmed" ? <><MarkActions slotId={roster.slotId} bookingId={entry.bookingId} disabled={roster.window !== "open"} />{roster.window === "before" && <p className={styles.availableLater}><AttendanceIcon name="lock" />Available when the class starts.</p>}</> : <><em className={entry.status === "attended" ? styles.attended : styles.noShow}>{entry.status === "attended" ? "Attended" : "No-show"}</em>{canCorrect && <Correction slotId={roster.slotId} bookingId={entry.bookingId} current={entry.status} />}</>}</div></article>)}</div>}
    <footer className={styles.summary}><span><b>{attended}</b> attended</span><span><b>{noShow}</b> no-show</span></footer>
  </section>;
}
