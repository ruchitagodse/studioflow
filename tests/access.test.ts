import { describe, expect, it } from "vitest";
import { isVerifiedMembership, resolveWorkspace, type MembershipSnapshot } from "../lib/access";

const base = { uid: "user-1", disabled: false, superAdmin: false } as const;

describe("resolveWorkspace", () => {
  it("routes a verified Super Admin to the isolated platform workspace", () => {
    expect(resolveWorkspace({ ...base, superAdmin: true, membership: null, studioStatus: null })).toBe("/super-admin");
  });
  it("denies a disabled user before evaluating role", () => {
    expect(resolveWorkspace({ ...base, disabled: true, membership: { studioId: "s1", status: "active", roles: ["owner"] }, studioStatus: "active" })).toBe("/access-denied");
  });
  it("denies missing, inactive, or deactivated tenant access", () => {
    expect(resolveWorkspace({ ...base, membership: null, studioStatus: null })).toBe("/access-denied");
    expect(resolveWorkspace({ ...base, membership: { studioId: "s1", status: "inactive", roles: ["customer"] }, studioStatus: "active" })).toBe("/access-denied");
    expect(resolveWorkspace({ ...base, membership: { studioId: "s1", status: "active", roles: ["customer"] }, studioStatus: "deactivated" })).toBe("/access-denied");
  });
  it("resolves owner/staff, trainer, and customer role priority", () => {
    expect(resolveWorkspace({ ...base, membership: { studioId: "s1", status: "active", roles: ["owner", "customer"] }, studioStatus: "active" })).toBe("/studio");
    expect(resolveWorkspace({ ...base, membership: { studioId: "s1", status: "active", roles: ["trainer"] }, studioStatus: "active" })).toBe("/trainer");
    expect(resolveWorkspace({ ...base, membership: { studioId: "s1", status: "active", roles: ["staff", "trainer"] }, studioStatus: "active" })).toBe("/studio");
    expect(resolveWorkspace({ ...base, membership: { studioId: "s1", status: "active", roles: ["customer"] }, studioStatus: "active" })).toBe("/customer");
  });

  it("retains each verified studio role for a multi-role workspace even when its default route is owner", () => {
    const membership: MembershipSnapshot = { studioId: "s1", status: "active", roles: ["owner", "customer"] };
    expect(resolveWorkspace({ ...base, membership, studioStatus: "active" })).toBe("/studio");
    expect(membership.roles).toContain("customer");
  });

  it("retains trainer authority when staff is the default workspace", () => {
    const membership: MembershipSnapshot = { studioId: "s1", status: "active", roles: ["staff", "trainer"] };
    expect(resolveWorkspace({ ...base, membership, studioStatus: "active" })).toBe("/studio");
    expect(membership.roles).toContain("trainer");
  });

  it("rejects a membership index that does not confirm the same tenant or roles", () => {
    const index: MembershipSnapshot = { studioId: "studio-a", status: "active", roles: ["customer"] };
    expect(isVerifiedMembership(index, { studioId: "studio-b", status: "active", roles: ["customer"] })).toBe(false);
    expect(isVerifiedMembership(index, { studioId: "studio-a", status: "active", roles: ["trainer"] })).toBe(false);
    expect(isVerifiedMembership(index, { studioId: "studio-a", status: "active", roles: ["customer"] })).toBe(true);
  });
});
