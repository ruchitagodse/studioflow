"use client";

import { useState, useTransition, type FormEvent } from "react";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";
import { createBookingAction, type BookingActionState } from "@/app/customer/actions";
import styles from "./booking.module.css";

const initial: BookingActionState = {};

export function BookingConfirmation({ slotId, credits }: { slotId: string; credits: number }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [operationId] = useState(() => crypto.randomUUID());
  const router = useRouter();
  const available = credits > 0;
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(undefined); const form = new FormData(event.currentTarget); startTransition(async () => { const state = await createBookingAction(initial, form); if (state.error) { setError(state.error); return; } await Swal.fire({ icon: "success", title: "Booking confirmed", text: state.success ?? "Your class has been booked.", confirmButtonText: "View my bookings", customClass: { popup: styles.swalPopup, confirmButton: styles.swalConfirm } }); router.replace("/customer/bookings"); }); }
  return <section className={`${styles.confirmation} ${styles.bookingConfirmation}`} aria-labelledby="booking-confirmation-title">
    <p className={styles.kicker}>BOOKING CONFIRMATION</p>
    <h2 id="booking-confirmation-title">Reserve your place</h2>
    <form onSubmit={submit} className={styles.form}>
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="operationId" value={operationId} />
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button type="submit" disabled={!available || pending}>{pending ? "Confirming…" : "Confirm booking"}</button>
    </form>
    <p className={styles.note}>{available ? `This confirms your class and reserves 1 of your ${credits} available class passes.` : "You need an active membership with an available class pass before you can book."}</p>
  </section>;
}
