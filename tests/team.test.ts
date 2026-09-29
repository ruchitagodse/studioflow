import { describe, expect, it } from "vitest";
import { invitationSchema, memberPasswordChangeSchema, membershipUpdateSchema } from "../lib/validation";
import { assertTeamPasswordAuthority, createInvitationSecret, hashInvitationSecret, invitationCanBeAccepted, invitationExpiry, invitationLifetimeMs, invitationRecipientMatches, invitationTokenMatches, normalUserCanJoinStudio } from "../lib/team-logic";

describe("team invitation rules", () => {
  it("creates high-entropy secrets and persists only a stable hash", () => {
    const secret = createInvitationSecret();
    expect(secret.length).toBeGreaterThan(30);
    expect(hashInvitationSecret(secret)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashInvitationSecret(secret)).not.toContain(secret);
  });
  it("uses a seven-day expiry and rejects expired, accepted, and revoked invitations", () => {
    const now = new Date("2026-09-24T00:00:00.000Z");
    expect(invitationExpiry(now).getTime() - now.getTime()).toBe(invitationLifetimeMs);
    expect(invitationCanBeAccepted("pending", invitationExpiry(now), now)).toBe(true);
    expect(invitationCanBeAccepted("pending", now, now)).toBe(false);
    expect(invitationCanBeAccepted("accepted", invitationExpiry(now), now)).toBe(false);
    expect(invitationCanBeAccepted("revoked", invitationExpiry(now), now)).toBe(false);
  });
  it("accepts only the original valid token, intended email, and pending invitation state", () => {
    const token = createInvitationSecret(); const hash = hashInvitationSecret(token); const now = new Date("2026-09-24T00:00:00.000Z");
    expect(invitationTokenMatches(token, hash)).toBe(true);
    expect(invitationTokenMatches(createInvitationSecret(), hash)).toBe(false);
    expect(invitationRecipientMatches("customer@example.com", "Customer@example.com")).toBe(true);
    expect(invitationRecipientMatches("customer@example.com", "other@example.com")).toBe(false);
    expect(invitationCanBeAccepted("pending", invitationExpiry(now), now)).toBe(true);
    expect(invitationCanBeAccepted("accepted", invitationExpiry(now), now)).toBe(false);
    expect(invitationCanBeAccepted("revoked", invitationExpiry(now), now)).toBe(false);
    expect(invitationCanBeAccepted("pending", new Date(now.getTime() - 1), now)).toBe(false);
  });
  it("validates only permitted non-owner invitation roles", () => {
    expect(invitationSchema.safeParse({ email: "trainer@example.com", roles: ["trainer"], operationId: "5b2577c5-6648-4d46-b520-c3227605ab4b" }).success).toBe(true);
    expect(invitationSchema.safeParse({ email: "owner@example.com", roles: ["owner"], operationId: "5b2577c5-6648-4d46-b520-c3227605ab4b" }).success).toBe(false);
    expect(membershipUpdateSchema.safeParse({ uid: "user", action: "deactivate", reason: "Left the studio" }).success).toBe(true);
    expect(membershipUpdateSchema.safeParse({ uid: "user", action: "deactivate" }).success).toBe(false);
  });
  it("requires the existing eight-character password policy and matching confirmation", () => {
    expect(memberPasswordChangeSchema.safeParse({ uid: "member", newPassword: "password", confirmPassword: "password" }).success).toBe(true);
    expect(memberPasswordChangeSchema.safeParse({ uid: "member", newPassword: "short", confirmPassword: "short" }).success).toBe(false);
    expect(memberPasswordChangeSchema.safeParse({ uid: "member", newPassword: "password", confirmPassword: "different" }).success).toBe(false);
  });
  it("rejects password management before any Firebase operation for a non-owner", () => {
    expect(() => assertTeamPasswordAuthority({ studioId: "studio-a", roles: ["staff"] })).toThrow("FORBIDDEN_TEAM");
    expect(assertTeamPasswordAuthority({ studioId: "studio-a", roles: ["owner"] })).toBe("studio-a");
  });
  it("does not permit a normal user with active access elsewhere to join another studio", () => {
    expect(normalUserCanJoinStudio({ studioId: "studio-a", status: "active" }, "studio-b")).toBe(false);
    expect(normalUserCanJoinStudio({ studioId: "studio-a", status: "active" }, "studio-a")).toBe(true);
    expect(normalUserCanJoinStudio(null, "studio-a")).toBe(true);
  });
});
