"use client";

import { useActionState, useEffect, useState } from "react";
import { acknowledgeIncidentReviewAction, reverseIncidentAction, saveIncidentPolicyAction, waiveIncidentAction, type IncidentActionState } from "@/app/studio/incidents/actions";
import styles from "./incident-polish.module.css";

type Incident = { id: string; customerName: string; type: string; status: string; sourceTimestamp: string; reviewRequiredAtCreation: boolean; currentActiveIncidentCount: number; currentReviewRequired: boolean; reviewed: boolean };
const initial: IncidentActionState = {};
export function IncidentManager({ incidents, policy, owner }: { incidents: Incident[]; policy: { version: number; rollingDays: number; threshold: number; status: "active" | "inactive" }; owner: boolean }) {
  const [policyState, policyAction, policyPending] = useActionState(saveIncidentPolicyAction, initial);
  const [waiveState, waiveAction, waivePending] = useActionState(waiveIncidentAction, initial);
  const [reverseState, reverseAction, reversePending] = useActionState(reverseIncidentAction, initial);
  const [reviewState, reviewAction, reviewPending] = useActionState(acknowledgeIncidentReviewAction, initial);
  const [policyOperation] = useState(() => crypto.randomUUID());
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  useEffect(() => {
    if (!selectedIncident) return;
    const previousFocus = document.activeElement;
    const dialog = document.getElementById("incident-dialog-title")?.closest<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]'));
    controls()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setSelectedIncident(null); }
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); if (previousFocus instanceof HTMLElement) previousFocus.focus(); };
  }, [selectedIncident]);
  const visibleIncidents = incidents.filter((incident) => (type === "all" || incident.type === type) && (!query.trim() || incident.customerName.toLowerCase().includes(query.trim().toLowerCase()) || incident.type.includes(query.trim().toLowerCase())));
  return <main className={styles.page}><header className={styles.header}><h1>Incidents</h1></header>
    <div className={styles.topGrid}><section className={styles.panel}><div className={styles.panelHeading}><span>◈</span><div><p className={styles.kicker}>CURRENT POLICY</p><h2>Owner review threshold</h2><small>Configure when a client is flagged for Owner review.</small></div></div><p className={styles.note}>Version {policy.version} · {policy.threshold} active incidents / {policy.rollingDays} rolling days · {policy.status}</p>{owner ? <form action={policyAction} className={styles.form}><input type="hidden" name="operationId" value={policyOperation} /><label>Policy state<select name="status" defaultValue={policy.status} disabled={policyPending}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>{policyState.error && <p className={styles.error} role="alert">{policyState.error}</p>}{policyState.success && <p className={styles.success} role="status">{policyState.success}</p>}<button disabled={policyPending}>{policyPending ? "Saving…" : "Save policy"}</button></form> : <p className={styles.empty}>Only the studio owner can configure policy.</p>}</section>
      <section className={styles.panel} aria-label="Incident filters"><div className={styles.historyTools}><label><span aria-hidden="true">⌕</span><input type="search" placeholder="Search customer or incident type…" aria-label="Search incidents" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div><div className={styles.filters} role="group" aria-label="Incident type">{[["all", "All types"], ["late-cancellation", "Late cancellation"], ["no-show", "No-show"]].map(([value, label]) => <button key={value} type="button" aria-pressed={type === value} className={type === value ? styles.activeFilter : undefined} onClick={() => setType(value)}>{label}</button>)}</div></section></div>
    <section className={styles.records} aria-labelledby="incident-records-title">
      <div className={styles.recordsHeading}><h2 id="incident-records-title">Recent incidents</h2><span aria-live="polite">{visibleIncidents.length} records</span></div>
      {[waiveState, reverseState, reviewState].map((state, index) => <div key={index}>{state.error && <p className={styles.error} role="alert">{state.error}</p>}{state.success && <p className={styles.success} role="status">{state.success}</p>}</div>)}
      <div className={styles.tableHead} aria-hidden="true"><span>Customer</span><span>Type</span><span>Recorded on</span><span>Status</span><span>Review</span><span>Actions</span></div>
      <div className={styles.rows}>{visibleIncidents.map((incident) => {
        const timestamp = new Date(incident.sourceTimestamp);
        return <article className={styles.row} key={incident.id}>
          <span className={styles.client}><i aria-hidden="true">{incident.customerName.charAt(0).toUpperCase()}</i>{incident.customerName}</span>
          <span><em className={incident.type === "no-show" ? styles.noShow : styles.late}>{incident.type.replaceAll("-", " ")}</em></span>
          <time dateTime={Number.isNaN(timestamp.valueOf()) ? undefined : incident.sourceTimestamp}>{Number.isNaN(timestamp.valueOf()) ? "—" : timestamp.toLocaleString()}</time>
          <span className={styles.status}>{incident.status}</span>
          <span className={styles.review}>{incident.currentReviewRequired ? "Review required" : incident.reviewed ? "Reviewed" : "No review required"}</span>
          <div><button type="button" aria-label={`View incident for ${incident.customerName}`} onClick={() => setSelectedIncident(incident)}>View details →</button></div>
        </article>;
      })}</div>
      {incidents.length === 0 ? <p className={styles.empty}>No qualifying late cancellations or no-shows have been recorded.</p> : visibleIncidents.length === 0 ? <p className={styles.empty}>No incidents match these filters.</p> : null}
    </section>
    {selectedIncident && <div className={styles.backdrop} role="presentation" onMouseDown={() => setSelectedIncident(null)}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="incident-dialog-title" onMouseDown={(event) => event.stopPropagation()}><button type="button" className={styles.close} onClick={() => setSelectedIncident(null)} aria-label="Close incident details">×</button><p className={styles.kicker}>INCIDENT RECORD</p><h2 id="incident-dialog-title">{selectedIncident.customerName}</h2><p className={styles.modalMeta}>{selectedIncident.type.replaceAll("-", " ")} · {new Date(selectedIncident.sourceTimestamp).toLocaleString()}</p><p className={styles.note}>{selectedIncident.currentActiveIncidentCount} active incidents in the current {policy.rollingDays}-day window{selectedIncident.currentReviewRequired ? " · owner review required" : ""}{selectedIncident.reviewed ? " · review acknowledged" : ""}</p>{owner && selectedIncident.status === "active" && <div className={styles.modalActions}><form action={waiveAction}><input type="hidden" name="incidentId" value={selectedIncident.id} /><input type="hidden" name="operationId" value={crypto.randomUUID()} /><label>Waiver reason<input name="reason" minLength={2} maxLength={300} required disabled={waivePending} /></label><button disabled={waivePending}>{waivePending ? "Saving…" : "Waive incident"}</button></form><form action={reviewAction}><input type="hidden" name="incidentId" value={selectedIncident.id} /><input type="hidden" name="operationId" value={crypto.randomUUID()} /><button className={styles.secondary} disabled={reviewPending || selectedIncident.reviewed}>{selectedIncident.reviewed ? "Review acknowledged" : reviewPending ? "Saving…" : "Acknowledge review"}</button></form>{selectedIncident.type === "no-show" && <form action={reverseAction}><input type="hidden" name="incidentId" value={selectedIncident.id} /><input type="hidden" name="operationId" value={crypto.randomUUID()} /><label>Factual reversal reason<input name="reason" minLength={2} maxLength={300} required disabled={reversePending} /></label><button className={styles.secondary} disabled={reversePending}>{reversePending ? "Saving…" : "Reverse after attendance correction"}</button></form>}</div>}</section></div>}
  </main>;
}
