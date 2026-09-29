import styles from "@/app/trainer/trainer-dashboard.module.css";

export function TrainerMobileNav({ active }: { active: "home" | "profile" }) {
  return <nav className={styles.mobileNav} aria-label="Trainer navigation">
    <a href="/trainer" aria-current={active === "home" ? "page" : undefined}><span aria-hidden="true">⌂</span>Home</a>
    <a href="/trainer#assigned-classes"><span aria-hidden="true">▣</span>Classes</a>
    <a href="/trainer#assigned-classes"><span aria-hidden="true">♙</span>Roster</a>
    <a href="/trainer/profile" aria-current={active === "profile" ? "page" : undefined}><span aria-hidden="true">◌</span>Profile</a>
  </nav>;
}
