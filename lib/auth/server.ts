import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { isVerifiedMembership, resolveWorkspace, type StudioRole, type Workspace } from "@/lib/access";

export const sessionCookieName = "studioflow_session";

export type Principal = {
  uid: string;
  email: string | null;
  superAdmin: boolean;
  workspace: Workspace;
  studioId: string | null;
  roles: StudioRole[];
};

/** Reuses one trusted session/membership resolution across the layout and route during a request. */
export const getCurrentPrincipal = cache(async (): Promise<Principal | null> => {
  const session = (await cookies()).get(sessionCookieName)?.value;
  if (!session) return null;

  const auth = getAdminAuth();
  const decoded = await auth.verifySessionCookie(session, true);
  const user = await auth.getUser(decoded.uid);
  const db = getAdminDb();
  const superAdmin = (await db.doc(`platformAdmins/${decoded.uid}`).get()).data()?.status === "active";
  const index = (await db.doc(`userMemberships/${decoded.uid}`).get()).data();
  const membership = index ? {
    studioId: index.studioId as string,
    status: index.status as "active" | "inactive",
    roles: (index.roles ?? []) as StudioRole[],
  } : null;
  const [studioSnapshot, membershipSnapshot] = membership ? await Promise.all([
    db.doc(`studios/${membership.studioId}`).get(),
    db.doc(`studios/${membership.studioId}/members/${decoded.uid}`).get(),
  ]) : [null, null];
  const memberRecord = membershipSnapshot?.exists ? {
    studioId: membership?.studioId ?? "",
    status: membershipSnapshot.data()?.status as "active" | "inactive",
    roles: (membershipSnapshot.data()?.roles ?? []) as StudioRole[],
  } : null;
  const verifiedMembership = isVerifiedMembership(membership, memberRecord) ? membership : null;
  const studioStatus = verifiedMembership ? studioSnapshot?.data()?.status ?? null : null;
  const workspace = resolveWorkspace({ uid: user.uid, disabled: user.disabled, superAdmin, membership: verifiedMembership, studioStatus });
  return { uid: user.uid, email: user.email ?? null, superAdmin, workspace, studioId: verifiedMembership?.studioId ?? null, roles: verifiedMembership?.roles ?? [] };
});

export async function requireSuperAdmin(): Promise<Principal> {
  const principal = await getCurrentPrincipal();
  if (!principal) throw new Error("NO_ACTIVE_SESSION");
  if (!principal.superAdmin) throw new Error("FORBIDDEN_SUPER_ADMIN");
  if (principal.workspace !== "/super-admin") throw new Error("INACTIVE_PLATFORM_ACCESS");
  return principal;
}

export async function requireWorkspace(workspace: Extract<Workspace, "/customer" | "/trainer" | "/studio">): Promise<Principal> {
  const principal = await getCurrentPrincipal();
  if (!principal) throw new Error("NO_ACTIVE_SESSION");
  if (principal.workspace === workspace) return principal;
  const permittedRoles = workspace === "/customer" ? ["customer"] : workspace === "/trainer" ? ["trainer"] : ["owner", "staff"];
  if (principal.workspace === "/access-denied" || !principal.studioId || !principal.roles.some((role) => permittedRoles.includes(role))) {
    throw new Error("FORBIDDEN_WORKSPACE");
  }
  return principal;
}
