import { readDocument, readQuery } from "@/lib/firebase/reads";
import { StudioAction } from "@/app/components/studio-icon";
import { StudioActivityFeed, type StudioActivityRow } from "@/app/components/studio-activity-feed";
import { studioActivityLabel, studioActivityCategory, studioActivityDetail, studioActivityDestination } from "@/lib/studio-activity";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";
import styles from "./page.module.css";

function asDate(value: unknown) {
  return value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function" ? value.toDate() as Date : null;
}

export default async function StudioActivityPage() {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/access-denied"); }
  if (!principal.studioId) redirect("/access-denied");
  const db = getAdminDb();
  const [studio, auditDocs] = await Promise.all([
    readDocument(`studios/${principal.studioId}`),
    readQuery(db.collection(`studios/${principal.studioId}/auditEvents`).orderBy("createdAt", "desc").limit(50)),
  ]);
  const actorIds = [...new Set(auditDocs.docs.map((doc) => String(doc.data().actorUid ?? "")).filter((uid) => uid && uid !== "system"))];
  const members = await Promise.all(actorIds.map((uid) => readDocument(`studios/${principal.studioId}/members/${uid}`)));
  const names = new Map(members.map((doc) => [doc.id, String(doc.data()?.displayName ?? "").trim() || "Studio member"]));
  const timezone = String(studio.data()?.timezone ?? "Asia/Kolkata");
  const rows: StudioActivityRow[] = auditDocs.docs.map((doc) => {
    const data = doc.data();
    const action = String(data.action ?? "Studio activity");
    const actorUid = String(data.actorUid ?? "");
    const createdAt = asDate(data.createdAt);
    return {
      id: doc.id, actor: actorUid === "system" ? "Studio Calendar" : names.get(actorUid) ?? "Studio member",
      action: studioActivityLabel(action), category: studioActivityCategory(action), detail: studioActivityDetail(data),
      timestamp: createdAt?.toISOString() ?? null,
      dateLabel: createdAt ? new Intl.DateTimeFormat("en-IN", { timeZone: timezone, dateStyle: "medium" }).format(createdAt) : "Date unavailable",
      timeLabel: createdAt ? new Intl.DateTimeFormat("en-IN", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(createdAt) : "Time unavailable",
      href: studioActivityDestination(action, String(data.targetId ?? ""), data),
    };
  });
  return <main className={styles.page}>
    <Link prefetch={false} className={styles.back} href="/studio"><StudioAction icon="back">Overview</StudioAction></Link>
    <header><h1><StudioAction icon="history">Studio activity</StudioAction></h1></header>
    <StudioActivityFeed rows={rows} timezone={timezone} />
  </main>;
}
