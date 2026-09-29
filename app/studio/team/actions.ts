"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentPrincipal, requireWorkspace } from "@/lib/auth/server";
import { acceptTeamInvitation, changeTeamMemberPassword, createTeamInvitation, revokeTeamInvitation, updateTeamMembership } from "@/lib/team";

export type TeamActionState = { error?: string; success?: string; invitationPath?: string; existingAccount?: boolean };

function message(error: unknown) {
  const code = error instanceof Error ? error.message : "Unable to save this team change.";
  return ({
    FORBIDDEN_TEAM: "Only the studio owner can manage the team.",
    INACTIVE_STUDIO: "This studio is inactive and cannot be managed.",
    ACTIVE_MEMBERSHIP_IN_ANOTHER_STUDIO: "This person already has active access to another studio.",
    MEMBERSHIP_ALREADY_ACTIVE: "This person already has an active membership in this studio.",
    DUPLICATE_ACTIVE_INVITATION: "There is already a pending invitation for this email.",
    INVITATION_OPERATION_CONFLICT: "This invitation was already created. Use the original link, or revoke it and create a new invitation.",
    MEMBERSHIP_NOT_FOUND: "That membership is no longer available.",
    TARGET_ACCOUNT_INACTIVE: "This Firebase account is inactive and cannot receive studio access.",
    OWNER_MEMBERSHIP_PROTECTED: "Owner memberships are managed through the platform provisioning authority.",
    INVITATION_NOT_FOUND: "That invitation is no longer available.",
    INVITATION_NOT_PENDING: "Only a pending invitation can be revoked.",
    AUTH_ACCOUNT_NOT_FOUND: "This member does not have a Firebase account to update.",
  } as Record<string, string>)[code] ?? code;
}

export async function revokeInvitationAction(_: TeamActionState, form: FormData): Promise<TeamActionState> {
  try { const principal = await requireWorkspace("/studio"); await revokeTeamInvitation(principal, String(form.get("invitationId") ?? "")); revalidatePath("/studio/team"); return { success: "Invitation revoked." }; } catch (error) { return { error: message(error) }; }
}

export async function createInvitationAction(_: TeamActionState, form: FormData): Promise<TeamActionState> {
  try {
    const principal = await requireWorkspace("/studio");
    const result = await createTeamInvitation(principal, { email: form.get("email"), displayName: form.get("displayName"), roles: form.getAll("roles"), operationId: form.get("operationId") });
    const requestHeaders = await headers();
    const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;
    const origin = configuredOrigin || `${requestHeaders.get("x-forwarded-proto") ?? "http"}://${requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host")}`;
    const invitationPath = new URL(`/invite/${result.invitationId}?token=${encodeURIComponent(result.secret)}`, origin).toString();
    revalidatePath("/studio/team");
    return { success: "Invitation created. Copy the link and send it to the member.", invitationPath, existingAccount: result.existingAccount };
  } catch (error) { return { error: message(error) }; }
}

export async function updateMembershipAction(_: TeamActionState, form: FormData): Promise<TeamActionState> {
  try {
    const principal = await requireWorkspace("/studio");
    await updateTeamMembership(principal, { uid: form.get("uid"), action: form.get("action"), displayName: form.get("displayName"), roles: form.getAll("roles"), reason: form.get("reason") });
    revalidatePath("/studio/team");
    revalidatePath("/studio/schedule");
    return { success: "Membership updated." };
  } catch (error) { return { error: message(error) }; }
}

export async function changeMemberPasswordAction(_: TeamActionState, form: FormData): Promise<TeamActionState> {
  try {
    const principal = await requireWorkspace("/studio");
    await changeTeamMemberPassword(principal, { uid: form.get("uid"), newPassword: form.get("newPassword"), confirmPassword: form.get("confirmPassword") });
    revalidatePath("/studio/team");
    return { success: "Password changed. The member will need to sign in again." };
  } catch (error) { return { error: message(error) }; }
}

export async function acceptInvitationAction(_: TeamActionState, form: FormData): Promise<TeamActionState> {
  try {
    const principal = await getCurrentPrincipal();
    if (!principal?.email) throw new Error("NO_ACTIVE_SESSION");
    await acceptTeamInvitation({ uid: principal.uid, email: principal.email }, String(form.get("invitationId") ?? ""), String(form.get("token") ?? ""));
    revalidatePath("/entry");
    return { success: "Invitation accepted. Your studio access is ready." };
  } catch (error) { return { error: message(error) }; }
}
