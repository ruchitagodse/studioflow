"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { WorkspaceProfileMenu } from "./workspace-profile-menu";
import styles from "./admin-sidebar.module.css";

type Role = "owner" | "staff";
type NavItem = {
  label: string;
  icon: IconName;
  href: string;
  section?: string;
  ownerOnly?: boolean;
};

type NavGroup = { label: string; items: NavItem[] };

type AdminSidebarProps = {
  name: string;
  role: string;
  studioName: string;
  roles: Role[];
  workspaceLinks: { href: string; label: string }[];
  mobile?: boolean;
  onNavigate?: () => void;
  onClose?: () => void;
};

type IconName = "dashboard" | "calendar" | "layers" | "users" | "queue" | "card" | "coins" | "pause" | "check" | "alert" | "user" | "shield" | "bell" | "building" | "palette" | "document" | "lock";

const navigation: NavGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", href: "/studio", icon: "dashboard" }] },
  { label: "Studio", items: [
    { label: "Schedule", href: "/studio/schedule", icon: "calendar" },
    { label: "Classes", href: "/studio/classes", icon: "layers" },
    { label: "Customers", href: "/studio/customers", icon: "users" },
    { label: "Waitlist", href: "/studio/waitlist", icon: "queue" },
  ] },
  { label: "Membership", items: [
    { label: "Plans", href: "/studio/plans", icon: "card" },
    { label: "Subscriptions", href: "/studio/subscriptions", icon: "card" },
    { label: "Credits", href: "/studio/credits", icon: "coins" },
    { label: "Pause Requests", href: "/studio/pause-requests", icon: "pause" },
  ] },
  { label: "Operations", items: [
    { label: "Attendance", href: "/studio/schedule?view=attendance", section: "attendance", icon: "check" },
    { label: "Incidents", href: "/studio/incidents", icon: "alert" },
  ] },
  { label: "Team", items: [
    { label: "Trainers", href: "/studio/trainer", icon: "user", ownerOnly: true },
    { label: "Staff", href: "/studio/staff", icon: "users", ownerOnly: true },
    { label: "Roles & Permissions", href: "/studio/roles-permissions", icon: "shield", ownerOnly: true },
  ] },
  { label: "Communication", items: [{ label: "Notifications", href: "/studio?view=notifications", section: "notifications", icon: "bell" }] },
  { label: "Settings", items: [
    { label: "Studio Settings", href: "/studio?view=settings", section: "settings", icon: "building", ownerOnly: true },
    { label: "Theme", href: "/studio/theme", icon: "palette", ownerOnly: true },
    { label: "Policies", href: "/studio/incidents?view=policy", section: "policy", icon: "document", ownerOnly: true },
    { label: "Account & Security", href: "/studio/team?view=security", section: "security", icon: "lock", ownerOnly: true },
  ] },
];

const paths: Record<IconName, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>, layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.6-3 2.4-5 5.5-5s4.9 2 5.5 5M16 4.5a3 3 0 0 1 0 5.8M18 15c1.4.7 2.3 2.2 2.5 4"/></>, queue: <><path d="M8 6h12M8 12h12M8 18h12"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></>, coins: <><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></>,
  pause: <><rect x="5" y="4" width="14" height="16" rx="3"/><path d="M10 9v6M14 9v6"/></>, check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>, alert: <><path d="m12 3 9 17H3L12 3Z"/><path d="M12 9v4M12 17h.01"/></>,
  user: <><circle cx="12" cy="8" r="3.5"/><path d="M5 21c.8-3.6 3.1-5.5 7-5.5s6.2 1.9 7 5.5"/></>, shield: <><path d="M12 3 20 6v5c0 5-3.2 8.4-8 10-4.8-1.6-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/></>, bell: <><path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  building: <><path d="M4 21V5l8-2v18M12 9h8v12M8 8h.01M8 12h.01M8 16h.01M16 13h.01M16 17h.01"/></>, palette: <><path d="M12 3a9 9 0 1 0 0 18h1.2c1.1 0 1.8-1.1 1.3-2.1-.4-.8.2-1.9 1.1-1.9H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10Z"/><path d="M7.5 11h.01M9 7.5h.01M14 7h.01M17.5 11h.01"/></>,
  document: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></>, lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
};

function NavIcon({ name }: { name: IconName }) {
  return <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

function activeRoute(pathname: string, section: string | null, item: NavItem) {
  if (item.section) return pathname === item.href.split("?")[0] && section === item.section;
  if (item.href === "/studio") return pathname === "/studio" && !section;
  if (item.href === "/studio/schedule") return pathname.startsWith(item.href) && section !== "attendance";
  if (item.href === "/studio/incidents") return pathname.startsWith(item.href) && section !== "policy";
  if (item.href === "/studio/classes") return pathname.startsWith(item.href);
  return pathname.startsWith(item.href);
}

export function AdminSidebar({ name, role, studioName, roles, workspaceLinks, mobile = false, onNavigate, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  const section = params.get("section") ?? params.get("view") ?? params.get("role");
  const isOwner = roles.includes("owner");
  return <aside id={mobile ? "studio-mobile-navigation" : undefined} className={`${styles.sidebar}${mobile ? ` ${styles.mobileSidebar}` : ""}`} aria-label="Studio administration" aria-modal={mobile || undefined} role={mobile ? "dialog" : undefined}>
    <div className={styles.top}><Link className={styles.brand} href="/studio" onClick={onNavigate} aria-label="StudioFlow dashboard"><span aria-hidden="true">S</span><b>studioflow</b></Link>{mobile && <button type="button" className={styles.close} onClick={onClose} aria-label="Close studio navigation">×</button>}</div>
    <nav className={styles.navigation} aria-label="Studio navigation">
      {navigation.map((group) => {
        const items = group.items.filter((item) => !item.ownerOnly || isOwner);
        if (!items.length) return null;
        return <section className={styles.group} key={group.label} aria-label={group.label}>
          <h2>{group.label}</h2>
          <ul>{items.map((item) => {
            const active = activeRoute(pathname, section, item);
            return <li key={item.label}><Link href={item.href} onClick={onNavigate} className={`${styles.item}${active ? ` ${styles.active}` : ""}`} aria-current={active ? "page" : undefined}><NavIcon name={item.icon}/><span>{item.label}</span></Link></li>;
          })}</ul>
        </section>;
      })}
    </nav>
    <div className={styles.footer}><WorkspaceProfileMenu name={name} role={role} studioName={studioName} workspaceLinks={workspaceLinks}/></div>
  </aside>;
}
