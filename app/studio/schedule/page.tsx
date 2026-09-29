import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ScheduleManager } from "@/app/components/schedule-manager";
import { requireWorkspace } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";

export default async function SchedulePage() {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/"); }
  const db = getAdminDb(); const studioId = principal.studioId!;
  const [studio, classDocs, trainerDocs, slotDocs] = await Promise.all([
    db.doc(`studios/${studioId}`).get(),
    db.collection(`studios/${studioId}/classes`).orderBy("createdAt", "desc").get(),
    db.collection(`studios/${studioId}/members`).where("roles", "array-contains", "trainer").get(),
    db.collection(`studios/${studioId}/slots`).orderBy("startsAt", "asc").get(),
  ]);
  const classes = classDocs.docs.map((doc) => ({ id: doc.id, name: String(doc.data().name), description: String(doc.data().description ?? ""), durationMinutes: Number(doc.data().durationMinutes), status: String(doc.data().status) }));
  const trainerNames = new Map(trainerDocs.docs.map((doc) => [doc.id, String(doc.data().displayName ?? "").trim() || "Trainer"]));
  const trainers = trainerDocs.docs.filter((doc) => doc.data().status === "active").map((doc) => ({ uid: doc.id, name: trainerNames.get(doc.id) ?? "Trainer" }));
  const slots = slotDocs.docs.map((doc) => ({
    id: doc.id, className: String(doc.data().className), trainerUid: String(doc.data().trainerUid), trainerName: trainerNames.get(String(doc.data().trainerUid)) ?? "Trainer", localDate: String(doc.data().localDate), startTime: String(doc.data().startTime), endTime: String(doc.data().endTime), capacity: Number(doc.data().capacity), confirmedBookingCount: Number(doc.data().confirmedBookingCount ?? 0), status: String(doc.data().status), isPast: String(doc.data().status) === "completed",
  }));
  return <><ScheduleManager timezone={String(studio.data()?.timezone)} classes={classes} trainers={trainers} slots={slots} /><p style={{ margin: "0 auto 3rem", maxWidth: "1080px" }}><a href="/studio/waitlist">Manage active waitlists</a></p></>;
}
