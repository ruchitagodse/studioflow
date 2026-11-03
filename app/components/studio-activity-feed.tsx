"use client";

import Link from "next/link";
import { useState } from "react";
import type { StudioActivityCategory } from "@/lib/studio-activity";
import { StudioAction, StudioIcon, type StudioIconName } from "./studio-icon";
import styles from "./studio-activity-feed.module.css";

export type StudioActivityRow = { id: string; actor: string; action: string; detail: string; dateLabel: string; timeLabel: string; timestamp: string | null; category: StudioActivityCategory; href: string };
const categories: Record<StudioActivityCategory, { label: string; icon: StudioIconName }> = {
  schedule: { label: "Schedule", icon: "calendar" }, bookings: { label: "Bookings", icon: "list" }, memberships: { label: "Memberships", icon: "membership" }, credits: { label: "Credits", icon: "credits" }, attendance: { label: "Attendance", icon: "check" }, incidents: { label: "Incidents", icon: "alert" }, waitlist: { label: "Waitlist", icon: "clock" }, access: { label: "Studio access", icon: "shield" }, other: { label: "Other", icon: "info" },
};

export function StudioActivityFeed({ rows, timezone }: { rows: StudioActivityRow[]; timezone: string }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<StudioActivityCategory | "all">("all");
  const visible = rows.filter((row) => (category === "all" || row.category === category) && `${row.actor} ${row.action} ${row.detail}`.toLowerCase().includes(query.trim().toLowerCase()));
  const groups = new Map<string, StudioActivityRow[]>();
  for (const row of visible) groups.set(row.dateLabel, [...(groups.get(row.dateLabel) ?? []), row]);
  return <section className={styles.feed} aria-label="Recent studio activity">
    <div className={styles.tools}><label className={styles.search}><StudioIcon name="search" /><span className="sr-only">Search studio activity</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search person, event, or reason…" /></label><label className={styles.category}><StudioIcon name="filter" /><span className="sr-only">Activity category</span><select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}><option value="all">All activity</option>{Object.entries(categories).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label></div>
    <div className={styles.context}><span aria-live="polite">{visible.length} of {rows.length} recent events</span><span>{timezone}</span></div>
    {(query || category !== "all") && <button className={styles.clear} type="button" onClick={() => { setQuery(""); setCategory("all"); }}>Clear search and filters</button>}
    {[...groups].map(([date, events]) => <section className={styles.day} key={date} aria-label={date}><h2><StudioAction icon="calendar">{date}</StudioAction></h2>{events.map((row) => <Link prefetch={false} href={row.href} className={styles.event} key={row.id} aria-label={`${row.action} by ${row.actor}. View related records`}>
      <span className={styles.eventIcon}><StudioIcon name={categories[row.category].icon} /></span><div className={styles.copy}><span className={styles.kind}>{categories[row.category].label}</span><strong>{row.action}</strong>{row.detail && <p>{row.detail}</p>}<div className={styles.meta}><span>By {row.actor}</span><time dateTime={row.timestamp ?? undefined}>{row.timeLabel}</time></div></div><span className={styles.arrow}><StudioIcon name="arrow" /></span>
    </Link>)}</section>)}
    {!visible.length && <div className={styles.empty}><StudioIcon name="history" /><h2>{rows.length ? "No matching activity" : "No activity recorded yet"}</h2><p>{rows.length ? "Try a different search or category." : "Recorded studio events will appear here."}</p></div>}
  </section>;
}
