"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./booking.module.css";

type LedgerEntry = { id: string; action: string; amount: number; createdAt: string | null };

function activityDetails(action: string) {
  const normalized = action.replaceAll("_", " ").toLowerCase();
  if (normalized.includes("allocation")) return { title: "Allocation", detail: "Plan purchase", icon: "plus" as const };
  if (normalized.includes("reservation")) return { title: "Class booking", detail: "Class pass reserved for your class", icon: "calendar" as const };
  if (normalized.includes("release") || normalized.includes("cancel")) return { title: "Booking cancelled", detail: "Class pass returned to your balance", icon: "undo" as const };
  if (normalized.includes("consumption") || normalized.includes("consume")) return { title: "Class attended", detail: "Class pass used for your class", icon: "calendar" as const };
  return { title: normalized || "Class pass update", detail: "Membership class pass activity", icon: "plus" as const };
}

function ActivityIcon({ name }: { name: "plus" | "calendar" | "undo" }) {
  return <span className={styles.activityIcon} aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">{name === "plus" ? <><circle cx="12" cy="12" r="7" /><path d="M12 8.5v7M8.5 12h7" /></> : name === "calendar" ? <><rect x="5" y="6.5" width="14" height="12" rx="2" /><path d="M8 4.5v4M16 4.5v4M5 10h14" /></> : <><path d="M9 7 5.5 10.5 9 14" /><path d="M6 10.5h7a5 5 0 1 1-4.1 7.9" /></>}</svg></span>;
}

function displayDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "2-digit" }).format(new Date(value)) : "";
}

function CreditActivityRow({ entry }: { entry: LedgerEntry }) {
  const activity = activityDetails(entry.action);
  const amountTone = entry.amount > 0 ? styles.activityPositive : entry.amount < 0 ? styles.activityNegative : styles.activityNeutral;
  return <article className={styles.activityRow}><ActivityIcon name={activity.icon} /><div><strong>{activity.title}</strong><span>{activity.detail}</span></div><div className={amountTone}><b>{entry.amount > 0 ? `+${entry.amount}` : entry.amount}</b><time dateTime={entry.createdAt ?? undefined}>{displayDate(entry.createdAt)}</time></div></article>;
}

export function CustomerCreditHistory({ entries }: { entries: LedgerEntry[] }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    dialog.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);
  return <section className={`${styles.membershipPanel} ${styles.creditHistoryPanel}`} aria-labelledby="membership-history"><div className={styles.activityHeading}><div><p className={styles.kicker}>CLASS PASS HISTORY</p><h2 id="membership-history">Recent activity</h2></div>{entries.length > 3 && <button type="button" onClick={() => setOpen(true)}>See all <span aria-hidden="true">→</span></button>}</div><div className={styles.activityList}>{entries.slice(0, 3).map((entry) => <CreditActivityRow key={entry.id} entry={entry} />)}</div>{open && <div className={styles.confirmationBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section ref={dialog} className={`${styles.confirmationDialog} ${styles.activityDialog}`} role="dialog" aria-modal="true" aria-labelledby="all-credit-history" tabIndex={-1}><div className={styles.activityDialogHeader}><div><p className={styles.kicker}>CLASS PASS HISTORY</p><h2 id="all-credit-history">All activity</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close class pass history">×</button></div><div className={styles.activityList}>{entries.map((entry) => <CreditActivityRow key={entry.id} entry={entry} />)}</div></section></div>}</section>;
}
