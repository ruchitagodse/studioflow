import { redirect } from "next/navigation";
import { connection } from "next/server";
import Image from "next/image";
import { BookingManagementActions } from "@/app/components/booking-management-actions";
import { CustomerBookingShell } from "@/app/components/customer-booking-shell";
import styles from "@/app/components/booking.module.css";
import readableStyles from "@/app/components/customer-bookings-readable.module.css";
import studioImage from "@/app/assets/pilates-studio.png";
import { requireWorkspace } from "@/lib/auth/server";
import { getCustomerBookings, getCustomerSchedule, type CustomerBookingView } from "@/lib/bookings";

type TargetSlot = { id: string; className: string; localDate: string; startTime: string; endTime: string; trainerName: string; remainingCapacity: number; alreadyBooked: boolean };

function bookingStatusLabel(status: string) {
  if (status === "attended") return "Attended";
  if (status === "no-show") return "No-show";
  return status.replaceAll("-", " ");
}

function BookingList({ items, targets }: { items: CustomerBookingView[]; targets: TargetSlot[] }) {
  if (items.length === 0) return <div className={styles.empty}>Nothing to show yet.</div>;
  return <div className={`${styles.bookingTimeline} ${readableStyles.timeline}`}>{items.map((booking) => <article className={`${styles.historyCard} ${readableStyles.bookingCard}`} key={booking.id}>
    <Image className={styles.bookingThumb} src={studioImage} alt="" sizes="74px" />
    <div className={styles.bookingBody}><p className={styles.kicker}>{booking.localDate}</p><b>{booking.className}</b><span className={styles.bookingTime}>{booking.startTime}–{booking.endTime}</span><span>with {booking.trainerName}</span><em className={styles.status}>{bookingStatusLabel(booking.status)}</em>{booking.isUpcoming && <BookingManagementActions booking={booking} targets={targets.filter((target) => !target.alreadyBooked && target.id !== booking.slotId && target.remainingCapacity > 0)} />}</div>
  </article>)}</div>;
}

export default async function CustomerBookingsPage() {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/customer"); } catch { redirect("/access-denied"); }
  const [bookings, schedule] = await Promise.all([getCustomerBookings(principal), getCustomerSchedule(principal)]);
  const upcoming = bookings.filter((booking) => booking.isUpcoming);
  const history = bookings.filter((booking) => !upcoming.some((item) => item.id === booking.id));
  const targets = schedule.slots.filter((slot) => !slot.alreadyBooked && slot.remainingCapacity > 0);
  return <CustomerBookingShell active="bookings" title="Your bookings" subtitle="Upcoming classes first, followed by your bounded booking history.">
    <div className={readableStyles.bookingsLayout}>
      <section><h2 className={styles.sectionTitle}>Upcoming</h2><BookingList items={upcoming} targets={targets} /></section>
      <section><h2 className={styles.sectionTitle}>History</h2><BookingList items={history} targets={[]} /></section>
    </div>
  </CustomerBookingShell>;
}
