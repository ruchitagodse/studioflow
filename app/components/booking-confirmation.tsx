"use client";

import { useActionState } from "react";
import { createBookingAction, type BookingActionState } from "@/app/customer/actions";
import styles from "./booking.module.css";

const initial: BookingActionState = {};

export function BookingConfirmation({ slotId, credits }: { slotId: string; credits: number }) {
  const [state, formAction, pending] = useActionState(createBookingAction, initial);
  const available = credits > 0;
  return <section className={`${styles.confirmation} ${styles.bookingConfirmation}`} aria-labelledby="booking-confirmation-title">
    <p className={styles.kicker}>BOOKING CONFIRMATION</p>
    <h2 id="booking-confirmation-title">Reserve your place</h2>
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="operationId" defaultValue={crypto.randomUUID()} />
      {state.error && <p className={styles.error} role="alert">{state.error}</p>}
      {state.success && <div className={styles.success} role="status"><p>{state.success}</p><a href="/customer/bookings">View upcoming bookings</a></div>}
      <button type="submit" disabled={!available || pending || Boolean(state.success)}>{pending ? "Confirming…" : state.success ? "Booking confirmed" : "Confirm booking"}</button>
    </form>
    <p className={styles.note}>{available ? `This confirms your class and reserves 1 of your ${credits} available credits.` : "You need an active subscription with an available credit before you can book."}</p>
  </section>;
}
