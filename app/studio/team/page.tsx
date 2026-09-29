import { redirect } from "next/navigation";
import { connection } from "next/server";
import { TeamManager } from "@/app/components/team-manager";
import { requireWorkspace } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";

export default async function TeamPage() {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/"); }
  if (!principal.roles.includes("owner") || !principal.studioId) redirect("/access-denied");
  const db = getAdminDb(); const studioId = principal.studioId;
  const [memberDocs, invitationDocs] = await Promise.all([
    db.collection(`studios/${studioId}/members`).orderBy("updatedAt", "desc").limit(50).get(),
    db.collection(`studios/${studioId}/invitations`).orderBy("createdAt", "desc").limit(50).get(),
  ]);
  const members = memberDocs.docs.map((doc) => { const data = doc.data(); return { uid: doc.id, displayName: String(data.displayName ?? ""), email: String(data.email ?? ""), roles: (data.roles ?? []) as string[], status: data.status === "inactive" ? "inactive" as const : "active" as const }; });
  const invitations = invitationDocs.docs.map((doc) => { const data = doc.data(); return { id: doc.id, email: String(data.email), displayName: String(data.displayName ?? ""), roles: (data.roles ?? []) as string[], status: String(data.status), expiresAt: data.expiresAt?.toDate().toISOString() ?? new Date(0).toISOString() }; });
  return <TeamManager members={members} invitations={invitations} />;
}
