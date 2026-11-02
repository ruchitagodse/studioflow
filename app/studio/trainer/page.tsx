import { readQuery } from "@/lib/firebase/reads";
import { readPage } from "@/lib/firebase/pagination";
import { Timestamp } from "firebase-admin/firestore";
import { ListPagination } from "@/app/components/list-pagination";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { TrainerManager } from "@/app/components/trainer-manager";
import { requireWorkspace } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";

export default async function TrainerPage({ searchParams }: { searchParams: Promise<{ after?: string; slotsAfter?: string }> }) {
  await connection();
  const { after, slotsAfter } = await searchParams;
  let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/"); }
  if (!principal.roles.includes("owner") || !principal.studioId) redirect("/access-denied");
  const db = getAdminDb();
  const studioId = principal.studioId;
  const [memberDocs, invitationDocs] = await Promise.all([
    readPage(db.collection(`studios/${studioId}/members`).where("roles", "array-contains", "trainer"), `studios/${studioId}/members`, after),
    readQuery(db.collection(`studios/${studioId}/invitations`).orderBy("createdAt", "desc").limit(50)),
  ]);
  const slotDocs = memberDocs.docs.length ? await readPage(db.collection(`studios/${studioId}/slots`).where("trainerUid", "in", memberDocs.docs.map((doc) => doc.id)).where("startsAt", ">", Timestamp.now()).orderBy("startsAt", "asc").select("className", "trainerUid", "status", "startsAt"), `studios/${studioId}/slots`, slotsAfter, 100) : { docs: [], nextCursor: null };
  const members = memberDocs.docs.map((doc) => {
    const data = doc.data();
    const assignedClasses = [...new Set(slotDocs.docs.filter((slot) => String(slot.data().trainerUid ?? "") === doc.id && ["draft", "published"].includes(String(slot.data().status ?? ""))).map((slot) => String(slot.data().className ?? "Class")))];
    return { uid: doc.id, displayName: String(data.displayName ?? ""), email: String(data.email ?? ""), roles: (data.roles ?? []) as string[], status: data.status === "inactive" ? "inactive" as const : "active" as const, specialization: String(data.specialization ?? "").trim(), assignedClasses };
  });
  const invitations = invitationDocs.docs.filter((doc) => (doc.data().roles as string[] | undefined)?.includes("trainer")).map((doc) => { const data = doc.data(); return { id: doc.id, email: String(data.email ?? ""), displayName: String(data.displayName ?? ""), status: String(data.status ?? "pending"), expiresAt: data.expiresAt?.toDate().toISOString() ?? new Date(0).toISOString() }; });
  return <><TrainerManager members={members} invitations={invitations} />
    <p style={{ padding: "0 24px", fontSize: 12, color: "var(--color-text-muted)" }}>Assigned classes reflect the upcoming assignments on this page.</p>
    <ListPagination pathname="/studio/trainer" after={after} nextCursor={memberDocs.nextCursor} />
    {(slotDocs.nextCursor || slotsAfter) && <section aria-label="Upcoming assignment pages"><ListPagination pathname="/studio/trainer" after={slotsAfter} nextCursor={slotDocs.nextCursor} cursorKey="slotsAfter" params={after ? { after } : {}} /></section>}
  </>;
}
