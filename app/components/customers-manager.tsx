"use client";

import { StudioAction } from "@/app/components/studio-icon";
import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./customers-ui.module.css";
import mobileStyles from "./customers-mobile-polish.module.css";

export type CustomerRow = {
  uid: string;
  name: string;
  email: string;
  status: "active" | "inactive";
  subscription: string;
  credits: number | null;
};

export function CustomersManager({ customers }: { customers: CustomerRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | CustomerRow["status"]>("all");
  const visible = useMemo(() => customers.filter((customer) => {
    const term = query.trim().toLowerCase();
    return (!term || `${customer.name} ${customer.email}`.toLowerCase().includes(term)) && (status === "all" || customer.status === status);
  }), [customers, query, status]);

  return <main className={`${styles.page} ${mobileStyles.root}`}>
    <section className={styles.panel} aria-labelledby="customers-list-title">
      <div className={styles.panelHeading}><h1 className={mobileStyles.title} id="customers-list-title">Customers</h1><span>{customers.length} on this page</span></div>
      <div className={`${styles.filters} ${mobileStyles.filters}`}><label><span className="sr-only">Search customers</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email…" /></label><label><span className="sr-only">Filter customer status</span><select value={status} onChange={(event) => setStatus(event.target.value as "all" | CustomerRow["status"])}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div>
      <div className={mobileStyles.statusFilters} role="group" aria-label="Customer status">{(["all", "active", "inactive"] as const).map((value) => <button type="button" key={value} aria-pressed={status === value} onClick={() => setStatus(value)}>{value === "all" ? "All" : value === "active" ? "Active" : "Inactive"}</button>)}</div>
      {(query || status !== "all") && <div className={mobileStyles.searchResult}><span aria-live="polite">{visible.length} matching customers</span><button type="button" onClick={() => { setQuery(""); setStatus("all"); }}><StudioAction icon="filter">Clear filters</StudioAction></button></div>}
      {visible.length ? <div className={`${styles.table} ${mobileStyles.table}`}><div className={styles.tableHead} aria-hidden="true"><span>Customer</span><span>Membership</span><span>Credits</span><span>Status</span><span /></div>{visible.map((customer) => <article key={customer.uid}><div><b>{customer.name}</b><small>{customer.email}</small></div><span>{customer.subscription}</span><span>{customer.credits === null ? "—" : `${customer.credits} available`}</span><em data-status={customer.status}>{customer.status}</em><Link prefetch={false} href={`/studio/customers/${customer.uid}`}><StudioAction icon="user">View profile</StudioAction></Link></article>)}</div> : <p className={styles.empty}>{customers.length ? "No customers match those filters." : "No customers are available yet. Customer access is created from Team."}</p>}
    </section>
  </main>;
}

type CustomerProfile = CustomerRow & { bookings: Array<{ id: string; className: string; localDate: string; status: string }>; attendance: Array<{ id: string; className: string; localDate: string; status: string }>; activity: Array<{ id: string; label: string; createdAt: string }>; pauseStatus: string };
const tabs = ["Overview", "Bookings", "Membership", "Credits", "Attendance", "Activity"] as const;

export function CustomerProfile({ customer }: { customer: CustomerProfile }) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  return <main className={`${styles.page} ${mobileStyles.root} ${mobileStyles.profile}`}>
    <Link prefetch={false} className={styles.back} href="/studio/customers"><StudioAction icon="back">Customers</StudioAction></Link>
    <header className={styles.profileHeader}><div className={styles.avatar} aria-hidden="true">{customer.name.slice(0, 1).toUpperCase()}</div><div><h1>{customer.name}</h1><span>{customer.email}</span><span className={mobileStyles.profileStatus} data-status={customer.status}>{customer.status}</span></div></header>
    <label className={mobileStyles.sectionPicker}>Profile section<select value={tab} onChange={(event) => setTab(event.target.value as (typeof tabs)[number])}>{tabs.map((item) => <option key={item}>{item}</option>)}</select></label>
    <div className={`${styles.tabs} ${mobileStyles.tabs}`} role="tablist" aria-label="Customer profile sections">{tabs.map((item, index) => <button key={item} id={`customer-tab-${item}`} type="button" role="tab" aria-controls="customer-profile-panel" aria-selected={tab === item} tabIndex={tab === item ? 0 : -1} onClick={() => setTab(item)} onKeyDown={(event) => {
      const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
      if (next !== null) { event.preventDefault(); setTab(tabs[next]); document.getElementById(`customer-tab-${tabs[next]}`)?.focus(); }
    }}>{item}</button>)}</div>
    <section className={styles.panel} id="customer-profile-panel" role="tabpanel" aria-label={`${tab} for ${customer.name}`}>
      {tab === "Overview" && <div className={styles.overview}>
        <Link prefetch={false} className={mobileStyles.summaryCard} data-kind="membership" href={`/studio/subscriptions?customer=${encodeURIComponent(customer.uid)}`}><small><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/></svg>Membership</small><b>{customer.subscription}</b><span>{customer.pauseStatus} · Manage →</span></Link>
        <Link prefetch={false} className={mobileStyles.summaryCard} data-kind="credits" href={`/studio/credits?customer=${encodeURIComponent(customer.uid)}`}><small><svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 4 14 4 14 0V6M5 12v6c0 4 14 4 14 0v-6"/></svg>Available credits</small><b>{customer.credits ?? "—"}</b><span>View credits →</span></Link>
        <button type="button" className={mobileStyles.summaryCard} data-kind="bookings" onClick={() => setTab("Bookings")}><small><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 11h18m-13 5h4"/></svg>Recent bookings</small><b>{customer.bookings.length}</b><span>View history →</span></button>
      </div>}
      {tab === "Bookings" && <RecordList records={customer.bookings} empty="No booking records are available." />}
      {tab === "Membership" && <div className={styles.detail}><h2>{customer.subscription}</h2><p>Pause status: {customer.pauseStatus}</p><Link prefetch={false} href={`/studio/subscriptions?customer=${encodeURIComponent(customer.uid)}`}><StudioAction icon="membership">Manage membership</StudioAction></Link></div>}
      {tab === "Credits" && <div className={styles.detail}><h2>{customer.credits ?? "—"} available credits</h2><Link prefetch={false} href={`/studio/credits?customer=${encodeURIComponent(customer.uid)}`}><StudioAction icon="credits">Credit history and adjustments</StudioAction></Link></div>}
      {tab === "Attendance" && <RecordList records={customer.attendance} empty="No attendance outcomes are available." />}
      {tab === "Activity" && <RecordList records={customer.activity} empty="No customer activity is available." />}
    </section>
  </main>;
}

function RecordList({ records, empty }: { records: Array<{ id: string; className?: string; label?: string; localDate?: string; createdAt?: string; status?: string }>; empty: string }) {
  return records.length ? <div className={`${styles.records} ${mobileStyles.records}`}>{records.map((record) => <article key={record.id}><b>{record.className ?? record.label}</b><span>{record.localDate ?? record.createdAt}</span><em>{record.status ?? "Recorded"}</em></article>)}</div> : <p className={styles.empty}>{empty}</p>;
}
