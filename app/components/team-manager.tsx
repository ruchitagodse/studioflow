"use client";

import { FormEvent, useActionState, useState } from "react";
import { changeMemberPasswordAction, createInvitationAction, revokeInvitationAction, updateMembershipAction, type TeamActionState } from "@/app/studio/team/actions";
import styles from "./schedule.module.css";
import teamStyles from "./team-ui.module.css";

type Member = { uid: string; displayName: string; email: string; roles: string[]; status: "active" | "inactive" };
type Invitation = { id: string; email: string; displayName: string; roles: string[]; status: string; expiresAt: string };

const initial: TeamActionState = {};
const roles = ["customer", "trainer", "staff"] as const;

function roleLabel(role: string) {
  return role === "staff" ? "Staff / admin" : role[0].toUpperCase() + role.slice(1);
}

export function TeamManager({ members, invitations }: { members: Member[]; invitations: Invitation[] }) {
  const [inviteState, inviteAction, invitePending] = useActionState(createInvitationAction, initial);
  const [memberState, memberAction, memberPending] = useActionState(updateMembershipAction, initial);
  const [revokeState, revokeAction, revokePending] = useActionState(revokeInvitationAction, initial);
  const [passwordState, passwordAction, passwordPending] = useActionState(changeMemberPasswordAction, initial);
  const [operationId] = useState(() => crypto.randomUUID());
  const [copied, setCopied] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [passwordMember, setPasswordMember] = useState<Member | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});

  const visibleMembers = members.filter((member) => {
    const query = memberQuery.trim().toLowerCase();
    const matchesQuery = !query || member.displayName.toLowerCase().includes(query) || member.email.toLowerCase().includes(query);
    return matchesQuery && (roleFilter === "all" || member.roles.includes(roleFilter));
  });

  async function copyInvitationLink() {
    if (!inviteState.invitationPath) return;
    await navigator.clipboard.writeText(inviteState.invitationPath);
    setCopied(true);
  }

  function validatePassword(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget); const newPassword = String(form.get("newPassword") ?? ""); const confirmPassword = String(form.get("confirmPassword") ?? "");
    const errors = { newPassword: !newPassword ? "Enter a new password." : newPassword.length < 8 ? "Password must be at least 8 characters." : undefined, confirmPassword: !confirmPassword ? "Confirm the new password." : confirmPassword !== newPassword ? "Passwords do not match." : undefined };
    setPasswordErrors(errors); if (errors.newPassword || errors.confirmPassword) event.preventDefault();
  }

  return <main className={`${styles.page} ${styles.studioPolish} ${teamStyles.teamUi}`}>
    <header className={`${styles.header} ${teamStyles.pageHeader}`}>
      <div><p className={styles.kicker}>TEAM MANAGEMENT</p><h1>Keep your team in step.</h1><p>Invite people, maintain roles, and preserve the history behind every access change.</p></div>
      <a className={styles.back} href="/studio">← Studio dashboard</a>
    </header>

    <div className={`${styles.grid} ${teamStyles.teamGrid}`}>
      <section className={`${styles.panel} ${teamStyles.panelSurface} ${teamStyles.invitePanel}`}>
        <p className={styles.kicker}>INVITE A MEMBER</p><h2 className={teamStyles.panelTitle}>Share access deliberately</h2><p className={`${styles.note} ${teamStyles.inviteNote}`}>StudioFlow creates a secure link. Copy it and send it yourself—we do not send an email automatically.</p>
        <form action={inviteAction} className={`${styles.form} ${teamStyles.inviteForm}`}>
          <input type="hidden" name="operationId" value={operationId} />
          <label>Name <input name="displayName" maxLength={100} placeholder="Enter full name" disabled={invitePending} /></label>
          <label>Email <input name="email" type="email" required placeholder="Enter email address" disabled={invitePending} /></label>
          <fieldset className={`${styles.roleFieldset} ${teamStyles.inviteRoles}`}><legend>Roles</legend>{roles.map((role) => <label key={role} className={styles.checkbox}><input name="roles" type="checkbox" value={role} disabled={invitePending} />{roleLabel(role)}</label>)}</fieldset>
          {inviteState.error && <p className={styles.error} role="alert">{inviteState.error}</p>}
          {inviteState.success && <div className={styles.success} role="status"><p>{inviteState.success}</p>{inviteState.existingAccount && <p>This person keeps their existing Firebase credentials.</p>}{inviteState.invitationPath && <><label>Invitation link <input value={inviteState.invitationPath} readOnly aria-label="Invitation link" /></label><button type="button" onClick={copyInvitationLink}>{copied ? "Invitation link copied" : "Copy invitation link"}</button></>}</div>}
          <button disabled={invitePending || !operationId}>{invitePending ? "Creating invitation…" : "Create invitation"}</button>
        </form>
      </section>

      <section className={`${styles.panel} ${teamStyles.panelSurface} ${teamStyles.invitationsPanel}`}>
        <div className={teamStyles.invitationHeading}><div><p className={styles.kicker}>PENDING INVITATIONS</p><h2 className={teamStyles.panelTitle}>Awaiting acceptance</h2></div><span className={teamStyles.invitationCount}>{invitations.length} pending</span></div>
        {revokeState.error && <p className={styles.error} role="alert">{revokeState.error}</p>}{revokeState.success && <p className={styles.success} role="status">{revokeState.success}</p>}
        {invitations.length === 0 ? <p className={styles.empty}>No invitations are waiting. Create an invitation when someone needs access.</p> : <div className={teamStyles.invitationTable}>
          <div className={teamStyles.invitationTableHead} aria-hidden="true"><span>Name</span><span>Email</span><span>Role</span><span>Status</span><span>Expires</span><span>Actions</span></div>
          <div className={`${styles.list} ${teamStyles.invitationList}`}>{invitations.map((invitation) => <article key={invitation.id} className={`${styles.item} ${teamStyles.invitationRow}`}>
            <div className={teamStyles.invitationName}><span className={teamStyles.initialAvatar}>{(invitation.displayName || invitation.email).trim().charAt(0).toUpperCase()}</span><b>{invitation.displayName || invitation.email}</b></div>
            <span className={teamStyles.invitationEmail}>{invitation.email}</span><span className={teamStyles.rolePill}>{invitation.roles.map(roleLabel).join(" · ") || "No role"}</span>
            <span className={`${teamStyles.invitationStatus} ${invitation.status === "pending" ? teamStyles.pending : teamStyles.accepted}`}><i aria-hidden="true" />{invitation.status}</span><time dateTime={invitation.expiresAt}>{new Date(invitation.expiresAt).toLocaleDateString()}</time>
            <div className={teamStyles.invitationActions}>{invitation.status === "pending" && <form action={revokeAction}><input type="hidden" name="invitationId" value={invitation.id} /><button className={styles.textButton} disabled={revokePending}>{revokePending ? "Revoking…" : "Revoke"}</button></form>}<button type="button" className={teamStyles.overflowButton} aria-label={`More actions for ${invitation.displayName || invitation.email}`}>⋮</button></div>
          </article>)}</div>
        </div>}
      </section>
    </div>

    <section className={`${styles.panel} ${teamStyles.panelSurface} ${teamStyles.membersPanel}`}>
      <div className={teamStyles.membersIntro}>
        <div><p className={styles.kicker}>MEMBERS</p><h2 className={teamStyles.panelTitle}>Active and historical access</h2><p>Manage team members, their roles and access history.</p></div>
        <div className={teamStyles.memberFilters}><label><span className="sr-only">Search team members</span><input type="search" placeholder="Search name or email…" value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} /></label><select aria-label="Filter members by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="all">All roles</option>{roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></div>
      </div>
      {memberState.error && <p className={styles.error} role="alert">{memberState.error}</p>}{memberState.success && <p className={styles.success} role="status">{memberState.success}</p>}
      {members.length === 0 ? <p className={styles.empty}>Your active team will appear here after an invitation is accepted.</p> : <div className={teamStyles.membersTable}>
        <div className={teamStyles.memberTableHead} aria-hidden="true"><span>Name</span><span>Email</span><span>Roles</span><span>Status</span><span>Added on</span><span>Last active</span><span>Actions</span></div>
        <div className={`${styles.memberList} ${teamStyles.memberList}`}>{visibleMembers.map((member) => <article key={member.uid} className={`${styles.memberCard} ${teamStyles.memberRow}`}>
          <div className={`${styles.memberHeading} ${teamStyles.memberName}`}><div><b>{member.displayName || "Name not provided"}</b><span>{member.email}</span></div></div><span className={teamStyles.memberEmail}>{member.email}</span><span className={teamStyles.rolePill}>{member.roles.map(roleLabel).join(" · ") || "No role"}</span><em className={`${member.status === "active" ? styles.activeBadge : styles.inactiveBadge} ${teamStyles.memberStatus}`}>{member.status}</em><span className={teamStyles.mutedCell}>—</span><span className={teamStyles.mutedCell}>—</span>
          {member.roles.includes("owner") ? <p className={styles.note}>Owner access is controlled through protected platform provisioning.</p> : <details className={teamStyles.memberEditor}><summary>Edit<span aria-hidden="true">···</span></summary><form action={memberAction} className={styles.form}><input type="hidden" name="uid" value={member.uid} /><label>Name <input name="displayName" defaultValue={member.displayName} maxLength={100} disabled={memberPending} /></label><fieldset className={styles.roleFieldset}><legend>Roles</legend>{roles.map((role) => <label key={role} className={styles.checkbox}><input name="roles" type="checkbox" value={role} defaultChecked={member.roles.includes(role)} disabled={memberPending} />{roleLabel(role)}</label>)}</fieldset><button name="action" value="update" disabled={memberPending}>{memberPending ? "Saving…" : "Save profile and roles"}</button><button type="button" className={teamStyles.changePasswordButton} onClick={() => { setPasswordMember(member); setPasswordErrors({}); }} disabled={memberPending}>Change password</button>{member.status === "inactive" ? <button name="action" value="activate" disabled={memberPending}>Reactivate membership</button> : <><label>Reason for access change <input name="reason" maxLength={300} placeholder="For example, no longer working at the studio" disabled={memberPending} /></label><div className={styles.actionRow}><button name="action" value="deactivate" disabled={memberPending}>Deactivate</button><button name="action" value="revoke" disabled={memberPending}>Revoke access</button></div></>}</form></details>}
        </article>)}</div>
        {visibleMembers.length === 0 && <p className={teamStyles.noResults}>No team members match those filters.</p>}
      </div>}
    </section>{passwordMember && <div className={teamStyles.passwordBackdrop} role="presentation" onMouseDown={() => !passwordPending && setPasswordMember(null)}><section className={teamStyles.passwordModal} role="dialog" aria-modal="true" aria-labelledby="change-password-title" onMouseDown={(event) => event.stopPropagation()}><button type="button" className={teamStyles.modalClose} onClick={() => setPasswordMember(null)} disabled={passwordPending} aria-label="Close change password">×</button><p className={styles.kicker}>ACCOUNT SECURITY</p><h2 id="change-password-title">Change password</h2><p className={teamStyles.passwordIntro}>Set a new password for {passwordMember.displayName || passwordMember.email}. It is never stored in StudioFlow.</p><form action={passwordAction} onSubmit={validatePassword} className={styles.form} noValidate><input type="hidden" name="uid" value={passwordMember.uid} /><label>New password <span className={teamStyles.passwordField}><input name="newPassword" type={passwordVisible ? "text" : "password"} autoComplete="new-password" aria-invalid={Boolean(passwordErrors.newPassword)} aria-describedby={passwordErrors.newPassword ? "new-password-error" : undefined} disabled={passwordPending} onChange={() => setPasswordErrors((current) => ({ ...current, newPassword: undefined }))} /><button type="button" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? "Hide new password" : "Show new password"} aria-pressed={passwordVisible} disabled={passwordPending}><span aria-hidden="true">👁</span></button></span></label>{passwordErrors.newPassword && <p id="new-password-error" className={teamStyles.passwordError} role="alert">{passwordErrors.newPassword}</p>}<label>Confirm new password <span className={teamStyles.passwordField}><input name="confirmPassword" type={confirmPasswordVisible ? "text" : "password"} autoComplete="new-password" aria-invalid={Boolean(passwordErrors.confirmPassword)} aria-describedby={passwordErrors.confirmPassword ? "confirm-password-error" : undefined} disabled={passwordPending} onChange={() => setPasswordErrors((current) => ({ ...current, confirmPassword: undefined }))} /><button type="button" onClick={() => setConfirmPasswordVisible((visible) => !visible)} aria-label={confirmPasswordVisible ? "Hide confirmed password" : "Show confirmed password"} aria-pressed={confirmPasswordVisible} disabled={passwordPending}><span aria-hidden="true">👁</span></button></span></label>{passwordErrors.confirmPassword && <p id="confirm-password-error" className={teamStyles.passwordError} role="alert">{passwordErrors.confirmPassword}</p>}{passwordState.error && <p className={styles.error} role="alert">{passwordState.error}</p>}{passwordState.success && <p className={styles.success} role="status">{passwordState.success}</p>}<button disabled={passwordPending}>{passwordPending ? "Changing password…" : "Change password"}</button></form></section></div>}
  </main>;
}
