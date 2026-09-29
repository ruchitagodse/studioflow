import styles from "./studio-dashboard.module.css";

type WorkspaceProps = { name: string; role: "Studio owner" | "Studio administrator" };
type DashboardAction = { eyebrow: string; title: string; description: string; href: string; label: string; icon: string; featured?: boolean };

export function ProtectedWorkspace({ name, role }: WorkspaceProps) {
  const isOwner = role === "Studio owner";
  const roleLabel = isOwner ? "OWNER" : "STAFF";
  const actions: DashboardAction[] = [
    { eyebrow: "SCHEDULE", title: "Classes & slots", description: "Manage classes, concrete slots and trainer assignments.", href: "/studio/schedule", label: "Open schedule", icon: "◷", featured: true },
    ...(isOwner ? [{ eyebrow: "TEAM", title: "Studio members", description: "Invite people and maintain team access for your studio.", href: "/studio/team", label: "Manage team", icon: "◎" }] : []),
    { eyebrow: "SUBSCRIPTIONS & PLANS", title: "Entitlements", description: "Manage plans, customer subscriptions and credit records.", href: "/studio/entitlements", label: "Manage entitlements", icon: "◈" },
    { eyebrow: "ATTENDANCE", title: "Class attendance", description: "Open the schedule to review a class roster and attendance.", href: "/studio/schedule", label: "Open attendance", icon: "✓" },
    { eyebrow: "WAITLIST", title: "Active queues", description: "Review customers waiting for an available place.", href: "/studio/waitlist", label: "Open waitlist", icon: "≋" },
    { eyebrow: "INCIDENTS", title: "Policy review", description: "Review factual customer incidents and policy state.", href: "/studio/incidents", label: "Review incidents", icon: "!" },
  ];

  return <main className={styles.page}>
    <header className={styles.hero}>
      <div><p className={styles.kicker}>STUDIO DASHBOARD</p><h1>Good morning, {name}.</h1><p>Manage your studio schedule, team, subscriptions and attendance from one place.</p></div>
      <aside className={styles.rolePanel} aria-label={`Current role: ${roleLabel}`}><span>YOUR WORKSPACE</span><strong>{roleLabel}</strong><small>Verified studio access</small></aside>
    </header>
    <section className={styles.sectionHeader} aria-labelledby="operations-heading"><div><p className={styles.kicker}>STUDIO OPERATIONS</p><h2 id="operations-heading">Everything in its place.</h2></div><p>Choose an area to continue.</p></section>
    <section className={styles.grid} aria-label="Studio management areas">{actions.map((action) => <article className={`${styles.card}${action.featured ? ` ${styles.featured}` : ""}`} key={action.eyebrow}>
      <div className={styles.cardTop}><span className={styles.icon} aria-hidden="true">{action.icon}</span><p>{action.eyebrow}</p></div>
      <div><h3>{action.title}</h3><p>{action.description}</p></div>
      <a className={action.featured ? styles.primaryAction : styles.action} href={action.href}>{action.label} <span aria-hidden="true">→</span></a>
    </article>)}</section>
  </main>;
}
