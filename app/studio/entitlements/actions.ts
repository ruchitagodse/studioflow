"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireWorkspace } from "@/lib/auth/server";
import { adjustCredits, assignSubscription, cancelSubscription, createPlan, pauseSubscription, renewSubscription, retirePlan, updatePlan } from "@/lib/entitlements";

export type EntitlementActionState = { error?: string; success?: string };

function message(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Check the plan details and try again.";
  }
  const code = error instanceof Error ? error.message : "Unable to save this entitlement change.";
  return ({
    FORBIDDEN_ENTITLEMENTS: "You do not have permission to manage plans or credits.",
    INACTIVE_STUDIO: "This studio is inactive and cannot be changed.",
    PLAN_NOT_FOUND: "That plan is no longer available.",
    PLAN_RETIRED: "Retired plans are historical and cannot be edited.",
    PLAN_UNAVAILABLE: "Choose an active plan for this assignment.",
    CUSTOMER_NOT_ELIGIBLE: "Choose an active customer from this studio.",
    ACTIVE_SUBSCRIPTION_EXISTS: "This customer already has an active subscription. Cancel it or wait for it to expire before assigning another plan.",
    SUBSCRIPTION_NOT_FOUND: "That subscription is no longer available.",
    SUBSCRIPTION_INACTIVE: "This subscription is no longer active.",
    PLAN_DURATION_INVALID: "Choose either fixed-day validity or calendar-month duration.",
    PAUSE_NOT_ELIGIBLE: "Only subscriptions assigned from a month-based plan can be paused.",
    PAUSE_ALLOWANCE_EXCEEDED: "This pause would exceed the subscription’s remaining pause allowance.",
    FORBIDDEN_PAUSE: "You do not have permission to pause this subscription.",
    NEGATIVE_CREDIT_BALANCE: "This adjustment would reduce the usable balance below zero.",
  } as Record<string, string>)[code] ?? code;
}

function refresh() {
  revalidatePath("/studio/entitlements");
  revalidatePath("/studio/plans");
  revalidatePath("/studio/subscriptions");
  revalidatePath("/studio/credits");
  revalidatePath("/studio/pause-requests");
  revalidatePath("/customer/entitlements");
}

export async function createPlanAction(_: EntitlementActionState, form: FormData): Promise<EntitlementActionState> {
  try { const principal = await requireWorkspace("/studio"); await createPlan(principal, Object.fromEntries(form)); refresh(); return { success: "Plan created." }; } catch (error) { return { error: message(error) }; }
}

export async function updatePlanAction(_: EntitlementActionState, form: FormData): Promise<EntitlementActionState> {
  try { const principal = await requireWorkspace("/studio"); await updatePlan(principal, Object.fromEntries(form)); refresh(); return { success: "Plan saved. Existing subscriptions keep their original terms." }; } catch (error) { return { error: message(error) }; }
}

export async function retirePlanAction(_: EntitlementActionState, form: FormData): Promise<EntitlementActionState> {
  try { const principal = await requireWorkspace("/studio"); await retirePlan(principal, String(form.get("planId") ?? "")); refresh(); return { success: "Plan retired. Existing subscriptions remain unchanged." }; } catch (error) { return { error: message(error) }; }
}

export async function assignSubscriptionAction(_: EntitlementActionState, form: FormData): Promise<EntitlementActionState> {
  try { const principal = await requireWorkspace("/studio"); await assignSubscription(principal, Object.fromEntries(form)); refresh(); return { success: "Subscription assigned and credits allocated." }; } catch (error) { return { error: message(error) }; }
}

export async function cancelSubscriptionAction(_: EntitlementActionState, form: FormData): Promise<EntitlementActionState> {
  try { const principal = await requireWorkspace("/studio"); const mode = String(form.get("mode") ?? ""); await cancelSubscription(principal, Object.fromEntries(form)); refresh(); return { success: mode === "immediate" ? "Subscription cancelled. Future bookings were reconciled and credits retained as expired history." : "Cancellation is set for the end of the term. Existing bookings remain unchanged." }; } catch (error) { return { error: message(error) }; }
}

export async function renewSubscriptionAction(_: EntitlementActionState, form: FormData): Promise<EntitlementActionState> {
  try { const principal = await requireWorkspace("/studio"); await renewSubscription(principal, Object.fromEntries(form)); refresh(); return { success: "Renewal created a new subscription and credit allocation." }; } catch (error) { return { error: message(error) }; }
}

export async function pauseSubscriptionAction(_: EntitlementActionState, form: FormData): Promise<EntitlementActionState> {
  try { const principal = await requireWorkspace("/studio"); await pauseSubscription(principal, Object.fromEntries(form)); refresh(); return { success: "Subscription paused. Credits and existing bookings remain unchanged." }; } catch (error) { return { error: message(error) }; }
}

export async function adjustCreditsAction(_: EntitlementActionState, form: FormData): Promise<EntitlementActionState> {
  try { const principal = await requireWorkspace("/studio"); await adjustCredits(principal, Object.fromEntries(form)); refresh(); return { success: "Credit adjustment recorded." }; } catch (error) { return { error: message(error) }; }
}
