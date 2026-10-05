import styles from "./workspace-skeleton.module.css";

type SkeletonVariant = "customer" | "studio" | "trainer" | "generic";

function Line({ className = "" }: { className?: string }) { return <span className={`${styles.line} ${className}`} />; }

function TopBar() {
  return <header className={styles.topbar} aria-hidden="true"><div className={styles.brand}><Line className={styles.brandMark} /><Line className={styles.brandName} /></div><div className={styles.account}><Line className={styles.avatar} /><div><Line className={styles.accountName} /><Line className={styles.accountMeta} /></div></div></header>;
}

function Navigation({ customer = false }: { customer?: boolean }) {
  const items = customer ? 4 : 3;
  return <nav className={customer ? styles.customerNav : styles.workspaceNav} aria-hidden="true">{Array.from({ length: items }, (_, index) => <div className={styles.navItem} key={index}><Line className={styles.navIcon} /><Line className={styles.navText} /></div>)}</nav>;
}

function Header() { return <header className={styles.pageHeader} aria-hidden="true"><Line className={styles.eyebrow} /><Line className={styles.title} /><Line className={styles.description} /><Line className={styles.shortDescription} /></header>; }

function Cards({ count = 3, image = false }: { count?: number; image?: boolean }) {
  return <section className={styles.cards} aria-hidden="true">{Array.from({ length: count }, (_, index) => <article className={styles.card} key={index}>{image && <Line className={styles.cardImage} />}<Line className={styles.cardTitle} /><Line className={styles.cardText} /><Line className={styles.cardTextShort} /><Line className={styles.cardAction} /></article>)}</section>;
}

export function WorkspaceSkeleton({ variant, embedded = false }: { variant: SkeletonVariant; embedded?: boolean }) {
  if (variant === "generic") return <main className={styles.generic}><TopBar /><div className={styles.genericContent}><Header /><Cards count={2} /></div><span className={styles.srOnly} role="status">Loading workspace</span></main>;
  if (variant === "customer") return <main className={`${styles.customer} ${embedded ? styles.embedded : ""}`}>{!embedded && <TopBar />}<div className={styles.customerBody}><Navigation customer /><div className={styles.customerContent}><Header /><section className={styles.membershipBlock} aria-hidden="true"><Line className={styles.membershipTitle} /><Line className={styles.membershipText} /><Line className={styles.membershipAction} /></section><Cards image /></div></div><span className={styles.srOnly} role="status">Loading customer workspace</span></main>;
  return <main className={`${styles.workspace} ${embedded ? styles.embedded : ""}`}>{!embedded && <TopBar />}<div className={styles.workspaceBody}><Navigation /><div className={styles.workspaceContent}><Header />{variant === "trainer" ? <><section className={styles.metrics} aria-hidden="true"><Line /><Line /><Line /></section><Cards count={2} /></> : <><section className={styles.formGrid} aria-hidden="true"><div><Line className={styles.panelHeading} /><Line className={styles.field} /><Line className={styles.field} /><Line className={styles.button} /></div><div><Line className={styles.panelHeading} /><Line className={styles.field} /><Line className={styles.field} /><Line className={styles.button} /></div></section><Cards count={2} /></>}</div></div><span className={styles.srOnly} role="status">Loading {variant} workspace</span></main>;
}
