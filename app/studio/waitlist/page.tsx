import { readDocument, readQuery } from "@/lib/firebase/reads";
import Link from "next/link";
import { StudioAction } from "@/app/components/studio-icon";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { WaitlistManagement } from "@/app/components/waitlist-management";
import styles from "@/app/components/studio-waitlist.module.css";
import { requireWorkspace } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { promoteOneWaitlistEntry } from "@/lib/waitlist";

function displayDate(value: unknown, timeZone: string) {
  return value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function"
    ? value.toDate().toLocaleString("en-IN", { timeZone, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Just now";
}

function timestampDate(value: unknown) {
  return value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function" ? value.toDate() as Date : null;
}

export default async function StudioWaitlistPage() {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/access-denied"); }
  const db = getAdminDb();
  const studioId = principal.studioId!;
  const timezone = String((await readDocument(`studios/${studioId}`)).data()?.timezone ?? "Asia/Kolkata");
  const waitlists = db.collection(`studios/${studioId}/waitlists`);
  let activeEntries = await readQuery(waitlists.where("status", "==", "active").orderBy("createdAt", "asc").limit(100));
  let slots = await Promise.all(activeEntries.docs.map((entry) => readDocument(`studios/${studioId}/slots/${String(entry.data().slotId)}`)));
  const expiredSlotIds = [...new Set(slots.filter((slot) => {
    const startsAt = timestampDate(slot.data()?.startsAt);
    return startsAt && startsAt <= new Date();
  }).map((slot) => slot.id))];
  if (expiredSlotIds.length) {
    await Promise.all(expiredSlotIds.map((slotId) => promoteOneWaitlistEntry(studioId, slotId, principal.uid)));
    activeEntries = await readQuery(waitlists.where("status", "==", "active").orderBy("createdAt", "asc").limit(100));
    slots = await Promise.all(activeEntries.docs.map((entry) => readQuery(db.doc(`studios/${studioId}/slots/${String(entry.data().slotId)}`))));
  }
  const members = await Promise.all(activeEntries.docs.map((entry) => readDocument(`studios/${studioId}/members/${String(entry.data().customerUid)}`)));
  const positions = new Map<string, number>();
  const entries = activeEntries.docs.map((entry, index) => {
    const data = entry.data(); const slotId = String(data.slotId); const position = (positions.get(slotId) ?? 0) + 1;
    positions.set(slotId, position); const member = members[index]?.data(); const slot = slots[index]?.data();
    return { id: entry.id, slotId, customerUid: String(data.customerUid), customer: String(member?.displayName ?? member?.email ?? "Customer"), email: String(member?.email ?? ""), className: String(slot?.className ?? "Class"), localDate: String(slot?.localDate ?? "—"), startTime: String(slot?.startTime ?? "—"), joinedAt: displayDate(data.createdAt, timezone), position };
  });
  return <main className={styles.page}>
    <header className={styles.header}><h1><StudioAction icon="list">Waitlist</StudioAction></h1><Link prefetch={false} href="/studio/schedule"><StudioAction icon="calendar">Schedule</StudioAction></Link></header>
    <details className={styles.help}><summary><StudioAction icon="info">How the waitlist works</StudioAction></summary><p>Customers join when a class is full. The next eligible customer is booked automatically when a place opens. Staff can remove an entry with a reason.</p></details>
    <WaitlistManagement entries={entries} timezone={timezone} />
  </main>;
}
