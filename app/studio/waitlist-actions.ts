"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/auth/server";
import { removeWaitlistEntry } from "@/lib/waitlist";

export type WaitlistManagementState = { error?: string; success?: string };

export async function removeWaitlistEntryAction(_: WaitlistManagementState, form: FormData): Promise<WaitlistManagementState> {
  try { await removeWaitlistEntry(await requireWorkspace("/studio"), Object.fromEntries(form)); revalidatePath("/studio/waitlist"); return { success: "Entry removed from the waitlist." }; }
  catch (error) { const code = error instanceof Error ? error.message : "Unable to update the waitlist."; return { error: ({ FORBIDDEN_WAITLIST: "You do not have permission to manage this waitlist.", WAITLIST_NOT_FOUND: "This waitlist entry no longer exists." } as Record<string, string>)[code] ?? code }; }
}
