"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./studio-mobile-nav.module.css";

export function StudioMobileNav({ menuOpen, onMore }: { menuOpen: boolean; onMore: () => void }) {
  const pathname = usePathname();
  const items = [
    { href: "/studio", label: "Overview", path: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></> },
    { href: "/studio/schedule", label: "Schedule", path: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></> },
    { href: "/studio/customers", label: "Customers", path: <><circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/></> },
  ];
  const active = (href: string) => href === "/studio" ? pathname === href : pathname.startsWith(href) || (href === "/studio/schedule" && pathname.startsWith("/studio/attendance/"));
  const otherPage = !items.some((item) => active(item.href));
  return <nav className={styles.nav} aria-label="Studio quick navigation">
    {items.map((item) => <Link key={item.href} prefetch={false} href={item.href} aria-current={active(item.href) ? "page" : undefined}><svg viewBox="0 0 24 24" aria-hidden="true">{item.path}</svg><span>{item.label}</span></Link>)}
    <button type="button" onClick={onMore} aria-expanded={menuOpen} aria-controls="studio-mobile-navigation" data-active={otherPage || menuOpen}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>More</span></button>
  </nav>;
}
