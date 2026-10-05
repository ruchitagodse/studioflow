import { redirect } from "next/navigation";
import { connection } from "next/server";
import Image from "next/image";
import { CustomerBookingShell } from "@/app/components/customer-booking-shell";
import { requireWorkspace } from "@/lib/auth/server";
import { getCustomerSchedule } from "@/lib/bookings";
import { displayCustomerDate } from "@/lib/customer-display";
import styles from "@/app/components/booking.module.css";
import studioImage from "@/app/assets/pilates-studio.png";
import heroImage from "@/app/assets/pilates-hero-v2.png";

function ScheduleIcon({ name }: { name: "credit" | "calendar" | "clock" | "trainer" | "capacity" }) {
  const paths = {
    credit: <><ellipse cx="12" cy="6" rx="6.2" ry="2.5" /><path d="M5.8 6v4.7c0 1.4 2.8 2.5 6.2 2.5s6.2-1.1 6.2-2.5V6M5.8 10.7v4.7c0 1.4 2.8 2.5 6.2 2.5s6.2-1.1 6.2-2.5v-4.7" /><path d="M5.8 10.7c0 1.4 2.8 2.5 6.2 2.5s6.2-1.1 6.2-2.5" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
    trainer: <><circle cx="12" cy="8" r="3" /><path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6" /></>,
    capacity: <><circle cx="9" cy="9" r="2.5" /><circle cx="16.5" cy="10" r="2" /><path d="M4 19c.6-3.2 2.3-4.8 5-4.8s4.4 1.6 5 4.8M14 18c.4-2.2 1.6-3.4 3.6-3.4 1.2 0 2.2.5 3 1.6" /></>,
  };
  return <span className={styles.scheduleIcon} aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">{paths[name]}</svg></span>;
}
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
    ? `${schedule.subscription.usableCredits} available class pass${schedule.subscription.usableCredits === 1 ? "" : "es"} for any published class.`
    : schedule.subscription.state === "inactive"
      ? "Your subscription is inactive or expired. New bookings need an active plan."
      : "No active subscription is available for a new booking.";
  return <CustomerBookingShell active="book" title="Move with your week." subtitle={`Choose from ${schedule.studioName}'s upcoming classes. Times are shown in ${schedule.timezone || "studio time"}.`} compactHeader heroHeader>
    <div className={styles.homeIntro}>
      <div className={styles.homeHeroImage}><Image className={styles.homeVisual} src={heroImage} alt="A bright Pilates studio with a potted tree" sizes="(min-width: 1024px) 340px, 100vw" priority /></div>
      <section className={`${styles.subscription} ${styles.readyToBook} ${schedule.subscription.usableCredits > 0 ? "" : styles.inactive}`}><ScheduleIcon name="credit" /><div><strong>{schedule.subscription.usableCredits > 0 ? "Ready to book" : "Booking unavailable"}</strong><span>{schedule.subscription.usableCredits > 0 ? <><b className={styles.creditMessage}>{schedule.subscription.usableCredits} available class pass{schedule.subscription.usableCredits === 1 ? "" : "es"}</b> for any published class.</> : subscriptionMessage} <a href="/customer/entitlements">View membership <b aria-hidden="true">→</b></a></span></div></section>
    </div>
    <section className={styles.upcomingSection} aria-labelledby="upcoming-classes"><div className={styles.upcomingHeading}><h2 id="upcoming-classes" className={styles.sectionTitle}>Upcoming classes</h2><span>Available now</span></div>{schedule.slots.length === 0 ? <div className={styles.empty}>There are no published upcoming classes right now. Please check back with your studio soon.</div> : <div className={`${styles.list} ${styles.scheduleList}`}>{schedule.slots.map((slot) => {
      const action = slot.alreadyBooked ? "View booking" : slot.alreadyWaitlisted ? "View waitlist" : slot.remainingCapacity === 0 ? "Join waitlist" : "Book this class";
      const availability = slot.alreadyBooked ? "Booked" : slot.remainingCapacity === 0 ? "Class full" : `${slot.remainingCapacity} seat${slot.remainingCapacity === 1 ? "" : "s"} available`;
      return <a key={slot.id} className={`${styles.card} ${styles.scheduleCard}`} href={`/customer/slots/${slot.id}`}><div className={styles.scheduleImage}><Image src={studioImage} alt="Pilates reformers in the studio" fill sizes="(max-width: 767px) 100vw, 360px" /><span>{slot.className}</span></div><div className={styles.scheduleDetails}><div className={styles.scheduleRow}><ScheduleIcon name="calendar" /><div><b>Date</b><span>{displayCustomerDate(slot.localDate)}</span></div><em className={slot.remainingCapacity > 0 && !slot.alreadyBooked ? styles.scheduleCapacity : styles.badge}><ScheduleIcon name="capacity" />{availability}</em></div><div className={styles.scheduleRow}><ScheduleIcon name="clock" /><div><b>Time</b><span>{slot.startTime}–{slot.endTime}</span></div></div><div className={styles.scheduleRow}><ScheduleIcon name="trainer" /><div><b>Trainer</b><span>{slot.trainerName}</span></div><i className={styles.trainerInitials} aria-hidden="true">{slot.trainerName.slice(0, 1).toUpperCase()}</i></div><span className={styles.buttonLike}>{action} <b aria-hidden="true">→</b></span></div></a>;
    })}</div>}</section>
  </CustomerBookingShell>;
}
