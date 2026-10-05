import Link from "next/link";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Principal } from "@/lib/auth/server";
import styles from "./studio-dashboard.module.css";

type Slot = { id: string; className: string; trainerName: string; start: Date; end: Date; booked: number; capacity: number; status: string };
type Activity = { id: string; actor: string; action: string; detail: string; createdAt: Date | null };
type Waitlist = { id: string; className: string; startTime: string; count: number };

function dateValue(value: unknown) { return value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function" ? value.toDate() as Date : null; }
function localDate(timeZone: string) { const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])); return `${value.year}-${value.month}-${value.day}`; }
function displayDate(timeZone: string) { return new Intl.DateTimeFormat("en-IN", { timeZone, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date()); }
function displayTime(value: Date, timeZone: string) { return new Intl.DateTimeFormat("en-IN", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(value); }
function displayActivityTime(value: Date | null, timeZone: string) { return value ? new Intl.DateTimeFormat("en-IN", { timeZone, hour: "2-digit", minute: "2-digit" }).format(value) : "Recently"; }
function slotState(slot: Slot, now: Date) { if (slot.status === "cancelled") return "Cancelled"; if (slot.start <= now && slot.end > now) return "Ongoing"; if (slot.start > now) return "Upcoming"; return "Completed"; }
function activityLabel(action: string) { const labels: Record<string, string> = { "booking.created": "Booked a class", "booking.cancelled": "Cancelled booking", "attendance.marked": "Marked attendance", "subscription.pause_started": "Paused membership", "subscription.resumed": "Resumed membership", "subscription.created": "Created membership", "subscription.renewed": "Renewed membership", "incident.waived": "Waived incident", "waitlist.removed": "Updated waitlist" }; return labels[action] ?? action.replaceAll(".", " "); }
function activityDetail(data: Record<string, unknown>) { const after = data.after && typeof data.after === "object" ? data.after as Record<string, unknown> : {}; const outcome = typeof after.outcome === "string" ? after.outcome : null; const reason = typeof data.reason === "string" ? data.reason : null; return outcome ? `Recorded as ${outcome.replace("-", " ")}` : reason || "Studio activity"; }
function weekDates(today: string) { const date = new Date(`${today}T12:00:00Z`); const offset = (date.getUTCDay() + 6) % 7; date.setUTCDate(date.getUTCDate() - offset); return Array.from({ length: 7 }, (_, index) => { const current = new Date(date); current.setUTCDate(date.getUTCDate() + index); return current.toISOString().slice(0, 10); }); }

function Icon({ name }: { name: "calendar" | "bookings" | "members" | "trainer" | "arrow" | "search" | "waitlist" | "pause" }) {
  const paths = { calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>, bookings: <><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12h8M12 8v8"/></>, members: <><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.7-3.2 2.5-5 5.5-5s4.8 1.8 5.5 5M16 5a3 3 0 0 1 0 5.8M18 15c1.5.7 2.3 2.2 2.5 4"/></>, trainer: <><circle cx="12" cy="8" r="3.5"/><path d="M5 21c.8-3.6 3.1-5.5 7-5.5s6.2 1.9 7 5.5"/></>, arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>, search: <><circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/></>, waitlist: <><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.6-3.1 2.4-4.8 5.5-4.8s4.9 1.7 5.5 4.8M17 6v6M14 9h6"/></>, pause: <><rect x="5" y="4" width="14" height="16" rx="3"/><path d="M10 9v6M14 9v6"/></> };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

async function safe<T>(promise: Promise<T>) { try { return await promise; } catch { return null; } }

export async function StudioDashboard({ principal }: { principal: Principal }) {
  const studioId = principal.studioId!;
  const db = getAdminDb();
  const studio = await db.doc(`studios/${studioId}`).get();
  const timezone = String(studio.data()?.timezone ?? "Asia/Kolkata");
  const today = localDate(timezone);
  const datesThisWeek = weekDates(today);
  const [member, slotDocs, weekSlotDocs, activeCustomers, trainers, activeSubscriptions, pausedSubscriptions, expiredSubscriptions, cancelledSubscriptions, activeIncidents, waitlistDocs, auditDocs] = await Promise.all([
    safe(db.doc(`studios/${studioId}/members/${principal.uid}`).get()),
    safe(db.collection(`studios/${studioId}/slots`).where("localDate", "==", today).limit(50).get()),
    safe(db.collection(`studios/${studioId}/slots`).where("localDate", ">=", datesThisWeek[0]).where("localDate", "<=", datesThisWeek[6]).limit(100).get()),
    safe(db.collection(`studios/${studioId}/members`).where("status", "==", "active").where("roles", "array-contains", "customer").count().get()),
    safe(db.collection(`studios/${studioId}/members`).where("status", "==", "active").where("roles", "array-contains", "trainer").count().get()),
    safe(db.collection(`studios/${studioId}/subscriptions`).where("status", "==", "active").count().get()),
    safe(db.collection(`studios/${studioId}/subscriptions`).where("status", "==", "paused").count().get()),
    safe(db.collection(`studios/${studioId}/subscriptions`).where("status", "==", "inactive").where("inactiveReason", "==", "expired").count().get()),
    safe(db.collection(`studios/${studioId}/subscriptions`).where("status", "==", "inactive").where("inactiveReason", "==", "cancelled_immediate").count().get()),
    safe(db.collection(`studios/${studioId}/incidents`).where("status", "==", "active").count().get()),
    safe(db.collection(`studios/${studioId}/waitlists`).where("status", "==", "active").limit(100).get()),
    safe(db.collection(`studios/${studioId}/auditEvents`).orderBy("createdAt", "desc").limit(8).get()),
  ]);
  const trainerIds = [...new Set(slotDocs?.docs.map((doc) => String(doc.data().trainerUid ?? "")).filter(Boolean) ?? [])];
  const trainerDocs = await Promise.all(trainerIds.map((uid) => safe(db.doc(`studios/${studioId}/members/${uid}`).get())));
  const trainerNames = new Map(trainerDocs.filter((doc): doc is NonNullable<typeof doc> => Boolean(doc)).map((doc) => [doc.id, String(doc.data()?.displayName ?? "").trim() || "Trainer"]));
  const slots: Slot[] = (slotDocs?.docs ?? []).map((doc) => { const data = doc.data(); const start = dateValue(data.startsAt); const end = dateValue(data.endsAt); return start && end ? { id: doc.id, className: String(data.className ?? "Class"), trainerName: trainerNames.get(String(data.trainerUid ?? "")) ?? "Trainer", start, end, booked: Number(data.confirmedBookingCount ?? 0), capacity: Number(data.capacity ?? 0), status: String(data.status ?? "") } : null; }).filter((slot): slot is Slot => Boolean(slot)).filter((slot) => ["published", "completed"].includes(slot.status)).sort((a, b) => a.start.getTime() - b.start.getTime());
  const weekBookings = new Map(datesThisWeek.map((date) => [date, 0]));
  for (const doc of weekSlotDocs?.docs ?? []) { const data = doc.data(); if (["published", "completed"].includes(String(data.status ?? ""))) { const date = String(data.localDate ?? ""); weekBookings.set(date, (weekBookings.get(date) ?? 0) + Number(data.confirmedBookingCount ?? 0)); } }
  const weeklyChart = datesThisWeek.map((date) => ({ date, label: new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)), value: weekBookings.get(date) ?? 0 }));
  const bookingDocs = await Promise.all(slots.map((slot) => safe(db.collection(`studios/${studioId}/bookings`).where("slotId", "==", slot.id).limit(100).get())));
  const attendance = bookingDocs.reduce((summary, docs) => { for (const doc of docs?.docs ?? []) { const status = String(doc.data().status ?? ""); if (status === "attended") summary.attended += 1; else if (status === "no-show") summary.noShow += 1; else if (status === "confirmed") summary.pending += 1; } return summary; }, { attended: 0, noShow: 0, pending: 0 });
  const waitlistSlotIds = [...new Set(waitlistDocs?.docs.map((doc) => String(doc.data().slotId ?? "")).filter(Boolean) ?? [])];
  const waitlistSlots = await Promise.all(waitlistSlotIds.map((id) => safe(db.doc(`studios/${studioId}/slots/${id}`).get())));
  const waitlists: Waitlist[] = waitlistSlotIds.map((id, index) => { const slot = waitlistSlots[index]?.data(); const count = waitlistDocs?.docs.filter((doc) => String(doc.data().slotId ?? "") === id).length ?? 0; return { id, className: String(slot?.className ?? "Class"), startTime: String(slot?.startTime ?? ""), count }; }).filter((item) => item.count > 0);
  const actorIds = [...new Set(auditDocs?.docs.map((doc) => String(doc.data().actorUid ?? "")).filter((uid) => uid && uid !== "system") ?? [])];
  const actors = await Promise.all(actorIds.map((uid) => safe(db.doc(`studios/${studioId}/members/${uid}`).get())));
  const names = new Map(actors.filter((doc): doc is NonNullable<typeof doc> => Boolean(doc)).map((doc) => [doc.id, String(doc.data()?.displayName ?? "").trim() || "Studio member"]));
  const activities: Activity[] = (auditDocs?.docs ?? []).map((doc) => { const data = doc.data(); const actorUid = String(data.actorUid ?? ""); return { id: doc.id, actor: actorUid === "system" ? "StudioFlow" : names.get(actorUid) ?? "Studio member", action: activityLabel(String(data.action ?? "Studio activity")), detail: activityDetail(data), createdAt: dateValue(data.createdAt) }; });
  const activeMemberCount = activeCustomers?.data().count ?? null;
  const trainerCount = trainers?.data().count ?? null;
  const activeSubscriptionCount = activeSubscriptions?.data().count ?? null;
  const pausedSubscriptionCount = pausedSubscriptions?.data().count ?? null;
  const expiredSubscriptionCount = expiredSubscriptions?.data().count ?? null;
  const cancelledSubscriptionCount = cancelledSubscriptions?.data().count ?? null;
  const membershipTotal = (activeSubscriptionCount ?? 0) + (pausedSubscriptionCount ?? 0) + (expiredSubscriptionCount ?? 0) + (cancelledSubscriptionCount ?? 0);
  const incidentCount = activeIncidents?.data().count ?? null;
  const totalAttendance = attendance.attended + attendance.noShow + attendance.pending;
  const displayName = String(member?.data()?.displayName ?? "").trim() || principal.email?.split("@")[0] || "there";
  const scheduleError = slotDocs === null;

  return <main className={styles.page}>
    <div className={styles.utilityBar}><div className={styles.searchPlaceholder} role="search" aria-label="Search studio records"><Icon name="search"/><span>Search customers, classes, or bookings…</span></div><div className={styles.utilityIdentity}><span className={styles.notification} aria-label="Notifications">♢</span><span className={styles.utilityAvatar} aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span><span><b>{displayName}</b><small>{principal.roles.includes("owner") ? "Owner" : "Admin"}</small></span><span aria-hidden="true">⌄</span></div></div>
    <header className={styles.header}><div><p className={styles.kicker}>STUDIO DASHBOARD</p><h1>Good morning, {displayName}.</h1><p>Here’s what’s happening at your studio today.</p></div><div className={styles.headerActions}><time className={styles.date} dateTime={today}>⌑&nbsp; {displayDate(timezone)}&nbsp;⌄</time>{(incidentCount ?? 0) > 0 && <Link className={styles.reviewLink} href="/studio/incidents">Review incidents <Icon name="arrow"/></Link>}</div></header>
    <section className={styles.stats} aria-label="Today’s studio totals">
      <Stat icon="calendar" value={scheduleError ? "—" : slots.length} label="Classes today"/>
      <Stat icon="bookings" value={scheduleError ? "—" : slots.reduce((count, slot) => count + slot.booked, 0)} label="Bookings today"/>
      <Stat icon="members" value={activeMemberCount ?? "—"} label="Active members"/>
      <Stat icon="trainer" value={trainerCount ?? "—"} label="Trainers"/>
    </section>
    <section className={styles.primaryGrid}>
      <section className={`${styles.card} ${styles.schedule}`} aria-labelledby="today-schedule"><div className={styles.cardHeading}><div><p className={styles.kicker}>TODAY’S SCHEDULE</p><h2 id="today-schedule">Classes in motion.</h2></div><Link href="/studio/schedule">View all <Icon name="arrow"/></Link></div>{scheduleError ? <p className={styles.error}>Unable to load today’s schedule.</p> : slots.length ? <div className={styles.scheduleRows}>{slots.map((slot) => { const state = slotState(slot, new Date()); const remaining = Math.max(0, slot.capacity - slot.booked); return <article className={styles.scheduleRow} key={slot.id}><time>{displayTime(slot.start, timezone)}–{displayTime(slot.end, timezone)}</time><div><b>{slot.className}</b><span>{slot.trainerName}</span></div><div className={styles.capacity}><b>{slot.booked} / {slot.capacity}</b><span>{remaining ? `${remaining} left` : "Full"}</span></div><em data-state={state.toLowerCase()}>{state}</em></article>; })}</div> : <p className={styles.empty}>No classes scheduled today.</p>}</section>
      <section className={styles.sideStack}>
        <section className={styles.card} aria-labelledby="class-bookings"><div className={styles.cardHeading}><div><p className={styles.kicker}>CLASS BOOKINGS</p><h2 id="class-bookings">This week.</h2></div></div>{weekSlotDocs === null ? <p className={styles.error}>Unable to load booking activity.</p> : <><div className={styles.barChart} role="img" aria-label={`Current confirmed bookings this week: ${weeklyChart.map((day) => `${day.label} ${day.value}`).join(", ")}`}>{weeklyChart.map((day) => <div key={day.date}><span style={{ height: `${Math.max(5, Math.round((day.value / Math.max(1, ...weeklyChart.map((item) => item.value))) * 100))}%` }} title={`${day.label}: ${day.value} current confirmed bookings`} /><small>{day.label}</small></div>)}</div><p className={styles.chartNote}>Current confirmed bookings by day.</p></>}</section>
        <section className={styles.card} aria-labelledby="membership-overview"><div className={styles.cardHeading}><div><p className={styles.kicker}>MEMBERSHIP OVERVIEW</p><h2 id="membership-overview">Current status.</h2></div></div><div className={styles.membershipLayout}>{membershipTotal ? <div className={styles.donut} role="img" aria-label={`${activeSubscriptionCount ?? 0} active, ${pausedSubscriptionCount ?? 0} paused, ${expiredSubscriptionCount ?? 0} expired, and ${cancelledSubscriptionCount ?? 0} cancelled subscriptions`} style={{ "--active-share": `${((activeSubscriptionCount ?? 0) / membershipTotal) * 100}%` } as React.CSSProperties}><span><b>{activeSubscriptionCount ?? 0}</b><small>Active</small></span></div> : <div className={styles.donut}><span><b>—</b><small>Active</small></span></div>}<dl className={styles.breakdown}><div><dt><i className={styles.activeDot}/>Active</dt><dd>{activeSubscriptionCount ?? "—"}</dd></div><div><dt><i className={styles.pausedDot}/>Paused</dt><dd>{pausedSubscriptionCount ?? "—"}</dd></div><div><dt><i className={styles.expiredDot}/>Expired</dt><dd>{expiredSubscriptionCount ?? "—"}</dd></div><div><dt><i className={styles.cancelledDot}/>Cancelled</dt><dd>{cancelledSubscriptionCount ?? "—"}</dd></div></dl></div></section>
        <section className={styles.card} aria-labelledby="attendance-summary"><div className={styles.cardHeading}><div><p className={styles.kicker}>ATTENDANCE</p><h2 id="attendance-summary">Today’s marking.</h2></div><Link href="/studio/schedule">View attendance <Icon name="arrow"/></Link></div>{scheduleError ? <p className={styles.error}>Unable to load attendance.</p> : <><div className={styles.membership}><strong>{totalAttendance ? `${Math.round(((attendance.attended + attendance.noShow) / totalAttendance) * 100)}%` : "—"}</strong><span>{totalAttendance ? "Marked" : "No attendance due"}</span></div><dl className={styles.breakdown}><div><dt><i className={styles.activeDot}/>Present</dt><dd>{attendance.attended}</dd></div><div><dt><i className={styles.cancelledDot}/>No-show</dt><dd>{attendance.noShow}</dd></div><div><dt><i className={styles.pausedDot}/>Pending</dt><dd>{attendance.pending}</dd></div></dl></>}</section>
      </section>
    </section>
    <section className={styles.operations}>
      <section className={`${styles.card} ${styles.operationCard}`} aria-labelledby="waitlist-alerts"><div className={styles.operationHeading}><h2 id="waitlist-alerts">Waitlist alerts</h2><Link className={styles.cardView} href="/studio/waitlist">View all →</Link></div><div className={styles.operationBody}><span className={styles.operationIcon}><Icon name="waitlist"/></span>{waitlistDocs === null ? <p className={styles.error}>Unable to load waitlists.</p> : waitlists.length ? <ul className={styles.alertList}>{waitlists.slice(0, 2).map((item) => <li key={item.id}><span><b>{item.className} · {item.startTime}</b><small>{item.count} waiting</small></span></li>)}</ul> : <div><b>Seats in demand.</b><p>No active waitlists right now.</p></div>}</div></section>
      <section className={`${styles.card} ${styles.operationCard}`} aria-labelledby="pause-requests"><div className={styles.operationHeading}><h2 id="pause-requests">Pause requests</h2><Link className={styles.cardView} href="/studio/entitlements">View all →</Link></div><div className={styles.operationBody}><span className={styles.operationIcon}><Icon name="pause"/></span><div><b>Membership pauses.</b><p>No pending pause requests.</p></div></div></section>
    </section>
    <section className={`${styles.card} ${styles.activity}`} aria-labelledby="recent-activity"><div className={styles.cardHeading}><h2 id="recent-activity">Recent activity</h2><span className={styles.viewAll} aria-hidden="true">View all →</span></div>{auditDocs === null ? <p className={styles.error}>Unable to load recent activity.</p> : activities.length ? <div className={styles.activityTable}><div className={styles.activityHeader}><span>Time</span><span>Customer / user</span><span>Action</span><span>Details</span></div>{activities.slice(0, 5).map((activity) => <article key={activity.id}><time>{displayActivityTime(activity.createdAt, timezone)}</time><b>{activity.actor}</b><span>{activity.action}</span><small>{activity.detail}</small><i aria-hidden="true">›</i></article>)}</div> : <p className={styles.empty}>No recent activity.</p>}</section>
  </main>;
}

function Stat({ icon, value, label }: { icon: "calendar" | "bookings" | "members" | "trainer"; value: number | string; label: string }) { return <article className={`${styles.stat} ${styles[icon]}`}><span className={styles.statIcon}><Icon name={icon}/></span><strong>{value}</strong><span>{label}</span><Icon name="arrow"/></article>; }
