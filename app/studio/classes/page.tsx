import { readPage } from "@/lib/firebase/pagination";
import { ListPagination } from "@/app/components/list-pagination";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { StudioClassLibrary } from "@/app/components/studio-class-library";
import { requireWorkspace } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";

export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ after?: string }> }) {
  await connection();
  const { after } = await searchParams;
  let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/"); }

  const db = getAdminDb();
  const studioId = principal.studioId!;
  const classDocs = await readPage(db.collection(`studios/${studioId}/classes`).orderBy("createdAt", "desc"), `studios/${studioId}/classes`, after);
  const classes = classDocs.docs.map((doc) => ({
    id: doc.id,
    name: String(doc.data().name),
    description: String(doc.data().description ?? ""),
    durationMinutes: Number(doc.data().durationMinutes),
    status: String(doc.data().status),
  }));

  return <><StudioClassLibrary classes={classes} /><ListPagination pathname="/studio/classes" after={after} nextCursor={classDocs.nextCursor} /></>;
}

