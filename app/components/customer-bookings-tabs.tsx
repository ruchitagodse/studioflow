import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./customer-bookings-readable.module.css";

export function CustomerBookingsTabs({ children, activeTab, upcomingCount }: { children: ReactNode; activeTab: "upcoming" | "history"; upcomingCount: number }) {
  return <div className={styles.bookingsLayout}>
    <nav className={styles.tabList} aria-label="Booking lists">
      <Link prefetch={false} href="/customer/bookings" aria-current={activeTab === "upcoming" ? "page" : undefined} className={activeTab === "upcoming" ? styles.activeTab : undefined}><CalendarIcon />Upcoming ({upcomingCount})</Link>
      <Link prefetch={false} href="/customer/bookings?view=history" aria-current={activeTab === "history" ? "page" : undefined} className={activeTab === "history" ? styles.activeTab : undefined}><HistoryIcon />History</Link>
    </nav>
    <section aria-label={activeTab === "upcoming" ? "Upcoming bookings" : "Booking history"}>{children}</section>
  </div>;
}

function CalendarIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 10h18" /></svg>;
}

function HistoryIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3.5 12a8.5 8.5 0 1 0 2.1-5.6" /><path d="M3.5 5.5v4.7h4.7M12 7v5l3.3 2" /></svg>;
}
