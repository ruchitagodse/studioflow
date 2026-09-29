export const studioRoles = ["customer", "trainer", "staff", "owner"] as const;
export type StudioRole = (typeof studioRoles)[number];
export type Workspace = "/customer" | "/trainer" | "/studio" | "/super-admin" | "/access-denied";

export type MembershipSnapshot = { studioId: string; status: "active" | "inactive"; roles: StudioRole[] };
export type IdentitySnapshot = { uid: string; disabled: boolean; superAdmin: boolean; membership: MembershipSnapshot | null; studioStatus: "active" | "deactivated" | "archived" | null };

export function resolveWorkspace(identity: IdentitySnapshot): Workspace {
  if (identity.disabled) return "/access-denied";
  if (identity.superAdmin) return "/super-admin";
  const membership = identity.membership;
  if (!membership || membership.status !== "active" || identity.studioStatus !== "active") return "/access-denied";
  if (membership.roles.includes("owner") || membership.roles.includes("staff")) return "/studio";
  if (membership.roles.includes("trainer")) return "/trainer";
  if (membership.roles.includes("customer")) return "/customer";
  return "/access-denied";
}

export function hasStudioRole(roles: StudioRole[], required: StudioRole[]): boolean {
  return required.some((role) => roles.includes(role));
}

/**
 * The membership index is only a lookup aid. A user is granted tenant access
 * only when its tenant-owned membership independently confirms every scoped
 * value. This deliberately has no client-supplied studio input.
 */
export function isVerifiedMembership(index: MembershipSnapshot | null, member: MembershipSnapshot | null): boolean {
  if (!index || !member) return false;
  return index.studioId === member.studioId
    && index.status === member.status
    && index.roles.length === member.roles.length
    && index.roles.every((role) => member.roles.includes(role));
}
