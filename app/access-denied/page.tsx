import Link from "next/link";
import styles from "@/app/components/sprint-one.module.css";
import { getCurrentPrincipal } from "@/lib/auth/server";
import { isFirestoreQuotaError } from "@/lib/firebase/quota";
import { ServiceUnavailable } from "@/app/components/service-unavailable";

export default async function AccessDeniedPage() {
  try { await getCurrentPrincipal(); }
  catch (error) { if (isFirestoreQuotaError(error)) return <ServiceUnavailable />; }
  return <main className={styles.simplePage}><section className={styles.simpleCard}><div className={styles.deniedIcon}>!</div><p className={styles.kicker}>ACCESS REQUIRED</p><h1>Your account isn&apos;t ready for a studio workspace.</h1><p className={styles.muted}>Your account has no active studio access, or your studio is currently inactive. Contact your studio administrator to update your account configuration.</p><Link prefetch={false} className={styles.primaryLink} href="/">Return to sign in</Link></section></main>;
}
