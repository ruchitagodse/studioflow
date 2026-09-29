# End-to-end flows

This is the authoritative flow map. Operational validations reference
`BUSINESS_RULES.md`; it does not duplicate those rules. Every state-changing row
creates the BR-17 audit event shown in the final column.

## Canonical entry sequences

```text
Existing user
  ↓
Login
  ↓
Authenticate
  ↓
Verified Super Admin authority?
  ├─ Yes → Route to /super-admin
  └─ No
       ↓
Resolve verified studio Membership
  ↓
Resolve role
  ↓
Route to the appropriate workspace

No valid studio Membership
  ↓
Access denied / account configuration required
```

```text
Super Admin
  ↓
Create Studio
  ↓
Configure required studio information
  ↓
Assign/Create Studio Owner
  ↓
Studio becomes active
  ↓
Owner can access studio workspace
```

| Flow | Actor → action | Validation | State change | User result | Audit event |
| --- | --- | --- | --- | --- | --- |
| Login and tenant entry | Existing user → log in | Firebase authentication succeeds; verified active Membership exists | Session established; assigned studio and effective role resolved | Routes to the appropriate workspace for the user's one studio | `auth.signed_in` (minimal, if product audit is required) |
| Password recovery | Existing user → request password recovery | Firebase Auth account and recovery request accepted | Firebase Auth recovery flow initiated; no studio state changes | Receives the appropriate recovery path without a Create Studio or selector option | `auth.password_reset_requested` only if product audit is required |
| Super Admin entry | Bootstrap-provisioned Super Admin → log in | Firebase authentication and verified platform authority | Platform session established | Routes to protected `/super-admin` workspace, separate from studio Membership | `super_admin.signed_in` (minimal, if platform audit is required) |
| Access denied | Authenticated user → continue without valid Membership | Membership missing, inactive, or studio not active | No operational state changes | “Access denied / account configuration required”; no studio selector or fallback workspace | `access.denied` only for security/operational review if needed |
| Inactive Membership or Studio with existing bookings | Customer Membership or Studio → becomes inactive | BR-21 | No existing Booking, reservation, or history is deleted or silently rewritten; new customer booking operations are blocked | Customer receives the normal access-denied state; authorized operational users retain historical booking context | `membership.deactivated` / `studio.deactivated` |
| Studio provisioning | Super Admin → create Studio, configure required platform information, assign/create owner, activate | Super Admin authority; required provisioning information valid (BR-19) | Studio progresses through provisioning to active; initial owner Membership exists | Assigned owner can access owner workspace after login | Platform `studio.provisioned`, `studio.activated`, `membership.initial_owner_assigned` |
| Team invitation | Owner → create non-owner invitation and copy secure link | BR-18/20/21; active owner and studio; valid target; no active invitation or active Membership in another studio | Pending studio-scoped Invitation with seven-day expiry and hashed token | Owner copies the link and sends it manually; no email is claimed as sent | `membership.invited` |
| Invitation acceptance | Intended user → authenticate or complete account setup, then accept invitation | Invitation token/hash, recipient email, pending state, expiry, one-studio constraint, Firebase identity | Invitation accepted; Membership and global index become active | Routes to the role-appropriate workspace | `membership.provisioned`, `membership.activated` |
| Membership management | Owner → update permitted profile/roles, deactivate, reactivate, or revoke non-owner Membership | BR-18/20/21; current owner authority; target belongs to studio | Existing Membership/index update prospectively; history remains | Persistent confirmation and updated team status | `membership.profile_updated`, `membership.role_changed`, `membership.deactivated`, `membership.activated`, or `membership.revoked` |
| Customer onboarding | New customer → complete required studio profile and consent | Active customer Membership; required inputs valid | Customer profile/consent saved | Can use customer portal; missing requirements clearly shown | `customer.onboarded` / `customer.profile_updated` |
| View schedule | Customer → choose date/filter | Active Membership; only published future slots queryable | None | Sees slots, trainer, capacity signal and eligibility-aware action | None |
| View class details | Customer → open published slot | BR-01; studio membership | None | Sees time, duration, trainer, availability, and cancellation information | None |
| Book | Customer → confirm a slot | BR-02 and BR-03 atomically | Confirmed Booking + credit reservation + capacity reduction | Confirmation and updated credit/upcoming booking | `booking.confirmed`, `credit.reserved` |
| Booking failure | Customer → attempt book | Any BR-02/03 check fails | None | Explains current reason; refreshes availability; no misleading success | `booking.rejected` only for operational/security review if needed |
| Free cancellation | Customer → cancel confirmed booking at/earlier cutoff | BR-04 and BR-05 | Booking → cancelled-free; credit released; capacity opens; promotion evaluated under BR-13 | Free cancellation confirmation and returned-credit state | `booking.cancelled_free`, `credit.released` |
| Late cancellation | Customer → cancel confirmed booking after cutoff but before slot start | BR-03–05 and BR-08 | Booking → cancelled-late; reserved credit is consumed; capacity opens; qualifying Incident is recorded idempotently | Clearly labels the late cancellation and consumed-credit outcome | `booking.cancelled_late`, `credit.consumed`, `incident.created` |
| Reschedule | Customer → select target and confirm at/earlier free-cancellation cutoff | BR-06 plus target BR-02 | Atomic original/target booking and credit result, or none | New booking only after success; original Booking and reservation remain if the target fails, including when full | `booking.rescheduled` plus linked booking/credit events |
| Reschedule rejected | Customer → select target after cutoff, at/after original start, or when target is unavailable/full | BR-06 | None | Explains why rescheduling is unavailable; preserves the original confirmed Booking | `booking.reschedule_rejected` only for operational/security review if needed |
| Full class | Customer → view full published future slot | BR-01 and BR-12 | None | “Full” with Join waitlist action when eligible | None |
| Join waitlist | Customer → confirm FIFO entry | BR-12 | Active deterministic Waitlist entry; no credit reservation | Position and no-credit-held confirmation | `waitlist.joined` |
| Waitlist promotion | System → approved capacity-opening event | BR-13 | First eligible active entry → promoted + confirmed Booking + one credit reservation atomically | Booking is visible on next trusted read; no notification promise | `waitlist.promoted`, `booking.confirmed`, `credit.reserved` |
| Waitlist ineligible / closure | System → promotion recheck fails, or Slot reaches start | BR-13/14 | Entry → ineligible or expired-at-class-start; queue continues where applicable | Clear inactive/closed state | `waitlist.ineligible` / `waitlist.expired` |
| Waitlist withdrawal / removal | Customer → withdraw, or Staff/Admin/Owner → remove with reason | BR-12 | Entry → withdrawn or removed; no credit effect | Updated dynamic position | `waitlist.withdrawn` / `waitlist.removed` |
| Subscription assignment / activation | Owner or staff/admin → manually provision and confirm an active Plan for an active customer | BR-09; tenant/customer/role validation; Plan active; customer has no active Subscription | Active Subscription with historical Plan terms and fixed-credit allocation; snapshots explicit month duration where chosen | Clear assigned and active result; fixed-day plans show pause unavailable and no payment claim | `subscription.created`, `subscription.activated`, `credit.issued` |
| Subscription renewal | Owner or staff/admin → manually renew using a currently active Plan | BR-09; verified role/studio; prior Subscription is inactive under the one-active-Subscription rule | New active Subscription with its own historical terms and fixed-credit allocation; prior Subscription/ledger unchanged | Clear manual renewal result; no payment-provider behavior | `subscription.renewed`, `subscription.created`, `subscription.activated`, `credit.issued` |
| Subscription cancellation / expiry | Customer → request end-of-term cancellation; Owner/staff/admin → immediate or end-of-term cancellation with reason; system → reach effective end date | BR-09 and BR-11 | Natural expiry makes Subscription inactive and remaining available credits expire while a valid reservation remains reserved. Immediate operator cancellation atomically cancels future confirmed Bookings, releases their reservations, expires those released credits with the inactive Subscription, and reconciles capacity once; it creates no Incident, penalty, refund, or transfer. End-of-term cancellation preserves future Bookings. | Clear inactive/expiry result and preserved history | `subscription.cancellation_requested`, `subscription.cancelled` or `subscription.expired`, linked booking/credit release/expiry events, plus `credit.expired` on natural expiry |
| Credit lifecycle | Owner/staff/system → allocate, reserve, consume, release, expire, adjust | BR-03 and BR-11; adjustment requires authority/reason and cannot make usable balance negative | Immutable ledger entry; availability recalculated | Customer sees accurate balance/history; staff sees reason | `credit.issued/reserved/consumed/released/expired/adjusted` |
| Pause subscription | Customer → request own pause; Owner/Staff/Admin → assist within verified studio | BR-10 | Immediate Subscription → paused; historical pause period extends effective expiry with no credit movement | Remaining allowance, effective dates, and existing-booking impact clearly shown | `subscription.pause_started` |
| Pause ending | System → pause end reached | BR-10 | Subscription → active when eligible; effective validity retains recorded extension | Status/availability restored or blocking reason shown | `subscription.pause_ended` |
| Trainer schedule / roster | Trainer → open own slot or roster | Assigned trainer role and slot assignment (BR-15) | None | Sees only assigned classes and their necessary roster data | None |
| Attendance | Assigned trainer, Staff/Admin, or Owner → mark an eligible attendee | BR-07 | Booking → attended; reserved credit consumed | Roster count and attendee result update | `attendance.marked`, `credit.consumed` |
| No-show | Assigned trainer, Staff/Admin, or Owner → mark an eligible attendee no-show | BR-07 and BR-08 | Booking → no-show; reserved credit consumed; qualifying Incident is recorded idempotently | Roster update and factual no-show result | `attendance.no_show`, `credit.consumed`, `incident.created` |
| Attendance correction | Owner or Staff/Admin → correct a locked attendance outcome with a reason | BR-07 and BR-08 | Prior attendance remains historical; attended → no-show creates the qualifying Incident; Staff no-show → attended does not alter the Incident | Clear correction result with reason | `attendance.corrected`, `incident.created` where applicable |
| Incident policy / review | Owner → configure policy, review current threshold state, waive, factually reverse, or acknowledge review of an Incident | BR-08 | Historical Incident and audit state update without credit, booking, or automatic penalty change; reversal follows factual source correction | Owner sees current source/review context; Staff has read-only visibility | `incident.policy_updated`, `incident.threshold_reached`, `incident.waived`, `incident.reversed`, `incident.reviewed` |
| Staff class creation | Staff/admin → create Class or Slot | Permission; valid future time, capacity, trainer requirement under BR-15 | Class and/or draft Slot created | Draft visible to staff, not customers | `class.created` / `slot.created` |
| Slot management | Staff/admin → publish/edit/cancel/reassign slot | Permission; BR-01/15; edits cannot violate existing bookings | Slot state/details change; affected booking communication evaluated | Updated schedule or guarded validation error | `slot.published/updated/cancelled/trainer_reassigned` |
| Slot cancellation consequences | Staff/admin → cancel published slot with bookings | Approval-required BR-01 cancellation-effects policy | Not implementation-ready until bookings, credits, waitlist, and notifications are specified | Impact preview must prevent an unsupported cancellation | Audit event names follow approved policy |
| Customer management | Staff/admin → view/update customer or act on behalf | Permission; customer belongs to studio; reason for overrides | Permitted profile, booking, or adjustment change | Clear on-behalf result; customer-facing effects communicated | Relevant target event with `actorRole=staff` |
| Plan management | Staff/admin or Owner → create, publish, retire Plan | Role permission; plan rules complete/approved | Plan state changes prospectively | Active plan is available to the authorized subscription flow; historical plans preserved | `plan.created/updated/published/retired` |
| Owner / studio operations | Owner → manage owner-controlled policies, team roles, studio timezone, or review operations | Owner permission; relevant approved policy and BR-16/18/19 | Studio settings, policy, or membership changes | Explicit confirmation and impact summary | `studio.settings_updated`, `policy.updated`, `membership.role_changed` |

## Cross-flow guarantees

- A failure is all-or-nothing for capacity, bookings, credits, waitlist
  advancement, and penalties; the original valid state remains recoverable.
- Notifications follow successful durable state changes and never substitute for
  them.
- Staff and system actions expose the relevant audit history; customers see
  their own understandable history, not internal staff notes.
- Unspecified notification channels, payment handling, and later policy actions
  remain unresolved decisions, not implied flow behaviour.
