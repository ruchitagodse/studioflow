import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";
import styles from "./page.module.css";

type AuditRow = { id: string; actor: string; action: string; detail: string; createdAt: Date | null; href: string };

function asDate(value: unknown) {
  return value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function" ? value.toDate() as Date : null;
}

function displayTime(value: Date | null, timezone: string) {
  return value ? new Intl.DateTimeFormat("en-IN", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(value) : "Recently";
}

function label(action: string) {
  const labels: Record<string, string> = { "booking.created": "Booked a class", "booking.cancelled": "Cancelled booking", "attendance.marked": "Marked attendance", "subscription.pause_started": "Paused membership", "subscription.resumed": "Resumed membership", "subscription.created": "Created membership", "subscription.renewed": "Renewed membership", "incident.waived": "Waived incident", "waitlist.removed": "Updated waitlist" };
  return labels[action] ?? action.replaceAll(".", " ");
}

function detail(data: Record<string, unknown>) {
  const after = data.after && typeof data.after === "object" ? data.after as Record<string, unknown> : {};
  const outcome = typeof after.outcome === "string" ? after.outcome : null;
  const reason = typeof data.reason === "string" ? data.reason : null;
  return outcome ? `Recorded as ${outcome.replace("-", " ")}` : reason || "Studio activity";
}

function destination(action: string, targetId: string, data: Record<string, unknown>) {
  const after = data.after && typeof data.after === "object" ? data.after as Record<string, unknown> : {};
  const slotId = typeof after.slotId === "string" ? after.slotId : null;
  if (action.startsWith("attendance.") && slotId) return `/studio/attendance/${encodeURIComponent(slotId)}`;
  if (action.startsWith("booking.") || action.startsWith("slot.") || action.startsWith("class.")) return "/studio/schedule";
  if (action.startsWith("subscription.") || action.startsWith("credit.")) return targetId ? `/studio/subscriptions?subscription=${encodeURIComponent(targetId)}` : "/studio/subscriptions";
  if (action.startsWith("incident.")) return "/studio/incidents";
  if (action.startsWith("waitlist.")) return "/studio/waitlist";
  if (action.startsWith("membership.")) return "/studio/customers";
  return "/studio";
}

export default async function StudioActivityPage() {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/access-denied"); }
  if (!principal.studioId) redirect("/access-denied");

  const db = getAdminDb();
  const [studio, auditDocs] = await Promise.all([
    db.doc(`studios/${principal.studioId}`).get(),
    db.collection(`studios/${principal.studioId}/auditEvents`).orderBy("createdAt", "desc").limit(50).get(),
  ]);
  const actorIds = [...new Set(auditDocs.docs.map((doc) => String(doc.data().actorUid ?? "")).filter((uid) => uid && uid !== "system"))];
  const members = await Promise.all(actorIds.map((uid) => db.doc(`studios/${principal.studioId}/members/${uid}`).get()));
  const names = new Map(members.map((doc) => [doc.id, String(doc.data()?.displayName ?? "").trim() || "Studio member"]));
  const rows: AuditRow[] = auditDocs.docs.map((doc) => {
    const data = doc.data();
    const action = String(data.action ?? "Studio activity");
    const actorUid = String(data.actorUid ?? "");
    return { id: doc.id, actor: actorUid === "system" ? "StudioFlow" : names.get(actorUid) ?? "Studio member", action: label(action), detail: detail(data), createdAt: asDate(data.createdAt), href: destination(action, String(data.targetId ?? ""), data) };
  });
  const timezone = String(studio.data()?.timezone ?? "Asia/Kolkata");

  return <main className={styles.page}>
    <Link className={styles.back} href="/studio">← Studio dashboard</Link>
    <header><p>STUDIO ACTIVITY</p><h1>Recent operational history</h1><span>Showing the latest {rows.length} recorded events for this studio.</span></header>
    {rows.length ? <section className={styles.table} aria-label="Recent studio activity"><div className={styles.heading}><span>Time</span><span>Customer / user</span><span>Action</span><span>Details</span></div>{rows.map((row) => <Link key={row.id} href={row.href} className={styles.row} aria-label={`View related record for ${row.action}`}><time>{displayTime(row.createdAt, timezone)}</time><b>{row.actor}</b><span>{row.action}</span><small>{row.detail}</small><i aria-hidden="true">›</i></Link>)}</section> : <p className={styles.empty}>No studio activity has been recorded yet.</p>}
  </main>;
}
