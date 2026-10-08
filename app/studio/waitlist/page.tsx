import { redirect } from "next/navigation";
import { connection } from "next/server";
import { WaitlistManagement } from "@/app/components/waitlist-management";
import styles from "@/app/components/waitlist-ui.module.css";
import { requireWorkspace } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { promoteOneWaitlistEntry } from "@/lib/waitlist";

function displayDate(value: unknown) {
  return value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function"
    ? value.toDate().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
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
  const waitlists = db.collection(`studios/${studioId}/waitlists`);
  let activeEntries = await waitlists.where("status", "==", "active").orderBy("createdAt", "asc").limit(100).get();
  let slots = await Promise.all(activeEntries.docs.map((entry) => db.doc(`studios/${studioId}/slots/${String(entry.data().slotId)}`).get()));
  const expiredSlotIds = [...new Set(slots.filter((slot) => {
    const startsAt = timestampDate(slot.data()?.startsAt);
    return startsAt && startsAt <= new Date();
  }).map((slot) => slot.id))];
  if (expiredSlotIds.length) {
    await Promise.all(expiredSlotIds.map((slotId) => promoteOneWaitlistEntry(studioId, slotId, principal.uid)));
    activeEntries = await waitlists.where("status", "==", "active").orderBy("createdAt", "asc").limit(100).get();
    slots = await Promise.all(activeEntries.docs.map((entry) => db.doc(`studios/${studioId}/slots/${String(entry.data().slotId)}`).get()));
  }
  const members = await Promise.all(activeEntries.docs.map((entry) => db.doc(`studios/${studioId}/members/${String(entry.data().customerUid)}`).get()));
  const positions = new Map<string, number>();
  const entries = activeEntries.docs.map((entry, index) => {
    const data = entry.data(); const slotId = String(data.slotId); const position = (positions.get(slotId) ?? 0) + 1;
    positions.set(slotId, position); const member = members[index]?.data(); const slot = slots[index]?.data();
    return { id: entry.id, customer: String(member?.displayName ?? member?.email ?? "Customer"), email: String(member?.email ?? ""), className: String(slot?.className ?? "Class"), localDate: String(slot?.localDate ?? "—"), startTime: String(slot?.startTime ?? "—"), joinedAt: displayDate(data.createdAt), position };
  });
  return <main className={styles.page}><section className={styles.topGrid}>
    <section className={styles.panel} aria-labelledby="add-waitlist-entry"><p className={styles.kicker}>ADD TO WAITLIST</p><h1 id="add-waitlist-entry">Add a new entry</h1><p className={styles.description}>Waitlist entries are created through the customer booking flow when a class is full.</p><fieldset className={styles.addForm} disabled aria-describedby="waitlist-flow-note"><label>Client<select defaultValue=""><option value="">Select a client</option></select></label><div className={styles.twoFields}><label>Class<select defaultValue=""><option value="">Select a class</option></select></label><label>Date<input type="text" placeholder="mm/dd/yyyy" /></label></div><div className={styles.twoFields}><label>Time<select defaultValue=""><option value="">Select time</option></select></label><label>Notes (optional)<input type="text" placeholder="Add a note…" /></label></div><button type="button">Add to waitlist</button></fieldset><p className={styles.note} id="waitlist-flow-note">To protect the booking flow, customers join a waitlist only for a full class.</p></section>
    <section className={styles.panel} aria-labelledby="waitlist-explainer"><p className={styles.kicker}>HOW IT WORKS</p><h2 id="waitlist-explainer">First in, first out.</h2><p className={styles.description}>Clients are promoted automatically when a seat becomes available and they still meet all eligibility checks.</p><ol className={styles.steps}><li>Clients join a class waitlist.</li><li>Entries are ordered by when they joined.</li><li>The next eligible client is promoted.</li></ol></section>
  </section><WaitlistManagement entries={entries} /></main>;
}
