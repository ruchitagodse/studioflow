"use client";

import { useId, useState, type ReactNode } from "react";
import styles from "./customer-bookings-readable.module.css";

type BookingTab = "upcoming" | "history";

export function CustomerBookingsTabs({ upcoming, history, upcomingCount }: { upcoming: ReactNode; history: ReactNode; upcomingCount: number }) {
  const [activeTab, setActiveTab] = useState<BookingTab>("upcoming");
  const id = useId();
  const upcomingPanelId = `${id}-upcoming`;
  const historyPanelId = `${id}-history`;

  return <div className={styles.bookingsLayout}>
    <div className={styles.tabList} role="tablist" aria-label="Booking lists">
      <button
        type="button"
        role="tab"
        id={`${id}-upcoming-tab`}
        aria-selected={activeTab === "upcoming"}
        aria-controls={upcomingPanelId}
        className={activeTab === "upcoming" ? styles.activeTab : undefined}
        onClick={() => setActiveTab("upcoming")}
      >
        <CalendarIcon /> Upcoming ({upcomingCount})
      </button>
      <button
        type="button"
        role="tab"
        id={`${id}-history-tab`}
        aria-selected={activeTab === "history"}
        aria-controls={historyPanelId}
        className={activeTab === "history" ? styles.activeTab : undefined}
        onClick={() => setActiveTab("history")}
      >
        <HistoryIcon /> History
      </button>
    </div>

    <section
      id={upcomingPanelId}
      role="tabpanel"
      aria-labelledby={`${id}-upcoming-tab`}
      hidden={activeTab !== "upcoming"}
    >
      {upcoming}
    </section>
    <section
      id={historyPanelId}
      role="tabpanel"
      aria-labelledby={`${id}-history-tab`}
      hidden={activeTab !== "history"}
    >
      {history}
    </section>
  </div>;
}

function CalendarIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 10h18" /></svg>;
}

function HistoryIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3.5 12a8.5 8.5 0 1 0 2.1-5.6" /><path d="M3.5 5.5v4.7h4.7M12 7v5l3.3 2" /></svg>;
}
