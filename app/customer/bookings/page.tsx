import { redirect } from "next/navigation";
import { connection } from "next/server";
import Image from "next/image";
import { BookingManagementActions } from "@/app/components/booking-management-actions";
import { CustomerBookingShell } from "@/app/components/customer-booking-shell";
import { CustomerBookingsTabs } from "@/app/components/customer-bookings-tabs";
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

function CalendarIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 10h18" /></svg>; }
function ClockIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></svg>; }
function PersonIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.25" /><path d="M5.5 20c.75-3.1 2.9-4.75 6.5-4.75s5.75 1.65 6.5 4.75" /></svg>; }

function BookingList({ items, targets }: { items: CustomerBookingView[]; targets: TargetSlot[] }) {
  if (items.length === 0) return <div className={styles.empty}>Nothing to show yet.</div>;
  return <div className={`${styles.bookingTimeline} ${readableStyles.timeline}`}>{items.map((booking) => <article className={`${styles.historyCard} ${readableStyles.bookingCard}`} key={booking.id}>
    <Image className={`${styles.bookingThumb} ${readableStyles.bookingThumb}`} src={studioImage} alt="" sizes="140px" />
    <div className={styles.bookingBody}><div className={readableStyles.bookingDate}><CalendarIcon />{booking.localDate}</div><b>{booking.className}</b><span className={readableStyles.bookingFact}><ClockIcon />{booking.startTime}–{booking.endTime}</span><span className={readableStyles.bookingFact}><PersonIcon />with {booking.trainerName}</span><em className={`${styles.status} ${readableStyles.bookingStatus} ${booking.status.startsWith("cancelled") ? readableStyles.cancelledStatus : ""}`}><i aria-hidden="true" />{bookingStatusLabel(booking.status)}</em>{booking.isUpcoming && <BookingManagementActions booking={booking} targets={targets.filter((target) => !target.alreadyBooked && target.id !== booking.slotId && target.remainingCapacity > 0)} />}</div>
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
    <CustomerBookingsTabs
      upcomingCount={upcoming.length}
      upcoming={<BookingList items={upcoming} targets={targets} />}
      history={<BookingList items={history} targets={[]} />}
    />
  </CustomerBookingShell>;
}
