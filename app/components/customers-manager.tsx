"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./customers-ui.module.css";
import { AdminPageHeader } from "./admin-ui";

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

  return <main className={styles.page}>
    <AdminPageHeader eyebrow="Customers" title="Customer relationships, in context." description="Search and manage existing studio customers. New customer access is provisioned in Team." />
    <section className={styles.panel} aria-labelledby="customers-list-title">
      <div className={styles.panelHeading}><div><p>EXISTING CUSTOMERS</p><h2 id="customers-list-title">Customers</h2></div><span>{customers.length} total</span></div>
      <div className={styles.filters}><label><span className="sr-only">Search customers</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email…" /></label><label><span className="sr-only">Filter customer status</span><select value={status} onChange={(event) => setStatus(event.target.value as "all" | CustomerRow["status"])}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div>
      {visible.length ? <div className={styles.table}><div className={styles.tableHead} aria-hidden="true"><span>Customer</span><span>Membership</span><span>Credits</span><span>Status</span><span /></div>{visible.map((customer) => <article key={customer.uid}><div><b>{customer.name}</b><small>{customer.email}</small></div><span>{customer.subscription}</span><span>{customer.credits === null ? "—" : `${customer.credits} available`}</span><em data-status={customer.status}>{customer.status}</em><Link href={`/studio/customers/${customer.uid}`}>View profile <span aria-hidden="true">→</span></Link></article>)}</div> : <p className={styles.empty}>{customers.length ? "No customers match those filters." : "No customers are available yet. Customer access is created from Team."}</p>}
    </section>
  </main>;
}

type CustomerProfile = CustomerRow & { bookings: Array<{ id: string; className: string; localDate: string; status: string }>; attendance: Array<{ id: string; className: string; localDate: string; status: string }>; activity: Array<{ id: string; label: string; createdAt: string }>; pauseStatus: string };
const tabs = ["Overview", "Bookings", "Membership", "Credits", "Attendance", "Activity"] as const;

export function CustomerProfile({ customer }: { customer: CustomerProfile }) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  return <main className={styles.page}>
    <Link className={styles.back} href="/studio/customers">← Customers</Link>
    <header className={styles.profileHeader}><div className={styles.avatar}>{customer.name.slice(0, 1).toUpperCase()}</div><div><p>CUSTOMER PROFILE</p><h1>{customer.name}</h1><span>{customer.email} · <b>{customer.status}</b></span></div></header>
    <div className={styles.tabs} role="tablist" aria-label="Customer profile sections">{tabs.map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>{item}</button>)}</div>
    <section className={styles.panel} role="tabpanel">
      {tab === "Overview" && <div className={styles.overview}><article><small>Membership</small><b>{customer.subscription}</b><span>Pause status: {customer.pauseStatus}</span></article><article><small>Available credits</small><b>{customer.credits ?? "—"}</b><span>See the credit history for details.</span></article><article><small>Booking history</small><b>{customer.bookings.length}</b><span>All records remain in their original systems.</span></article></div>}
      {tab === "Bookings" && <RecordList records={customer.bookings} empty="No booking records are available." />}
      {tab === "Membership" && <div className={styles.detail}><h2>{customer.subscription}</h2><p>Pause status: {customer.pauseStatus}</p><Link href="/studio/subscriptions">Open subscriptions →</Link></div>}
      {tab === "Credits" && <div className={styles.detail}><h2>{customer.credits ?? "—"} available credits</h2><p>Credit movements are managed from Membership and remain immutable.</p><Link href="/studio/credits">Open credit management →</Link></div>}
      {tab === "Attendance" && <RecordList records={customer.attendance} empty="No attendance outcomes are available." />}
      {tab === "Activity" && <RecordList records={customer.activity} empty="No customer activity is available." />}
    </section>
  </main>;
}

function RecordList({ records, empty }: { records: Array<{ id: string; className?: string; label?: string; localDate?: string; createdAt?: string; status?: string }>; empty: string }) {
  return records.length ? <div className={styles.records}>{records.map((record) => <article key={record.id}><b>{record.className ?? record.label}</b><span>{record.localDate ?? record.createdAt}</span><em>{record.status ?? "Recorded"}</em></article>)}</div> : <p className={styles.empty}>{empty}</p>;
}
