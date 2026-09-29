import { redirect } from "next/navigation";
import { connection } from "next/server";
import { CustomerBookingShell } from "@/app/components/customer-booking-shell";
import { SubscriptionPauseControl } from "@/app/components/subscription-pause-control";
import styles from "@/app/components/booking.module.css";
import { requireWorkspace } from "@/lib/auth/server";
import { getCustomerEntitlement } from "@/lib/entitlements";

function displayDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "—";
}

export default async function CustomerEntitlementsPage() {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/customer"); } catch { redirect("/access-denied"); }
  const view = await getCustomerEntitlement(principal);
  const subscription = view.subscription;
  return <CustomerBookingShell active="membership" title="Your membership" subtitle="Your plan, credits, and pause allowance in one place.">
    {!subscription ? <section className={styles.empty}><strong>No active membership</strong><p>Your studio has not assigned a membership yet. Contact the studio team for help.</p></section> : <div className={styles.membershipStack}>
      <section className={`${styles.membershipPanel} ${styles.membershipHero}`} aria-labelledby="membership-plan"><p className={styles.kicker}>CURRENT PLAN</p><div className={styles.panelHeading}><h2 id="membership-plan">{subscription.planName}</h2><em className={styles.status}>{subscription.status}</em></div><p className={styles.membershipExpiry}>Valid until {displayDate(subscription.effectiveEndsAt)}</p></section>
      <section className={styles.membershipPanel} aria-labelledby="membership-credits"><p className={styles.kicker}>CREDITS</p><h2 id="membership-credits">Your class balance</h2><dl className={styles.creditGrid}><div><dt>Available</dt><dd>{subscription.availableCredits}</dd></div><div><dt>Reserved</dt><dd>{subscription.reservedCredits}</dd></div><div><dt>Used</dt><dd>{subscription.usedCredits}</dd></div></dl></section>
      <section className={styles.membershipPanel} aria-labelledby="membership-pause"><p className={styles.kicker}>PAUSE</p><h2 id="membership-pause">Pause allowance</h2><dl className={styles.metricList}><div><dt>Allowance</dt><dd>{subscription.pauseAllowanceDays} days</dd></div><div><dt>Used</dt><dd>{subscription.pauseDaysUsed} days</dd></div><div><dt>Remaining</dt><dd>{Math.max(0, subscription.pauseAllowanceDays - subscription.pauseDaysUsed)} days</dd></div></dl><SubscriptionPauseControl subscriptionId={subscription.id} status={subscription.status} durationMonths={subscription.durationMonths} pauseDaysUsed={subscription.pauseDaysUsed} pauseAllowanceDays={subscription.pauseAllowanceDays} /></section>
      {view.ledger.length > 0 && <section className={styles.membershipPanel} aria-labelledby="membership-history"><p className={styles.kicker}>CREDIT HISTORY</p><h2 id="membership-history">Recent activity</h2><div className={styles.ledgerList}>{view.ledger.map((entry) => <div key={entry.id}><span>{entry.action.replaceAll("_", " ")}</span><strong>{entry.amount > 0 ? `+${entry.amount}` : entry.amount}</strong></div>)}</div></section>}
    </div>}
  </CustomerBookingShell>;
}
