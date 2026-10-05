import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { CSSProperties } from "react";
import { CustomerBookingShell } from "@/app/components/customer-booking-shell";
import { SubscriptionPauseControl } from "@/app/components/subscription-pause-control";
import { CustomerCreditHistory } from "@/app/components/customer-credit-history";
import styles from "@/app/components/booking.module.css";
import { requireWorkspace } from "@/lib/auth/server";
import { getCustomerEntitlement } from "@/lib/entitlements";

function PauseMetricIcon({ name }: { name: "allowance" | "used" | "remaining" }) {
  const paths = {
    allowance: <><circle cx="12" cy="12" r="7" /><path d="M12 8v4l2.5 2" /></>,
    used: <><circle cx="12" cy="12" r="7" /><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" /></>,
    remaining: <><circle cx="12" cy="12" r="7" /><path d="M12 7v5l3 2" /></>,
  };
  return <span className={styles.pauseMetricIcon} aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">{paths[name]}</svg></span>;
}

function CreditBalanceIcon({ name }: { name: "available" | "reserved" | "used" }) {
  const paths = {
    available: <><ellipse cx="12" cy="6" rx="5.5" ry="2.2" /><path d="M6.5 6v4.2c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2V6M6.5 10.2v4.2c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2v-4.2" /></>,
    reserved: <><circle cx="12" cy="12" r="7" /><path d="M12 8v4l2.7 2.2" /></>,
    used: <><circle cx="12" cy="12" r="7" /><path d="m9 12 2 2 4-4" /></>,
  };
  return <span className={styles.creditMetricIcon} aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">{paths[name]}</svg></span>;
}

function displayDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "2-digit" }).format(new Date(value)) : "—";
}

export default async function CustomerEntitlementsPage() {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/customer"); } catch { redirect("/access-denied"); }
  const view = await getCustomerEntitlement(principal);
  const subscription = view.subscription;
  return <CustomerBookingShell active="membership" title="Your membership" subtitle="Your plan, class passes, and pause allowance in one place.">
    {!subscription ? <section className={styles.empty}><strong>No active membership</strong><p>Your studio has not assigned a membership yet. Contact the studio team for help.</p></section> : <div className={styles.membershipStack}>
      <section className={`${styles.membershipPanel} ${styles.membershipHero}`} aria-labelledby="membership-plan"><p className={styles.kicker}>CURRENT PLAN</p><div className={styles.panelHeading}><h2 id="membership-plan">{subscription.planName}</h2><em className={styles.status}>{subscription.status}</em></div><p className={styles.membershipExpiry}>Valid until {displayDate(subscription.effectiveEndsAt)}</p></section>
      <section className={styles.membershipPanel} aria-labelledby="membership-credits"><p className={styles.kicker}>CLASS PASSES</p><h2 id="membership-credits">Your class balance</h2><dl className={styles.creditGrid}><div><dt><CreditBalanceIcon name="available" /><span>Available</span></dt><dd>{subscription.availableCredits}</dd></div><div><dt><CreditBalanceIcon name="reserved" /><span>Booked</span></dt><dd>{subscription.reservedCredits}</dd></div><div><dt><CreditBalanceIcon name="used" /><span>Used</span></dt><dd>{subscription.usedCredits}</dd></div></dl><p className={styles.creditBalanceNote}><span aria-hidden="true">i</span>A class pass is used when you book a class.</p></section>
      <section className={`${styles.membershipPanel} ${styles.pausePanel}`} aria-labelledby="membership-pause"><p className={styles.kicker}>PAUSE</p><h2 id="membership-pause">Pause allowance</h2><div className={styles.pauseSummary}><div className={styles.pauseRing} style={{ "--pause-progress": `${Math.max(0, Math.min(100, ((subscription.pauseAllowanceDays - subscription.pauseDaysUsed) / Math.max(1, subscription.pauseAllowanceDays)) * 100))}%` } as CSSProperties}><strong>{Math.max(0, subscription.pauseAllowanceDays - subscription.pauseDaysUsed)}</strong><span>days left</span></div><dl className={styles.pauseStats}><div><PauseMetricIcon name="allowance" /><dt>Total allowance</dt><dd>{subscription.pauseAllowanceDays} days</dd></div><div><PauseMetricIcon name="used" /><dt>Used</dt><dd>{subscription.pauseDaysUsed} day{subscription.pauseDaysUsed === 1 ? "" : "s"}</dd></div><div><PauseMetricIcon name="remaining" /><dt>Remaining</dt><dd>{Math.max(0, subscription.pauseAllowanceDays - subscription.pauseDaysUsed)} days</dd></div></dl></div><SubscriptionPauseControl subscriptionId={subscription.id} status={subscription.status} durationMonths={subscription.durationMonths} pauseDaysUsed={subscription.pauseDaysUsed} pauseAllowanceDays={subscription.pauseAllowanceDays} pauseEndsAt={subscription.pauseEndsAt} /></section>
      {view.ledger.length > 0 && <CustomerCreditHistory entries={view.ledger} />}
    </div>}
  </CustomerBookingShell>;
}
