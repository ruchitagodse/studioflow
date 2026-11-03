"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { StudioIcon, StudioAction } from "./studio-icon";
import { calendarLabel } from "@/lib/customer-calendar";
import { removeWaitlistEntryAction, type WaitlistManagementState } from "@/app/studio/waitlist-actions";
import styles from "./studio-waitlist.module.css";

type Entry = { id: string; slotId: string; customerUid: string; customer: string; email: string; className: string; localDate: string; startTime: string; joinedAt: string; position: number };
const initial: WaitlistManagementState = {};
function dateLabel(value: string) { try { return calendarLabel(value, { day: "numeric", month: "short", year: "numeric" }); } catch { return value; } }

function RemoveEntry({ entry, onClose, onRemoved }: { entry: Entry; onClose: () => void; onRemoved: (message: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [operationId] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState(async (previous: WaitlistManagementState, form: FormData) => {
    const result = await removeWaitlistEntryAction(previous, form);
    if (result.success) onRemoved(result.success);
    return result;
  }, initial);
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); }, []);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="remove-waitlist-title" onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}>
    <header><h2 id="remove-waitlist-title"><StudioAction icon="remove">Remove waitlist entry?</StudioAction></h2><button type="button" disabled={pending} aria-label="Close remove waitlist dialog" onClick={onClose}><StudioIcon name="close" /></button></header>
    <div className={styles.removalContext}><strong>{entry.customer}</strong><span>{entry.className} · {dateLabel(entry.localDate)} · {entry.startTime}</span><span>Queue position #{entry.position}</span></div>
    <p>This removes their place in this class queue. No credits are used or returned.</p>
    <form action={action}>
      <input type="hidden" name="entryId" value={entry.id} /><input type="hidden" name="operationId" value={operationId} />
      <label>Removal reason<textarea name="reason" required minLength={2} maxLength={300} placeholder="Explain why this entry is being removed" disabled={pending} /></label>
      {state.error && <p className={styles.error} role="alert">{state.error}</p>}
      <footer><button type="button" disabled={pending} onClick={onClose}>Go back</button><button type="submit" disabled={pending}><StudioAction icon="remove">{pending ? "Removing…" : "Remove entry"}</StudioAction></button></footer>
    </form>
  </dialog>;
}

export function WaitlistManagement({ entries, timezone }: { entries: Entry[]; timezone: string }) {
  const [query, setQuery] = useState("");
  const [slotId, setSlotId] = useState("all");
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [notice, setNotice] = useState("");
  const queues = [...new Map(entries.map((entry) => [entry.slotId, entry])).values()];
  const visible = entries.filter((entry) => (slotId === "all" || slotId === entry.slotId) && `${entry.customer} ${entry.email} ${entry.className}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className={styles.queue} aria-labelledby="current-waitlist">
    <header className={styles.heading}><h2 id="current-waitlist"><StudioAction icon="users">Waiting customers</StudioAction></h2><span aria-live="polite">{visible.length} of {entries.length}</span></header>
    <p className={styles.timezone}>Studio times · {timezone}</p>
    <div className={styles.tools}>
      <label className={styles.search}><StudioIcon name="search" /><span className="sr-only">Search waitlist</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer or class…" /></label>
      {queues.length > 0 && <label className={styles.classFilter}><StudioIcon name="filter" /><span className="sr-only">Filter waitlist by class session</span><select value={slotId} onChange={(event) => setSlotId(event.target.value)}><option value="all">All class sessions</option>{queues.map((entry) => <option key={entry.slotId} value={entry.slotId}>{entry.className} · {dateLabel(entry.localDate)} · {entry.startTime}</option>)}</select></label>}
    </div>
    {notice && <p className={styles.notice} role="status"><StudioAction icon="check">{notice}</StudioAction></p>}
    <div className={styles.rows}>{visible.map((entry) => <article key={entry.id} className={styles.row}>
      <div className={styles.customer}><span className={styles.avatar} aria-hidden="true">{entry.customer.slice(0, 1).toUpperCase()}</span><div><strong>{entry.customer}</strong><small>{entry.email}</small></div><span className={styles.position} aria-label={`Queue position ${entry.position}`}><small>Position</small>#{entry.position}</span></div>
      <div className={styles.session}><strong><StudioAction icon="calendar">{entry.className}</StudioAction></strong><span>{dateLabel(entry.localDate)} · {entry.startTime}</span></div>
      <div className={styles.joined}><StudioAction icon="clock">Joined {entry.joinedAt}</StudioAction></div>
      <footer><Link prefetch={false} href={`/studio/customers/${encodeURIComponent(entry.customerUid)}`}><StudioAction icon="user">Customer profile</StudioAction></Link><button type="button" onClick={() => { setNotice(""); setSelectedEntry(entry); }} aria-label={`Remove ${entry.customer} from ${entry.className} waitlist`}><StudioAction icon="remove">Remove</StudioAction></button></footer>
    </article>)}</div>
    {!visible.length && <div className={styles.empty}><StudioIcon name="list" /><h3>{entries.length ? "No matching entries" : "No customers waiting"}</h3><p>{entries.length ? "Try another search or class session." : "Active entries will appear here when customers join a full class waitlist."}</p>{(query || slotId !== "all") && <button type="button" onClick={() => { setQuery(""); setSlotId("all"); }}>Clear search and filters</button>}</div>}
    {selectedEntry && <RemoveEntry entry={selectedEntry} onClose={() => setSelectedEntry(null)} onRemoved={(message) => { setNotice(message); setSelectedEntry(null); }} />}
  </section>;
}
