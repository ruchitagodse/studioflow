import Link from "next/link";
import styles from "./booking.module.css";

type CustomerSection = "book" | "bookings" | "membership" | "profile";

const navigation = [
  { key: "book", href: "/customer", label: "Book", icon: "home" },
  { key: "bookings", href: "/customer/bookings", label: "Bookings", icon: "calendar" },
  { key: "membership", href: "/customer/entitlements", label: "Membership", icon: "card" },
  { key: "profile", href: "/customer/profile", label: "Profile", icon: "user" },
] as const;

function NavIcon({ name }: { name: (typeof navigation)[number]["icon"] }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9Z" /><path d="M9 21v-6h6v6" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18M7 15h3" /></>,
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21c.8-3.5 3.1-5.25 7-5.25S18.2 17.5 19 21" /></>,
  };
  return <svg className={styles.navIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

export function CustomerBookingShell({ children, title, subtitle, active, compactHeader = false, heroHeader = false, profileHeader = false, backHref, backLabel }: { children: React.ReactNode; title: string; subtitle: string; active: CustomerSection; compactHeader?: boolean; heroHeader?: boolean; profileHeader?: boolean; backHref?: string; backLabel?: string }) {
  return <main className={styles.page}>
    <nav className={styles.nav} aria-label="Customer navigation">
      {navigation.map((item) => <Link key={item.key} className={active === item.key ? styles.currentNav : ""} aria-current={active === item.key ? "page" : undefined} href={item.href}>
        <NavIcon name={item.icon} /><span className={styles.navLabel}>{item.label}</span>
      </Link>)}
    </nav>
    <div className={styles.content}>
      {backHref && <Link className={styles.slotBackLink} href={backHref} aria-label={backLabel ?? "Back to schedule"}><span aria-hidden="true">←</span>{backLabel}</Link>}
      <header className={`${styles.header} ${compactHeader ? styles.compactSlotHeader : ""} ${heroHeader ? styles.homeHeroHeader : ""} ${profileHeader ? styles.profileHeader : ""}`}><h1>{title}</h1><p>{subtitle}</p></header>
      {children}
    </div>
  </main>;
}
