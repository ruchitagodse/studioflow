import { Timestamp } from "firebase-admin/firestore";
import { scheduleWindow } from "@/lib/schedule-window";
import { shiftCalendarDate } from "@/lib/customer-calendar";
import { studioLocalInstant } from "@/lib/schedule-time";
import { readPage } from "@/lib/firebase/pagination";
import { ListPagination } from "@/app/components/list-pagination";
import { readDocument, readQuery } from "@/lib/firebase/reads";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ScheduleManager } from "@/app/components/schedule-manager";
import { requireWorkspace } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ after?: string; date?: string; view?: string }> }) {
  await connection();
  const { after, date, view } = await searchParams;
  let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/"); }
  const db = getAdminDb(); const studioId = principal.studioId!;
  const studio = await readDocument(`studios/${studioId}`);
  const timezone = String(studio.data()?.timezone ?? "Asia/Kolkata");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const period = scheduleWindow(date, today, view);
  const [classDocs, trainerDocs, slotDocs] = await Promise.all([
    readQuery(db.collection(`studios/${studioId}/classes`).where("status", "==", "active").orderBy("createdAt", "desc")),
    readQuery(db.collection(`studios/${studioId}/members`).where("roles", "array-contains", "trainer").where("status", "==", "active")),
    readPage(db.collection(`studios/${studioId}/slots`).where("startsAt", ">=", Timestamp.fromDate(studioLocalInstant(period.start, "00:00", timezone))).where("startsAt", "<", Timestamp.fromDate(studioLocalInstant(period.end, "00:00", timezone))).orderBy("startsAt", "asc"), `studios/${studioId}/slots`, after, 40),
  ]);
  const classes = classDocs.docs.map((doc) => ({ id: doc.id, name: String(doc.data().name), description: String(doc.data().description ?? ""), durationMinutes: Number(doc.data().durationMinutes), status: String(doc.data().status) }));
  const trainerNames = new Map(trainerDocs.docs.map((doc) => [doc.id, String(doc.data().displayName ?? "").trim() || "Trainer"]));
  const missingNames = [...new Set(slotDocs.docs.map((doc) => String(doc.data().trainerUid ?? "")).filter((uid) => uid && !trainerNames.has(uid)))];
  await Promise.all(missingNames.map(async (uid) => {
    const member = await readDocument(`studios/${studioId}/members/${uid}`);
    trainerNames.set(uid, String(member.data()?.displayName ?? "").trim() || "Trainer");
  }));
  const trainers = trainerDocs.docs.filter((doc) => doc.data().status === "active").map((doc) => ({ uid: doc.id, name: trainerNames.get(doc.id) ?? "Trainer" }));
  const slots = slotDocs.docs.map((doc) => ({
    // This is a request-time server read used to prevent stale UI actions on elapsed slots.
    id: doc.id, className: String(doc.data().className), trainerUid: String(doc.data().trainerUid), trainerName: trainerNames.get(String(doc.data().trainerUid)) ?? "Trainer", localDate: String(doc.data().localDate), startTime: String(doc.data().startTime), endTime: String(doc.data().endTime), capacity: Number(doc.data().capacity), confirmedBookingCount: Number(doc.data().confirmedBookingCount ?? 0), status: String(doc.data().status), isPast: doc.data().startsAt.toDate().getTime() <= /* eslint-disable-line react-hooks/purity */ Date.now(),
  }));
  return <><p style={{ padding: "0 24px", fontSize: 12, color: "var(--color-text-muted)" }}>Classes from {period.start} through {shiftCalendarDate(period.end, -1)}. Showing up to 40 per page.</p><ScheduleManager timezone={timezone} classes={classes} trainers={trainers} slots={slots} calendarDate={period.date} calendarView={period.view} calendarToday={today} /><ListPagination pathname="/studio/schedule" after={after} nextCursor={slotDocs.nextCursor} params={{ date: period.date, view: period.view }} /></>;
}
