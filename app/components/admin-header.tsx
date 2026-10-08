"use client";

import { useState } from "react";
import { AdminSidebar } from "./admin-sidebar";
import { WorkspaceProfileMenu } from "./workspace-profile-menu";
import styles from "./admin-header.module.css";

type AdminHeaderProps = {
  name: string;
  role: string;
  studioName: string;
  roles: ("owner" | "staff")[];
  workspaceLinks: { href: string; label: string }[];
};

/** Shared account chrome for every staff workspace route. */
export function AdminHeader(props: AdminHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <>
    <header className={styles.header}>
      <button type="button" className={styles.menuButton} aria-label="Open studio navigation" aria-expanded={menuOpen} aria-controls="studio-mobile-navigation" onClick={() => setMenuOpen(true)}>
        <span /><span /><span />
      </button>
      <div className={styles.context}><span>{props.studioName}</span><strong>Studio workspace</strong></div>
      <label className={styles.search} aria-label="Search studio records"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/></svg><input type="search" placeholder="Search customers, classes, bookings…" /></label>
      <button type="button" className={styles.notification} aria-label="Notifications are not available yet"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg></button>
      <WorkspaceProfileMenu name={props.name} role={props.role} studioName={props.studioName} workspaceLinks={props.workspaceLinks} />
    </header>
    {menuOpen && <AdminSidebar {...props} mobile onNavigate={() => setMenuOpen(false)} onClose={() => setMenuOpen(false)} />}
  </>;
}
