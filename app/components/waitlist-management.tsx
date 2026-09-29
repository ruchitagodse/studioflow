"use client";

import { useActionState, useState } from "react";
import { removeWaitlistEntryAction, type WaitlistManagementState } from "@/app/studio/waitlist-actions";
import styles from "./booking.module.css";
import waitlistStyles from "./waitlist-ui.module.css";

type Entry = { id: string; customer: string; className: string; localDate: string; startTime: string; joinedAt: string; position: number; status: string };
const initial: WaitlistManagementState = {};

export function WaitlistManagement({ entries }: { entries: Entry[] }) {
  const [state, action, pending] = useActionState(removeWaitlistEntryAction, initial);
  const [operationId] = useState(() => crypto.randomUUID());
  const [query, setQuery] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const visibleEntries = entries.filter((entry) => !query.trim() || entry.customer.toLowerCase().includes(query.trim().toLowerCase()) || entry.className.toLowerCase().includes(query.trim().toLowerCase()));

  return <section className={waitlistStyles.waitlistPanel}>
    <div className={waitlistStyles.listHeader}><div><p>WAITLIST ENTRIES</p><h2>Current waitlist</h2><span>Manage and monitor all waitlist entries.</span></div><label><span>⌕</span><input type="search" placeholder="Search by name or email…" aria-label="Search waitlist" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
    {state.error && <p className={styles.error} role="alert">{state.error}</p>}{state.success && <p className={styles.success} role="status">{state.success}</p>}
    <div className={waitlistStyles.waitlistTableHead} aria-hidden="true"><span>#</span><span>Client</span><span>Class</span><span>Date</span><span>Time</span><span>Joined on</span><span>Status</span><span>Actions</span></div><div className={waitlistStyles.waitlistRows}>{visibleEntries.map((entry) => <article key={entry.id} className={waitlistStyles.waitlistRow}><span>{entry.position}</span><span className={waitlistStyles.clientCell}><i>{entry.customer.charAt(0).toUpperCase()}</i>{entry.customer}</span><span>{entry.className}</span><time>{entry.localDate}</time><time>{entry.startTime}</time><time>{entry.joinedAt}</time><em>Waiting</em><div><button type="button" onClick={() => setSelectedEntry(entry)}>Remove</button><button type="button" aria-label={`More actions for ${entry.customer}`}>⋮</button></div></article>)}</div>{entries.length === 0 ? <p className={waitlistStyles.noEntries}>There are no active waitlist entries yet. New entries appear here when a customer joins a full class.</p> : visibleEntries.length === 0 ? <p className={waitlistStyles.noEntries}>No waitlist entries match that search.</p> : null}
    {selectedEntry && <div className={waitlistStyles.removalBackdrop} role="presentation"><section className={waitlistStyles.removalModal} role="dialog" aria-modal="true" aria-labelledby="remove-waitlist-title"><div><p>REMOVE WAITLIST ENTRY</p><h2 id="remove-waitlist-title">{selectedEntry.customer}</h2><span>{selectedEntry.className} · queue position {selectedEntry.position}</span><button type="button" onClick={() => setSelectedEntry(null)} aria-label="Close remove waitlist dialog">×</button></div><form action={action}><input type="hidden" name="entryId" value={selectedEntry.id} /><input type="hidden" name="operationId" value={operationId} /><label>Removal reason<input name="reason" required minLength={2} maxLength={300} placeholder="Why is this entry being removed?" disabled={pending} /></label><button type="submit" disabled={pending}>{pending ? "Removing…" : "Remove from waitlist"}</button></form></section></div>}
  </section>;
}
