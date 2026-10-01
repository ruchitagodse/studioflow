import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import studioImage from "@/app/assets/pilates-studio.png";
import { BookingConfirmation } from "@/app/components/booking-confirmation";
import { WaitlistActions, WaitlistPromotionAlert } from "@/app/components/waitlist-actions";
import { CustomerBookingShell } from "@/app/components/customer-booking-shell";
import styles from "@/app/components/booking.module.css";
import { requireWorkspace } from "@/lib/auth/server";
import { getCustomerSlot } from "@/lib/bookings";
import { getCustomerWaitlist } from "@/lib/waitlist";

type DetailIconName = "availability" | "calendar" | "clock" | "trainer" | "credit" | "location";

function DetailIcon({ name }: { name: DetailIconName }) {
  const paths = {
    availability: <><circle cx="12" cy="8" r="3" /><path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6M4 8v6M20 8v6" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
    trainer: <><circle cx="12" cy="8" r="3" /><path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6" /></>,
    credit: <><ellipse cx="12" cy="6" rx="6" ry="2.5" /><path d="M6 6v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6M6 11v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-5" /></>,
    location: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
  };
  return <span className={styles.detailIcon} aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">{paths[name]}</svg></span>;
}

function displaySlotDate(startsAt: string, timezone: string, fallback: string) {
  try { return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: timezone || undefined }).format(new Date(startsAt)); } catch { return fallback; }
}

function duration(start: string, end: string) {
  const toMinutes = (value: string) => { const [hours, minutes] = value.split(":").map(Number); return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null; };
  const starts = toMinutes(start); const ends = toMinutes(end);
  if (starts === null || ends === null) return null;
  const minutes = (ends - starts + 1440) % 1440;
  if (!minutes) return null;
  return minutes % 60 ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min` : `${Math.floor(minutes / 60)} hr`;
}

export default async function SlotDetailPage({ params }: { params: Promise<{ slotId: string }> }) {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/customer"); } catch { redirect("/access-denied"); }
  const { slotId } = await params;
  let detail;
  try { detail = await getCustomerSlot(principal, slotId); } catch { notFound(); }
  if (!detail) notFound();
  const { slot, subscription } = detail;
  const entry = await getCustomerWaitlist(principal, slot.id);
  const unavailable = detail.started
    ? "This class has already started and is no longer bookable."
    : slot.remainingCapacity === 0
        ? null
        : subscription.usableCredits === 0
          ? subscription.state === "inactive" ? "Your subscription is inactive or expired." : "You need an active subscription with an available credit."
          : null;
  const classDuration = duration(slot.startTime, slot.endTime);
  return <CustomerBookingShell active="book" title={slot.className} subtitle="Review the class before reserving your place." compactHeader backHref="/customer">
    <WaitlistPromotionAlert slotId={slot.id} entry={entry} /><div className={`${styles.detail} ${styles.slotDetail}`}><section className={styles.slotDetailCard}><div className={styles.slotVisual}><Image src={studioImage} alt="Pilates reformers in the studio" fill sizes="(max-width: 767px) 100vw, 680px" priority /><span>{slot.className}</span></div><div className={styles.slotDetailBody}><p className={styles.kicker}>CLASS DETAILS</p><ul className={styles.slotFacts}><li><DetailIcon name="availability" /><div><b>Availability</b><span className={slot.remainingCapacity === 0 ? styles.slotFactWarning : styles.slotFactSuccess}>{slot.remainingCapacity === 0 ? "Class is full" : `${slot.remainingCapacity} place${slot.remainingCapacity === 1 ? "" : "s"} remaining`}</span></div><em>{slot.remainingCapacity} / {slot.capacity}</em></li><li><DetailIcon name="calendar" /><div><b>Date</b><span>{displaySlotDate(slot.startsAt, slot.timezone, slot.localDate)}</span></div></li><li><DetailIcon name="clock" /><div><b>Time</b><span>{slot.startTime}–{slot.endTime}{classDuration ? ` · ${classDuration}` : ""}</span></div></li><li><DetailIcon name="trainer" /><div><b>Trainer</b><span>{slot.trainerName}</span></div><i className={styles.trainerInitials} aria-hidden="true">{slot.trainerName.slice(0, 1).toUpperCase()}</i></li><li><DetailIcon name="credit" /><div><b>Credit impact</b><span>Reserves 1 credit</span></div></li><li><DetailIcon name="location" /><div><b>Studio time</b><span>{slot.timezone}</span></div></li></ul>{slot.alreadyBooked ? <section className={`${styles.empty} ${styles.confirmation}`} role="status"><strong>Already booked</strong><p>You’re booked for this class.</p><a href="/customer/bookings">View my booking</a></section> : slot.remainingCapacity === 0 ? <WaitlistActions slotId={slot.id} entry={entry} /> : unavailable ? <section className={`${styles.empty} ${styles.confirmation}`} role="status"><strong>Unavailable</strong><p>{unavailable}</p><a href="/customer">Back to schedule</a></section> : <BookingConfirmation slotId={slot.id} credits={subscription.usableCredits} />}</div></section></div>
  </CustomerBookingShell>;
}
