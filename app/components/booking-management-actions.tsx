"use client";

import { useActionState, useState } from "react";
import { cancelBookingAction, rescheduleBookingAction, type BookingActionState } from "@/app/customer/actions";
import styles from "./booking.module.css";

type Booking = { id: string; cancellationState: "free" | "late" | "unavailable"; reschedulable: boolean };
type Target = { id: string; className: string; localDate: string; startTime: string; endTime: string; trainerName: string; remainingCapacity: number; alreadyBooked: boolean };
const initial: BookingActionState = {};

export function BookingManagementActions({ booking, targets }: { booking: Booking; targets: Target[] }) {
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelBookingAction, initial);
  const [rescheduleState, rescheduleAction, reschedulePending] = useActionState(rescheduleBookingAction, initial);
  const [cancelOperationId] = useState(() => crypto.randomUUID()); const [rescheduleOperationId] = useState(() => crypto.randomUUID());
  if (booking.cancellationState === "unavailable") return <p className={styles.actionHint}>This booking can no longer be changed online.</p>;
  const late = booking.cancellationState === "late";
  return <div className={styles.bookingActions}>
    <details className={styles.actionDetails}><summary>Cancel booking</summary><p>{late ? "This is a late cancellation. Your reserved credit will be consumed." : "You can cancel this booking and your credit will be returned."}</p><form action={cancelAction} className={styles.compactForm}><input type="hidden" name="bookingId" value={booking.id} /><input type="hidden" name="operationId" value={cancelOperationId} />{cancelState.error && <p className={styles.error} role="alert">{cancelState.error}</p>}{cancelState.success && <p className={styles.success} role="status">{cancelState.success}</p>}<button type="submit" disabled={cancelPending || Boolean(cancelState.success)}>{cancelPending ? "Cancelling…" : late ? "Confirm late cancellation" : "Confirm cancellation"}</button></form></details>
    {booking.reschedulable && <details className={styles.actionDetails}><summary>Reschedule</summary>{targets.length ? <form action={rescheduleAction} className={styles.compactForm}><input type="hidden" name="bookingId" value={booking.id} /><input type="hidden" name="operationId" value={rescheduleOperationId} /><label>New class<select name="targetSlotId" required disabled={reschedulePending}>{targets.map((target) => <option key={target.id} value={target.id}>{target.localDate} · {target.startTime}–{target.endTime} · {target.className} with {target.trainerName} ({target.remainingCapacity} available)</option>)}</select></label><p>Your existing reserved credit will move with your booking.</p>{rescheduleState.error && <p className={styles.error} role="alert">{rescheduleState.error}</p>}{rescheduleState.success && <p className={styles.success} role="status">{rescheduleState.success}</p>}<button type="submit" disabled={reschedulePending || Boolean(rescheduleState.success)}>{reschedulePending ? "Rescheduling…" : "Confirm reschedule"}</button></form> : <p className={styles.actionHint}>There are no eligible available classes to reschedule into right now.</p>}</details>}
  </div>;
}
