import styles from "@/app/trainer/trainer-dashboard.module.css";

function NavIcon({ name }: { name: "home" | "classes" | "attendance" | "profile" }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9Z" /><path d="M9 21v-6h6v6" /></>,
    classes: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
    attendance: <><circle cx="12" cy="7" r="3" /><path d="M5.5 20c.7-4.2 2.9-6.2 6.5-6.2s5.8 2 6.5 6.2" /><path d="m16.5 15 1.5 1.5 3-3" /></>,
    profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21c.8-3.5 3.1-5.25 7-5.25S18.2 17.5 19 21" /></>,
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function TrainerMobileNav({ active }: { active: "home" | "classes" | "attendance" | "profile" }) {
  return <nav className={styles.mobileNav} aria-label="Trainer navigation">
    <a href="/trainer" aria-current={active === "home" ? "page" : undefined}><NavIcon name="home" /><small>Home</small></a>
    <a href="/trainer/classes" aria-current={active === "classes" ? "page" : undefined}><NavIcon name="classes" /><small>Classes</small></a>
    <a href="/trainer/attendance" aria-current={active === "attendance" ? "page" : undefined}><NavIcon name="attendance" /><small>Attendance</small></a>
    <a href="/trainer/profile" aria-current={active === "profile" ? "page" : undefined}><NavIcon name="profile" /><small>Profile</small></a>
  </nav>;
}
