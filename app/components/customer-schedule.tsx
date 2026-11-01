"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { calendarLabel, calendarWeek, shiftCalendarDate } from "@/lib/customer-calendar";
import studioImage from "@/app/assets/pilates-studio.png";
import styles from "./customer-schedule.module.css";

type ScheduleSlot = { id: string; className: string; trainerName: string; localDate: string; startTime: string; endTime: string; remainingCapacity: number; alreadyBooked: boolean; alreadyWaitlisted: boolean };

export function CustomerSchedule({ slots, today, timezone }: { slots: ScheduleSlot[]; today: string; timezone: string }) {
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState<string | null>(null);
  const days = calendarWeek(anchor);
  const visible = selected ? slots.filter((slot) => slot.localDate === selected) : slots;
  const nextBooked = slots.find((slot) => slot.alreadyBooked);
  const featured = nextBooked ?? slots[0];
  function moveWeek(direction: number) {
    setAnchor(shiftCalendarDate(anchor, direction * 7));
    setSelected(null);
  }

  return <div className={styles.dashboard}>
    <section className={styles.feature} aria-labelledby="next-session">
      <div className={styles.featureCopy}>
        <p className={styles.eyebrow}>{nextBooked ? "YOUR NEXT BOOKING" : "YOUR NEXT SESSION"}</p>
        <h2 id="next-session">{featured?.className ?? "A little time for you."}</h2>
        <p>{featured ? `${calendarLabel(featured.localDate, { day: "numeric", month: "short" })} · ${featured.startTime}–${featured.endTime}` : "Find your next Pilates class here."}</p>
        {featured && <Link className={styles.primary} href={`/customer/slots/${featured.id}`}>{nextBooked ? "View booking" : "Explore class"}<span aria-hidden="true">↗</span></Link>}
      </div>
      <Image src={studioImage} alt="Pilates reformers ready for a studio class" className={styles.featureImage} sizes="(max-width: 767px) 42vw, 360px" priority />
    </section>

    <section className={styles.calendar} aria-labelledby="week-heading">
      <div className={styles.sectionHead}><h2 id="week-heading">This week</h2><div className={styles.weekControls}><button type="button" onClick={() => { setAnchor(today); setSelected(today); }}>Today</button><button type="button" aria-label="Previous week" onClick={() => moveWeek(-1)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12 6-4 4 4 4" /></svg></button><button type="button" aria-label="Next week" onClick={() => moveWeek(1)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 6 4 4-4 4" /></svg></button></div></div>
      <p className={styles.month}>{calendarLabel(days[0], { day: "numeric", month: "short" })} – {calendarLabel(days[6], { day: "numeric", month: "short", year: "numeric" })}</p>
      <div className={styles.week} role="group" aria-label="Filter classes by studio date">
        {days.map((day) => {
          const daySlots = slots.filter((slot) => slot.localDate === day);
          const booked = daySlots.some((slot) => slot.alreadyBooked);
          return <button type="button" key={day} className={`${styles.day} ${booked ? styles.bookedDay : ""} ${selected === day ? styles.selected : ""}`} aria-pressed={selected === day} aria-label={`${calendarLabel(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ${daySlots.length} listed classes${booked ? ", booked class" : ""}`} onClick={() => setSelected(selected === day ? null : day)}>
            <span>{calendarLabel(day, { weekday: "short" })}</span><strong><time dateTime={day} aria-current={day === today ? "date" : undefined}>{day.slice(-2)}</time></strong><i className={`${styles.dayMarker} ${booked ? styles.booked : daySlots.length ? styles.available : styles.noClasses}`} aria-hidden="true">{booked && <svg viewBox="0 0 16 16" focusable="false"><path d="m4 8 2.5 2.5L12 5" /></svg>}</i>
          </button>;
        })}
      </div>
      <div className={styles.legend}><span>● Classes listed</span><span>✓ Booked</span><button type="button" aria-pressed={selected === null} onClick={() => setSelected(null)}>All upcoming</button></div>
    </section>

    <section className={styles.classSection} aria-labelledby="class-list-heading">
      <div className={styles.sectionHead}><h2 id="class-list-heading">{selected ? calendarLabel(selected, { weekday: "long", day: "numeric", month: "short" }) : "Upcoming classes"}</h2><Link href="/customer/bookings">My bookings <span aria-hidden="true">↗</span></Link></div>
      {slots.length > 0 && <p className={styles.listNote}>Studio times · {timezone}</p>}
      <div className={styles.classes} aria-live="polite" aria-atomic="true">
        {visible.length === 0 ? <div className={styles.empty}><span className={styles.emptyIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 11h16m-12 5h4"/></svg></span><div><h3>No classes scheduled{selected ? " for this day" : " yet"}</h3><p>{selected ? "Try another day or view all upcoming." : "Check back soon for your next session."}</p>{selected && <button type="button" onClick={() => setSelected(null)}>Show all upcoming</button>}</div></div> : visible.map((slot) => <Link key={slot.id} href={`/customer/slots/${slot.id}`} className={styles.classCard}>
          <Image src={studioImage} alt="" className={styles.thumbnail} sizes="100px" />
          <div className={styles.classCopy}><h3>{slot.className}</h3><p>{calendarLabel(slot.localDate, { day: "numeric", month: "short" })} <span>·</span> {slot.startTime}–{slot.endTime}</p><p>With {slot.trainerName}</p><span className={styles.status}>{slot.alreadyBooked ? "✓ Booked" : slot.alreadyWaitlisted ? "On waitlist" : slot.remainingCapacity ? `${slot.remainingCapacity} seats available` : "Class full · Waitlist"}</span></div>
          <span className={styles.classAction}>{slot.alreadyBooked ? "View booking" : slot.alreadyWaitlisted ? "View waitlist" : slot.remainingCapacity ? "View class" : "View waitlist"}<span aria-hidden="true"> →</span></span>
        </Link>)}
      </div>
    </section>

  </div>;
}
