import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ScheduleManager } from "@/app/components/schedule-manager";
import { requireWorkspace } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";

export default async function ClassesPage() {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/"); }

  const db = getAdminDb();
  const studioId = principal.studioId!;
  const [studio, classDocs] = await Promise.all([
    db.doc(`studios/${studioId}`).get(),
    db.collection(`studios/${studioId}/classes`).orderBy("createdAt", "desc").get(),
  ]);
  const classes = classDocs.docs.map((doc) => ({
    id: doc.id,
    name: String(doc.data().name),
    description: String(doc.data().description ?? ""),
    durationMinutes: Number(doc.data().durationMinutes),
    status: String(doc.data().status),
  }));

  return <ScheduleManager mode="classes" timezone={String(studio.data()?.timezone)} classes={classes} trainers={[]} slots={[]} />;
}
