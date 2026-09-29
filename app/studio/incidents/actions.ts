"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/auth/server";
import { acknowledgeIncidentReview, reverseIncident, saveIncidentPolicy, waiveIncident } from "@/lib/incidents";

export type IncidentActionState = { error?: string; success?: string };
function message(error: unknown) {
  const code = error instanceof Error ? error.message : "We could not update Incident policy.";
  return ({ FORBIDDEN_INCIDENT_POLICY: "Only the studio owner can change Incident policy.", FORBIDDEN_INCIDENT_ACCESS: "You do not have access to Incident records.", INACTIVE_STUDIO: "This studio is inactive.", MEMBERSHIP_INACTIVE: "Your membership is inactive.", INCIDENT_NOT_FOUND: "That Incident is unavailable.", INCIDENT_NOT_ACTIVE: "Only an active Incident can be changed.", INCIDENT_NOT_REVERSIBLE: "Only a no-show Incident can be factually reversed.", INCIDENT_SOURCE_NOT_CORRECTED: "Correct the attendance outcome to attended before reversing this Incident.", INCIDENT_OPERATION_CONFLICT: "This operation ID was already used for a different change." } as Record<string, string>)[code] ?? code;
}
function refresh() { revalidatePath("/studio/incidents"); revalidatePath("/studio"); }
export async function saveIncidentPolicyAction(_: IncidentActionState, form: FormData): Promise<IncidentActionState> {
  try { await saveIncidentPolicy(await requireWorkspace("/studio"), Object.fromEntries(form)); refresh(); return { success: "Incident policy saved." }; } catch (error) { return { error: message(error) }; }
}
export async function waiveIncidentAction(_: IncidentActionState, form: FormData): Promise<IncidentActionState> {
  try { await waiveIncident(await requireWorkspace("/studio"), Object.fromEntries(form)); refresh(); return { success: "Incident waived. Its factual history remains, but it no longer counts toward review." }; } catch (error) { return { error: message(error) }; }
}
export async function reverseIncidentAction(_: IncidentActionState, form: FormData): Promise<IncidentActionState> {
  try { await reverseIncident(await requireWorkspace("/studio"), Object.fromEntries(form)); refresh(); return { success: "Incident factually reversed. No credits changed." }; } catch (error) { return { error: message(error) }; }
}
export async function acknowledgeIncidentReviewAction(_: IncidentActionState, form: FormData): Promise<IncidentActionState> {
  try { await acknowledgeIncidentReview(await requireWorkspace("/studio"), Object.fromEntries(form)); refresh(); return { success: "Incident review acknowledged." }; } catch (error) { return { error: message(error) }; }
}
