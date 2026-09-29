import { redirect } from "next/navigation";
import { connection } from "next/server";
import { WaitlistManagement } from "@/app/components/waitlist-management";
import internalStyles from "@/app/components/studio-internal.module.css";
import waitlistStyles from "@/app/components/waitlist-ui.module.css";
import Image from "next/image";
import studioImage from "@/app/assets/pilates-studio.png";
import { requireWorkspace } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";

function displayDate(value: unknown) { return value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function" ? value.toDate().toLocaleString() : "just now"; }
export default async function StudioWaitlistPage() {
  await connection(); let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/access-denied"); }
  const db = getAdminDb(); const studioId = principal.studioId!;
  const allRecentEntries = await db.collection(`studios/${studioId}/waitlists`).orderBy("createdAt", "asc").limit(100).get();
  const entries = { docs: allRecentEntries.docs.filter((entry) => entry.data().status === "active") };
  const members = await Promise.all(entries.docs.map((entry) => db.doc(`studios/${studioId}/members/${String(entry.data().customerUid)}`).get()));
  const slots = await Promise.all(entries.docs.map((entry) => db.doc(`studios/${studioId}/slots/${String(entry.data().slotId)}`).get()));
  const counts = new Map<string, number>();
  const rows = entries.docs.map((entry, index) => { const slotId = String(entry.data().slotId); const position = (counts.get(slotId) ?? 0) + 1; const slot = slots[index]?.data(); counts.set(slotId, position); return { id: entry.id, customer: String(members[index]?.data()?.email ?? "Customer"), className: String(slot?.className ?? "Class"), localDate: String(slot?.localDate ?? "—"), startTime: String(slot?.startTime ?? "—"), joinedAt: displayDate(entry.data().createdAt), position, status: "active" }; });
  return <main className={`${internalStyles.shell} ${waitlistStyles.waitlistUi}`}><header className={waitlistStyles.waitlistHeader}><div><p className={waitlistStyles.kicker}>WAITLIST</p><h1>Automatic FIFO queue.</h1><p>Entries are promoted only when a seat opens and all eligibility checks still pass.</p></div><div className={waitlistStyles.headerVisual}><a className={internalStyles.back} href="/studio">← Studio dashboard</a><div><Image src={studioImage} alt="Pilates studio" fill sizes="260px" priority /></div></div></header><div className={waitlistStyles.infoGrid}><section className={waitlistStyles.addPanel}><p>ADD TO WAITLIST</p><h2>Add a new entry</h2><span>Waitlist entries are created through the customer booking flow when a class is full.</span><fieldset disabled aria-describedby="waitlist-flow-note"><label>Client<select defaultValue=""><option value="">Select a client</option></select></label><div><label>Class<select defaultValue=""><option value="">Select a class</option></select></label><label>Date<input type="text" placeholder="mm/dd/yyyy" /></label></div><div><label>Time<select defaultValue=""><option value="">Select time</option></select></label><label>Notes (optional)<input type="text" placeholder="Add a note…" /></label></div><button type="button">Add to waitlist</button></fieldset><small id="waitlist-flow-note">To protect the existing booking flow, this entry is created when a customer joins a full class.</small></section><section><p>HOW IT WORKS</p><h2>First in, first out.</h2><span>Clients are promoted automatically when a seat becomes available and they still meet all eligibility checks.</span><ol><li>Clients join a class waitlist.</li><li>Entries are ordered by when they joined.</li><li>The next eligible client is promoted.</li></ol></section></div><WaitlistManagement entries={rows}/></main>;
}
