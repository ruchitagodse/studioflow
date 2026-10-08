import { redirect } from "next/navigation";
import { connection } from "next/server";
import { TrainerManager } from "@/app/components/trainer-manager";
import { requireWorkspace } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";

export default async function TrainerPage() {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/"); }
  if (!principal.roles.includes("owner") || !principal.studioId) redirect("/access-denied");
  const db = getAdminDb();
  const studioId = principal.studioId;
  const [memberDocs, invitationDocs, slotDocs] = await Promise.all([
    db.collection(`studios/${studioId}/members`).where("roles", "array-contains", "trainer").get(),
    db.collection(`studios/${studioId}/invitations`).orderBy("createdAt", "desc").limit(50).get(),
    db.collection(`studios/${studioId}/slots`).orderBy("startsAt", "asc").get(),
  ]);
  const members = memberDocs.docs.map((doc) => {
    const data = doc.data();
    const assignedClasses = [...new Set(slotDocs.docs.filter((slot) => String(slot.data().trainerUid ?? "") === doc.id && ["draft", "published"].includes(String(slot.data().status ?? ""))).map((slot) => String(slot.data().className ?? "Class")))];
    return { uid: doc.id, displayName: String(data.displayName ?? ""), email: String(data.email ?? ""), roles: (data.roles ?? []) as string[], status: data.status === "inactive" ? "inactive" as const : "active" as const, specialization: String(data.specialization ?? "").trim(), assignedClasses };
  });
  const invitations = invitationDocs.docs.filter((doc) => (doc.data().roles as string[] | undefined)?.includes("trainer")).map((doc) => { const data = doc.data(); return { id: doc.id, email: String(data.email ?? ""), displayName: String(data.displayName ?? ""), status: String(data.status ?? "pending"), expiresAt: data.expiresAt?.toDate().toISOString() ?? new Date(0).toISOString() }; });
  return <TrainerManager members={members} invitations={invitations} />;
}
