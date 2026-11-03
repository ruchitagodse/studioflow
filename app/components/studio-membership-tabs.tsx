import Link from "next/link";
import { StudioAction } from "./studio-icon";
import styles from "./studio-membership-tabs.module.css";

export function StudioMembershipTabs({active}:{active:"memberships"|"pauses"}) {
  return <nav className={styles.tabs} aria-label="Membership screens"><Link prefetch={false} href="/studio/subscriptions" aria-current={active==="memberships"?"page":undefined}><StudioAction icon="membership">Memberships</StudioAction></Link><Link prefetch={false} href="/studio/pause-requests" aria-current={active==="pauses"?"page":undefined}><StudioAction icon="pause">Pauses</StudioAction></Link></nav>;
}
