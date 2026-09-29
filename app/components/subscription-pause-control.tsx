"use client";

import { useActionState } from "react";
import { requestOwnPauseAction, type CustomerSubscriptionActionState } from "@/app/customer/subscription-actions";
import styles from "./booking.module.css";

const initial: CustomerSubscriptionActionState = {};

export function SubscriptionPauseControl({ subscriptionId, status, durationMonths, pauseDaysUsed, pauseAllowanceDays }: { subscriptionId: string; status: string; durationMonths: number | null; pauseDaysUsed: number; pauseAllowanceDays: number }) {
  const [state, action, pending] = useActionState(requestOwnPauseAction, initial);
  if (!durationMonths) return <p className={styles.note}>This fixed-day plan is not eligible for pause.</p>;
  if (status === "paused") return <p className={styles.note}>Your subscription is paused. Existing bookings and reserved credits remain unchanged.</p>;
  if (status !== "active") return null;
  const remaining = pauseAllowanceDays - pauseDaysUsed;
  if (remaining < 1) return <p className={styles.note}>Your {pauseAllowanceDays}-day pause allowance has been used.</p>;
  return <form action={action} className={styles.form}><input type="hidden" name="subscriptionId" value={subscriptionId} /><input type="hidden" name="operationId" defaultValue={crypto.randomUUID()} /><label>Pause days remaining: {remaining}<input name="pauseDays" type="number" min="1" max={remaining} required disabled={pending} /></label><p className={styles.note}>Pause begins now. It does not change your credits or existing bookings.</p>{state.error && <p className={styles.error} role="alert">{state.error}</p>}{state.success && <p className={styles.success} role="status">{state.success}</p>}<button disabled={pending}>{pending ? "Pausing…" : "Pause subscription"}</button></form>;
}
