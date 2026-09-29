import { createHash, randomBytes } from "node:crypto";

export const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1000;
export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export function createInvitationSecret() { return randomBytes(32).toString("base64url"); }
export function hashInvitationSecret(secret: string) { return createHash("sha256").update(secret).digest("hex"); }
export function invitationTokenMatches(secret: string, tokenHash: string) { return hashInvitationSecret(secret) === tokenHash; }
export function invitationRecipientMatches(invitationEmail: string, actorEmail: string) { return invitationEmail.trim().toLowerCase() === actorEmail.trim().toLowerCase(); }
export function invitationExpiry(now: Date) { return new Date(now.getTime() + invitationLifetimeMs); }
export function invitationCanBeAccepted(status: InvitationStatus, expiresAt: Date, now: Date) {
  return status === "pending" && expiresAt.getTime() > now.getTime();
}
export function normalUserCanJoinStudio(existing: { studioId: string; status: string } | null, targetStudioId: string) {
  return !existing || existing.status !== "active" || existing.studioId === targetStudioId;
}
export function assertTeamPasswordAuthority(input: { studioId: string | null; roles: readonly string[] }) {
  if (!input.studioId || !input.roles.includes("owner")) throw new Error("FORBIDDEN_TEAM");
  return input.studioId;
}
