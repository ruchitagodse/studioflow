"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/auth/server";
import { pauseSubscription } from "@/lib/entitlements";

export type CustomerSubscriptionActionState = { error?: string; success?: string };

function message(error: unknown) {
  const code = error instanceof Error ? error.message : "Unable to update your membership.";
  return ({
    PAUSE_NOT_ELIGIBLE: "This fixed-day plan is not eligible for pause.",
    PAUSE_ALLOWANCE_EXCEEDED: "That pause exceeds your remaining allowance.",
    SUBSCRIPTION_INACTIVE: "Only an active subscription can be paused.",
    FORBIDDEN_PAUSE: "You can only pause your own subscription.",
  } as Record<string, string>)[code] ?? code;
}

export async function requestOwnPauseAction(_: CustomerSubscriptionActionState, form: FormData): Promise<CustomerSubscriptionActionState> {
  try {
    const principal = await requireWorkspace("/customer");
    await pauseSubscription(principal, Object.fromEntries(form));
    revalidatePath("/customer");
    revalidatePath("/customer/entitlements");
    return { success: "Your subscription is paused. Existing bookings and credits are unchanged." };
  } catch (error) {
    return { error: message(error) };
  }
}
