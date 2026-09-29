import { InvitationAcceptance } from "@/app/components/invitation-acceptance";
import { connection } from "next/server";
import { getCurrentPrincipal } from "@/lib/auth/server";
import { getInvitationPreview } from "@/lib/team";
import { invitationCanBeAccepted } from "@/lib/team-logic";
import styles from "@/app/components/sprint-one.module.css";

export default async function InvitationPage({ params, searchParams }: { params: Promise<{ invitationId: string }>; searchParams: Promise<{ token?: string }> }) {
  await connection();
  const { invitationId } = await params; const { token } = await searchParams; let invitation = null; let principal = null;
  try { [invitation, principal] = await Promise.all([token ? getInvitationPreview(invitationId, token) : Promise.resolve(null), getCurrentPrincipal()]); } catch { /* invalid/unconfigured state renders below */ }
  const valid = Boolean(token && invitation && invitationCanBeAccepted(invitation.status, invitation.expiresAt, new Date()));
  if (!valid || !invitation || !token) return <main className={styles.simplePage}><section className={styles.simpleCard}><p className={styles.kicker}>INVITATION UNAVAILABLE</p><h1>This invitation can’t be used.</h1><p className={styles.muted}>It may be invalid, expired, already accepted, or revoked. Ask your studio owner for a new link.</p></section></main>;
  return <InvitationAcceptance invitationId={invitationId} token={token} email={invitation.email} displayName={invitation.displayName} signedInEmail={principal?.email ?? null} />;
}
