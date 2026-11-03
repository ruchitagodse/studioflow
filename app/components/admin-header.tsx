"use client";

import { useEffect, useState } from "react";
import { StudioMobileNav } from "./studio-mobile-nav";
import { AdminSidebar } from "./admin-sidebar";
import { WorkspaceProfileMenu } from "./workspace-profile-menu";
import { WorkspaceRefresh } from "./workspace-refresh";
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
  useEffect(() => {
    if (!menuOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const drawer = document.getElementById("studio-mobile-navigation");
    const controls = () => Array.from(drawer?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), summary') ?? []).filter((element) => element.getClientRects().length > 0);
    drawer?.querySelector<HTMLElement>('button[aria-label="Close studio navigation"]')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setMenuOpen(false); }
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previousOverflow; if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus(); };
  }, [menuOpen]);
  return <>
    <header className={styles.header}>
      <button type="button" className={styles.menuButton} aria-label="Open studio navigation" aria-expanded={menuOpen} aria-controls="studio-mobile-navigation" onClick={() => setMenuOpen(true)}>
        <span /><span /><span />
      </button>
      <div className={styles.context}><span>{props.studioName}</span><strong>Studio workspace</strong></div>
      <div className={styles.mobileContext} aria-label={`${props.studioName} studio workspace`}><strong>Studio</strong><span>{props.studioName}</span></div>
      <WorkspaceRefresh /><WorkspaceProfileMenu name={props.name} role={props.role} studioName={props.studioName} workspaceLinks={props.workspaceLinks} />
    </header>
    <StudioMobileNav menuOpen={menuOpen} onMore={() => setMenuOpen(true)} />
    {menuOpen && <AdminSidebar {...props} mobile onNavigate={() => setMenuOpen(false)} onClose={() => setMenuOpen(false)} />}
  </>;
}
