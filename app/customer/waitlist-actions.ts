"use server";
import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/auth/server";
import { joinWaitlist, withdrawWaitlist } from "@/lib/waitlist";
export type WaitlistActionState = { error?: string; success?: string };
function text(error: unknown) { const code = error instanceof Error ? error.message : "Unable to update waitlist."; return ({ WAITLIST_INELIGIBLE: "This class is not currently eligible for waitlist.", WAITLIST_CLOSED: "This waitlist is closed.", WAITLIST_NOT_FOUND: "This waitlist entry is unavailable.", FORBIDDEN_CUSTOMER: "You do not have customer waitlist access." } as Record<string,string>)[code] ?? code; }
export async function joinWaitlistAction(_: WaitlistActionState, form: FormData): Promise<WaitlistActionState> { try { const result = await joinWaitlist(await requireWorkspace("/customer"), Object.fromEntries(form)); revalidatePath("/customer"); revalidatePath(`/customer/slots/${String(form.get("slotId"))}`); return { success: result.idempotent ? "You are already on this waitlist." : "You joined the waitlist. No credit was reserved." }; } catch (e) { return { error: text(e) }; } }
export async function withdrawWaitlistAction(_: WaitlistActionState, form: FormData): Promise<WaitlistActionState> { try { await withdrawWaitlist(await requireWorkspace("/customer"), Object.fromEntries(form)); revalidatePath("/customer"); revalidatePath(`/customer/slots/${String(form.get("slotId"))}`); return { success: "You left the waitlist." }; } catch (e) { return { error: text(e) }; } }
