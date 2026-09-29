import { redirect } from "next/navigation";
import { connection } from "next/server";
import { IncidentManager } from "@/app/components/incident-manager";
import { requireWorkspace } from "@/lib/auth/server";
import { getIncidents } from "@/lib/incidents";

export default async function IncidentsPage() {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/"); }
  let data;
  try { data = await getIncidents(principal); } catch { redirect("/access-denied"); }
  return <IncidentManager {...data} owner={principal.roles.includes("owner")} />;
}
