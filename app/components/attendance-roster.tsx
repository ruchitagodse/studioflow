"use client";

import { StudioAction, StudioIcon } from "@/app/components/studio-icon";
import { useActionState, useEffect, useRef, useState } from "react";
import { correctAttendanceAction, markAttendanceAction, type AttendanceActionState } from "@/app/attendance-actions";
import styles from "./attendance.module.css";
import ui from "./studio-attendance.module.css";

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

function MarkActions({ slotId, bookingId, customerName, disabled }: { slotId: string; bookingId: string; customerName: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(markAttendanceAction, initial);
  const [operationId] = useState(() => crypto.randomUUID());
  const [outcome, setOutcome] = useState<"attended" | "no-show" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (outcome && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [outcome]);
  const close = () => { if (!pending) { dialog.current?.close(); setOutcome(null); } };
  return <div className={styles.markForm}>
    <button type="button" className={styles.attendedButton} onClick={() => setOutcome("attended")} disabled={disabled || pending}><AttendanceIcon name="check" />Attended</button>
    <button type="button" className={styles.noShowButton} onClick={() => setOutcome("no-show")} disabled={disabled || pending}><AttendanceIcon name="cross" />No-show</button>
    <dialog ref={dialog} className={ui.confirmation} aria-labelledby={`attendance-confirm-${bookingId}`} onCancel={(event) => { if (pending) event.preventDefault(); else setOutcome(null); }}>
      <h2 id={`attendance-confirm-${bookingId}`}><StudioAction icon={outcome === "no-show" ? "alert" : "check"}>Mark {outcome === "no-show" ? "no-show" : "attended"}?</StudioAction></h2>
      <p><strong>{customerName}</strong> will be marked {outcome === "no-show" ? "as a no-show" : "attended"}. Their reserved class credit will be used.</p>
      {outcome === "no-show" && <p className={ui.consequence}>A no-show is also recorded in incident history.</p>}
      <form action={action}>
        <input type="hidden" name="slotId" value={slotId} /><input type="hidden" name="bookingId" value={bookingId} /><input type="hidden" name="operationId" value={operationId} /><input type="hidden" name="outcome" value={outcome ?? "attended"} />
        {state.error && <p className={styles.error} role="alert">{state.error}</p>}{state.success && <p className={styles.success} role="status">{state.success}</p>}
        <div className={ui.confirmActions}><button type="button" disabled={pending} onClick={close}>Go back</button><button type="submit" disabled={pending || disabled}><StudioAction icon="check">{pending ? "Saving…" : "Confirm attendance"}</StudioAction></button></div>
      </form>
    </dialog>
  </div>;
}

function Correction({ slotId, bookingId, current }: { slotId: string; bookingId: string; current: "attended" | "no-show" }) {
  const [state, action, pending] = useActionState(correctAttendanceAction, initial);
  const [operationId] = useState(() => crypto.randomUUID());
  const next = current === "attended" ? "no-show" : "attended";
  return <details className={styles.correction}><summary><StudioAction icon="edit">Correct outcome</StudioAction></summary><form action={action} className={styles.correctionForm}>
    <input type="hidden" name="slotId" value={slotId} /><input type="hidden" name="bookingId" value={bookingId} /><input type="hidden" name="operationId" value={operationId} /><input type="hidden" name="outcome" value={next} />
    <p>Change to <b>{next === "no-show" ? "No-show" : "Attended"}</b>. The original outcome remains in the audit history.</p>
    <label>Reason <input name="reason" minLength={2} maxLength={300} required disabled={pending} /></label>
    <button disabled={pending}><StudioAction icon="save">{pending ? "Saving…" : "Save correction"}</StudioAction></button>
    {state.error && <p className={styles.error} role="alert">{state.error}</p>}{state.success && <p className={styles.success} role="status">{state.success}</p>}
  </form></details>;
}

export function AttendanceRosterActions({ roster }: { roster: Roster }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Entry["status"]>("all");
  const attended = roster.entries.filter((entry) => entry.status === "attended").length;
  const pending = roster.entries.filter((entry) => entry.status === "confirmed").length;
  const noShow = roster.entries.filter((entry) => entry.status === "no-show").length;
  const visible = roster.entries.filter((entry) => (filter === "all" || entry.status === filter) && `${entry.customerName} ${entry.customerEmail}`.toLowerCase().includes(query.trim().toLowerCase()));
  const canCorrect = roster.role === "owner" || roster.role === "staff";
  const windowNotice = roster.window === "before"
    ? <><b>Attendance has not opened yet.</b> Marking becomes available at the scheduled class start.</>
    : roster.window === "locked"
      ? <><b>Attendance locked.</b> {canCorrect ? "Owner/Staff can correct an existing outcome with a reason." : "Contact studio staff if an outcome needs correcting."}</>
      : <><b>Attendance is open.</b> Mark outcomes before 1 hour after the scheduled class end.</>;
  const windowClass = roster.window === "open" ? styles.windowOpen : roster.window === "locked" ? styles.windowLocked : styles.windowBefore;
  return <section className={`${styles.roster} ${ui.roster}`} aria-label="Class attendance"><div className={`${styles.window} ${windowClass}`}><AttendanceIcon name={roster.window === "locked" ? "lock" : "info"} /><p>{windowNotice}</p></div>
    <div className={ui.heading}><h2><StudioAction icon="users">Class roster</StudioAction></h2><span aria-live="polite">{visible.length} of {roster.entries.length}</span></div>
    <label className={ui.search}><StudioIcon name="search" /><span className="sr-only">{roster.role === "trainer" ? "Search roster clients" : "Search roster customers"}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={roster.role === "trainer" ? "Search client name…" : "Search customer name or email…"} /></label>
    <div className={ui.filters} role="group" aria-label="Attendance status">{([['all', 'All', roster.entries.length], ['confirmed', 'Pending', pending], ['attended', 'Attended', attended], ['no-show', 'No-show', noShow]] as const).map(([value, label, count]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}<b>{count}</b></button>)}</div>
    {roster.entries.length === 0 ? <p className={styles.empty}>There are no eligible confirmed bookings for attendance.</p> : <div className={styles.rows}>{visible.map((entry) => <article key={entry.bookingId} className={styles.row}><div className={styles.customer}><span className={styles.avatar} aria-hidden="true"><span>{entry.customerName.slice(0, 1)}</span></span><div><b>{entry.customerName}</b>{entry.customerEmail && <span>{entry.customerEmail}</span>}</div></div><div className={styles.rowActions}>{entry.status === "confirmed" ? <><MarkActions slotId={roster.slotId} bookingId={entry.bookingId} customerName={entry.customerName} disabled={roster.window !== "open"} />{roster.window === "before" && <p className={styles.availableLater}><AttendanceIcon name="lock" />Available when the class starts.</p>}</> : <><em className={entry.status === "attended" ? styles.attended : styles.noShow}><StudioAction icon={entry.status === "attended" ? "check" : "close"}>{entry.status === "attended" ? "Attended" : "No-show"}</StudioAction></em>{canCorrect && <Correction slotId={roster.slotId} bookingId={entry.bookingId} current={entry.status} />}</>}</div></article>)}</div>}
    {roster.entries.length > 0 && !visible.length && <div className={ui.empty}><p>No customers match these filters.</p><button type="button" onClick={() => { setQuery(""); setFilter("all"); }}>Clear search and filters</button></div>}
  </section>;
}
