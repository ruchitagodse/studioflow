import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { BookingConfirmation } from "@/app/components/booking-confirmation";
import { WaitlistActions } from "@/app/components/waitlist-actions";
import { CustomerBookingShell } from "@/app/components/customer-booking-shell";
import styles from "@/app/components/booking.module.css";
import { requireWorkspace } from "@/lib/auth/server";
import { getCustomerSlot } from "@/lib/bookings";
import { getCustomerWaitlist } from "@/lib/waitlist";

export default async function SlotDetailPage({ params }: { params: Promise<{ slotId: string }> }) {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/customer"); } catch { redirect("/access-denied"); }
  const { slotId } = await params;
  let detail;
  try { detail = await getCustomerSlot(principal, slotId); } catch { notFound(); }
  if (!detail) notFound();
  const { slot, subscription } = detail;
  const entry = slot.remainingCapacity === 0 ? await getCustomerWaitlist(principal, slot.id) : null;
  const unavailable = detail.started
    ? "This class has already started and is no longer bookable."
    : slot.remainingCapacity === 0
        ? null
        : subscription.usableCredits === 0
          ? subscription.state === "inactive" ? "Your subscription is inactive or expired." : "You need an active subscription with an available credit."
          : null;
  return <CustomerBookingShell active="book" title={slot.className} subtitle="Review the class before reserving your place.">
    <div className={styles.detail}><section className={styles.card}><p className={styles.kicker}>CLASS DETAILS</p><ul className={styles.facts}><li><b>Availability</b><span>{slot.remainingCapacity === 0 ? "Full" : `${slot.remainingCapacity} place${slot.remainingCapacity === 1 ? "" : "s"} remaining`}</span></li><li><b>Date</b><span>{slot.localDate}</span></li><li><b>Time</b><span>{slot.startTime}–{slot.endTime}</span></li><li><b>Trainer</b><span>{slot.trainerName}</span></li><li><b>Credit impact</b><span>Reserves 1 credit</span></li><li><b>Studio time</b><span>{slot.timezone}</span></li></ul></section>{slot.alreadyBooked ? <section className={`${styles.empty} ${styles.confirmation}`} role="status"><strong>Already booked</strong><p>You’re booked for this class.</p><a href="/customer/bookings">View my booking</a></section> : slot.remainingCapacity === 0 ? <WaitlistActions slotId={slot.id} entry={entry} /> : unavailable ? <section className={`${styles.empty} ${styles.confirmation}`} role="status"><strong>Unavailable</strong><p>{unavailable}</p><a href="/customer">Back to schedule</a></section> : <BookingConfirmation slotId={slot.id} credits={subscription.usableCredits} />}</div>
  </CustomerBookingShell>;
}
