import { redirect } from "next/navigation";
import { connection } from "next/server";
import Image from "next/image";
import { CustomerBookingShell } from "@/app/components/customer-booking-shell";
import { requireWorkspace } from "@/lib/auth/server";
import { getCustomerSchedule } from "@/lib/bookings";
import styles from "@/app/components/booking.module.css";
import studioImage from "@/app/assets/pilates-studio.png";
export default async function CustomerWorkspace() {
  await connection();
  let principal;
  let accessError: unknown;
  try { principal = await requireWorkspace("/customer"); } catch (error) {
    accessError = error;
    console.error("StudioFlow customer access resolution failed.", error);
  }
  if (!principal) redirect(accessError instanceof Error && accessError.message === "NO_ACTIVE_SESSION" ? "/" : "/access-denied");
  let schedule;
  try { schedule = await getCustomerSchedule(principal); } catch (error) {
    console.error("StudioFlow customer schedule failed.", error);
    redirect("/access-denied");
  }
  const subscriptionMessage = schedule.subscription.usableCredits > 0
    ? `${schedule.subscription.usableCredits} available credit${schedule.subscription.usableCredits === 1 ? "" : "s"} for any published class.`
    : schedule.subscription.state === "inactive"
      ? "Your subscription is inactive or expired. New bookings need an active plan."
      : "No active subscription is available for a new booking.";
  return <CustomerBookingShell active="book" title="Move with your week." subtitle={`Choose from ${schedule.studioName}'s upcoming classes. Times are shown in ${schedule.timezone || "studio time"}.`}>
    <div className={styles.homeIntro}>
      <section className={`${styles.subscription} ${schedule.subscription.usableCredits > 0 ? "" : styles.inactive}`}><strong>{schedule.subscription.usableCredits > 0 ? "Ready to book" : "Booking unavailable"}</strong><span>{subscriptionMessage} <a href="/customer/entitlements">View membership</a></span></section>
      <Image className={styles.homeVisual} src={studioImage} alt="A bright Pilates reformer studio" sizes="(min-width: 1024px) 340px, 100vw" priority />
    </div>
    <section aria-labelledby="upcoming-classes"><h2 id="upcoming-classes" className={styles.sectionTitle}>Upcoming classes</h2>{schedule.slots.length === 0 ? <div className={styles.empty}>There are no published upcoming classes right now. Please check back with your studio soon.</div> : <div className={styles.list}>{schedule.slots.map((slot) => {
      const state = slot.alreadyBooked ? "Booked" : slot.remainingCapacity === 0 ? "Full" : `${slot.remainingCapacity} place${slot.remainingCapacity === 1 ? "" : "s"} left`;
      const badge = slot.alreadyBooked ? styles.booked : slot.remainingCapacity === 0 ? styles.full : styles.badge;
      return <a key={slot.id} className={styles.card} href={`/customer/slots/${slot.id}`}><div className={styles.cardTop}><div><p className={styles.kicker}>{slot.localDate}</p><h2>{slot.className}</h2><span className={styles.time}>{slot.startTime}–{slot.endTime}</span></div><em className={badge}>{state}</em></div><div className={styles.cardFooter}><span className={styles.muted}>with {slot.trainerName}</span><span className={styles.buttonLike}>{slot.alreadyBooked ? "View booking" : slot.remainingCapacity === 0 ? "View options" : "Book class"}</span></div></a>;
    })}</div>}</section>
  </CustomerBookingShell>;
}
