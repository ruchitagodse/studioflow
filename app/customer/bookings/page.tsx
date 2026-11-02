import { ListPagination } from "@/app/components/list-pagination";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import Image from "next/image";
import { BookingManagementActions } from "@/app/components/booking-management-actions";
import { CustomerBookingShell } from "@/app/components/customer-booking-shell";
import { CustomerBookingsTabs } from "@/app/components/customer-bookings-tabs";

import readableStyles from "@/app/components/customer-bookings-readable.module.css";
import studioImage from "@/app/assets/pilates-studio.png";
import { requireWorkspace } from "@/lib/auth/server";
import { getCustomerBookingsPage, type CustomerBookingView } from "@/lib/bookings";
import { displayCustomerDate } from "@/lib/customer-display";


function bookingStatusLabel(status: string) {
  if (status === "attended") return "Attended";
  if (status === "no-show") return "No-show";
  return status.replaceAll("-", " ");
}

function CalendarIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 10h18" /></svg>; }
function ClockIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></svg>; }
function PersonIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.25" /><path d="M5.5 20c.75-3.1 2.9-4.75 6.5-4.75s5.75 1.65 6.5 4.75" /></svg>; }

function BookingList({ items, history = false }: { items: CustomerBookingView[]; history?: boolean }) {
  if (items.length === 0) return <div className={readableStyles.empty}><CalendarIcon /><h2>{history ? "Your journey starts here" : "Ready for your next session?"}</h2><p>{history ? "Your past classes will appear here." : "Find a class and make time for your practice."}</p>{!history && <a href="/customer">Explore classes <span aria-hidden="true">↗</span></a>}</div>;
  return <div className={readableStyles.timeline}>{items.map((booking) => <article className={`${readableStyles.bookingCard} ${booking.isUpcoming ? readableStyles.upcomingCard : ""}`} key={booking.id}>
    <div className={readableStyles.classSummary}>
      <Image className={readableStyles.bookingThumb} src={studioImage} alt="" sizes="80px" />
      <div className={readableStyles.bookingBody}>
        <div className={readableStyles.bookingDate}><CalendarIcon />{displayCustomerDate(booking.localDate)}</div>
        <h2>{booking.className}</h2>
        <span className={readableStyles.bookingFact}><ClockIcon />{booking.startTime}–{booking.endTime}</span>
        <span className={readableStyles.bookingFact}><PersonIcon />{booking.trainerName}</span>
      </div>
    </div>
    <div className={readableStyles.statusRow}><span className={`${readableStyles.bookingStatus} ${booking.status.startsWith("cancelled") ? readableStyles.cancelledStatus : ""}`}><i aria-hidden="true" />{bookingStatusLabel(booking.status)}</span><span>Pilates studio class</span></div>
    {booking.isUpcoming && <BookingManagementActions booking={booking} />}
  </article>)}</div>;
}
export default async function CustomerBookingsPage({ searchParams }: { searchParams: Promise<{ view?: string; after?: string }> }) {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/customer"); } catch { redirect("/access-denied"); }
  const { view: requestedView, after } = await searchParams;
  const view = requestedView === "history" ? "history" : "upcoming";
  const page = await getCustomerBookingsPage(principal, view, after);
  return <CustomerBookingShell active="bookings" title="Your bookings" subtitle="Your next session. Your time to feel stronger.">
    <CustomerBookingsTabs activeTab={view} upcomingCount={page.upcomingCount}>
      <BookingList items={page.items} history={view === "history"} />
      <ListPagination pathname="/customer/bookings" after={after} nextCursor={page.nextCursor} params={{ view }} />
    </CustomerBookingsTabs>
  </CustomerBookingShell>;
}
