"use client";

import { useActionState, useState } from "react";
import { removeWaitlistEntryAction, type WaitlistManagementState } from "@/app/studio/waitlist-actions";
import styles from "./waitlist-ui.module.css";

type Entry = { id: string; customer: string; email: string; className: string; localDate: string; startTime: string; joinedAt: string; position: number };
const initial: WaitlistManagementState = {};

export function WaitlistManagement({ entries }: { entries: Entry[] }) {
  const [state, action, pending] = useActionState(removeWaitlistEntryAction, initial);
  const [query, setQuery] = useState(""); const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null); const [operationId] = useState(() => crypto.randomUUID());
  const normalizedQuery = query.trim().toLowerCase();
  const visibleEntries = entries.filter((entry) => !normalizedQuery || `${entry.customer} ${entry.email} ${entry.className}`.toLowerCase().includes(normalizedQuery));
  return <section className={styles.queuePanel} aria-labelledby="current-waitlist"><header className={styles.queueHeader}><div><p className={styles.kicker}>WAITLIST ENTRIES</p><h2 id="current-waitlist">Current waitlist</h2><p>Manage and monitor all waitlist entries.</p></div><label className={styles.search}><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, email or class…" aria-label="Search waitlist" /></label></header>
    {state.error && <p className={styles.error} role="alert">{state.error}</p>}{state.success && <p className={styles.success} role="status">{state.success}</p>}
    <div className={styles.table}><div className={styles.tableHeader} aria-hidden="true"><span>#</span><span>Client</span><span>Class</span><span>Date</span><span>Time</span><span>Joined on</span><span>Status</span><span>Actions</span></div>{visibleEntries.map((entry) => <article className={styles.row} key={entry.id}><span data-label="#">{entry.position}</span><span className={styles.client} data-label="Client"><i>{entry.customer.slice(0, 1).toUpperCase()}</i><b>{entry.customer}</b>{entry.email && <small>{entry.email}</small>}</span><span data-label="Class">{entry.className}</span><time data-label="Date">{entry.localDate}</time><time data-label="Time">{entry.startTime}</time><time data-label="Joined on">{entry.joinedAt}</time><span data-label="Status"><em>Waiting</em></span><div className={styles.actions}><button type="button" onClick={() => setSelectedEntry(entry)}>Remove</button><button type="button" aria-label={`More actions for ${entry.customer}`}>⋮</button></div></article>)}</div>
    {!entries.length ? <p className={styles.empty}>There are no active waitlist entries yet.</p> : !visibleEntries.length ? <p className={styles.empty}>No waitlist entries match that search.</p> : null}
    {selectedEntry && <div className={styles.backdrop} role="presentation"><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="remove-waitlist-title"><button className={styles.close} type="button" onClick={() => setSelectedEntry(null)} aria-label="Close remove waitlist dialog">×</button><p className={styles.kicker}>REMOVE WAITLIST ENTRY</p><h2 id="remove-waitlist-title">{selectedEntry.customer}</h2><p>{selectedEntry.className} · queue position {selectedEntry.position}</p><form action={action}><input type="hidden" name="entryId" value={selectedEntry.id} /><input type="hidden" name="operationId" value={operationId} /><label>Removal reason<input name="reason" required minLength={2} maxLength={300} placeholder="Why is this entry being removed?" disabled={pending} /></label><button type="submit" disabled={pending}>{pending ? "Removing…" : "Remove from waitlist"}</button></form></section></div>}
  </section>;
}
