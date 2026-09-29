# Business rules

This is the authoritative home for StudioFlow operational rules. `FLOWS.md`,
`UI.md`, and implementation tickets must reference rule IDs here rather than
restate or alter them. A rule marked **approval required** has no implementation
behaviour until it is decided in `DECISIONS.md`.

## Shared definitions

- **Studio time** is the studio's stored IANA timezone. Slot start, cutoffs,
  daily schedule, and policy periods are evaluated in studio time; stored
  timestamps remain unambiguous instants.
- A **class** is the reusable offering/template. A **slot** is a dated,
  scheduled occurrence that customers can book.
- A **credit** is one eligible entitlement to attend a slot. In V1, a fixed
  credit from an active Subscription is eligible for every published, bookable
  Slot in that verified studio; class-specific eligibility is out of scope.
- A **business event** is a state-changing action; it has a matching immutable
  audit event (BR-17).

## Class, slot, and capacity

### BR-01 — Slot lifecycle and capacity

A slot is draft, published, cancelled, or completed. Only a published slot in
the future may be booked or joined for its waitlist. Every slot has a positive
integer capacity. Confirmed bookings consume capacity; cancelled, late-cancelled
and no-show bookings do not. Capacity cannot be lowered below the number of
confirmed bookings. A cancelled slot cannot be restored silently; staff must
create a new published slot or use a separately audited recovery action.
Sprint 2 supports one-off slots only; recurring-slot generation is out of
scope. Overlapping slots assigned to the same trainer are rejected. The point
at which a past slot becomes completed, and the cancellation effect on existing bookings,
credits, waitlist entries, and notifications are approval-required in
`DECISIONS.md`.

A retired Class cannot be used for new Slots. Its existing Slots remain unchanged
and continue through their own lifecycle; cancellation is an explicit Slot action.

### BR-02 — Booking eligibility

At booking time, the customer must hold an active customer Membership to the studio, the slot
must be published and future, capacity must remain, and the customer must not
already hold a non-terminal booking for that slot. The customer must have an
eligible, unexpired credit available to reserve, unless the studio later enables
an explicitly defined alternative eligibility path. All checks and the resulting
state change are atomic and trusted. In V1, that eligible credit may be used for
any published, bookable Slot in the verified studio. New booking is allowed only
while trusted server time is strictly earlier than `slot.startsAt`; at the start
instant and afterward it is unavailable. There is no additional lead-time
cutoff. Studio time remains authoritative for entering and displaying that
deadline under BR-16.

## Credits and bookings

### BR-03 — Credit reservation, consumption, and return

Creating a confirmed booking reserves exactly one eligible credit. The credit is
consumed when the customer attends or is recorded as a no-show under BR-07; it
remains reserved until then. A free cancellation returns the same credit to its
usable balance. A late cancellation consumes the reserved credit; it does not
return that credit to usable balance. Its qualifying source also creates the
policy record required by BR-08, without another credit movement. Every reservation,
consumption, release, expiry, and adjustment
is an immutable credit-ledger entry. Balances are derived or safely maintained
from this history, never edited without an adjustment reason and audit event.
Conceptually, a credit is available, reserved, consumed, or expired; “returned”
is the ledger action that restores an available credit, not a competing balance.

### BR-04 — Booking lifecycle

A booking is confirmed, cancelled-free, cancelled-late, attended, no-show, or
voided. Only confirmed bookings reserve slot capacity. Terminal states are not
overwritten; corrections use an authorized, audited adjustment/reversal. A
booking always retains the slot, customer, and credit context needed to explain
its history, even if future display data changes.

## Cancellation and rescheduling

### BR-05 — Cancellation classification

Free cancellation applies when `cancelledAt <= slot.startsAt - 2 hours`; the
instant exactly two hours before starts is free. A later cancellation is a late
cancellation. Classification uses trusted server time and studio time, not a
browser clock. A customer cancellation is not allowed at or after the slot
start instant, nor after attendance is finalized or a slot is completed or
cancelled. The confirmed Booking remains authoritative until the trusted
cancellation operation succeeds.

### BR-06 — Rescheduling

Rescheduling is one atomic intent: validate the original confirmed booking and
the target under BR-02, then perform the required booking and credit changes as
one result. It is available to a customer only when trusted server time is at
or before the free-cancellation cutoff (`now <= slot.startsAt - 2 hours`); the
instant exactly two hours before the original slot starts is allowed. It is not
available after that cutoff or at/after the original slot start instant. Target
full, unavailable, or otherwise invalid cases leave the original Booking and
its reservation unchanged. Rescheduling must never first cancel the original
Booking and then attempt a separate target booking.

## Attendance, incidents, and penalties

### BR-07 — Attendance and no-show

Attendance is available from the exact scheduled Slot start instant through the
instant exactly 30 minutes after its scheduled end; trusted server time and the
stored Slot instants are authoritative. After that window it is locked. Only a
current eligible confirmed Booking may receive one of two factual outcomes:
`attended` or `no-show`. Either outcome consumes that Booking's already-reserved
credit through the existing immutable credit ledger and ceases to consume
confirmed capacity under BR-01. Cancelled, late-cancelled, and rescheduled-
original Bookings are never attendance candidates.

The assigned trainer may mark an outcome only for their assigned Slot. Owner and
Staff/Admin may view and mark outcomes for any Slot in their verified studio,
and may correct an existing outcome with a reason. After the normal window,
only Owner or Staff/Admin may make that correction; trainers cannot override a
locked outcome. A correction preserves the prior historical outcome and creates
the required audit event. Attendance is never deleted. Attendance actions record
actor, recorded time, and correction basis where applicable. The Slot-completion
lifecycle must not silently block an action still within this attendance window.
When Staff/Admin corrects `no-show` to `attended`, that factual correction does
not itself change the linked Incident; a separate Owner-only factual reversal
under BR-08 is required. Neither operation moves credits again.

### BR-08 — Incidents and Owner review policy

An Incident is a tenant-scoped historical policy record that references its
factual Booking or Attendance source. It does not duplicate a Booking,
Attendance, or credit-ledger record. In V1, only a `late-cancellation` and a
`no-show` are Incident sources. Free cancellation, attended,
rescheduled-original, ordinary confirmed, and failed-booking states never create
an Incident. A qualifying source transition creates exactly one deterministic,
idempotent Incident.

An Incident is `active`, `waived`, or `reversed`. Only active Incidents that
are neither waived nor reversed count. The active studio policy flags a customer
for Owner review at three active Incidents in the rolling 30-day window ending
at trusted server time; the triggering Incident counts. Historical Incidents
retain the policy version/snapshot effective when recorded, while the current
active policy determines current threshold evaluation. Policy edits never
rewrite or delete history.

The V1 threshold action is Owner review only. It does not restrict booking,
change existing Bookings, consume or return credits, create debt, charge a fee,
send a notification, or otherwise apply an automatic penalty. The existing
late-cancellation and no-show credit consumption remains exactly BR-03 and
BR-07; Incident creation, waiver, and reversal never create another credit
movement.

An Owner may configure the policy, view Incidents and threshold-review state,
waive an Incident with a reason, and reverse it only when the factual source is
corrected. Staff/Admin has read-only Incident visibility and cannot configure,
waive, reverse, or change threshold state. Customers see no Incident history in
V1. A no-show corrected to attended retains its Incident as `reversed`; an
attended outcome corrected to no-show creates the one idempotent no-show
Incident, without repeating credit consumption. Incidents are never physically
deleted. An Owner may acknowledge review of an Incident without changing its
state, credits, or threshold evaluation. Incident creation, policy
creation/update/activation/deactivation,
threshold reached, Owner review/action, waiver, and reversal are trusted,
tenant-scoped, bounded, idempotent, and audited under BR-17 through BR-20.

## Subscriptions and credits

### BR-09 — Plan and subscription lifecycle

A plan is a studio-defined sellable credit entitlement. A subscription is a
customer's instance of a plan. It is active, inactive, or paused under BR-10;
later billing support may add pending-activation, payment-past-due, or other
provider-supported states. Only active subscriptions make their eligible credits
available. Sprint 10 has no billing provider: Owner or Staff/Admin manually
confirms activation. Payment-failure behavior is not applicable while payment
processing is absent. Owner/Staff manual renewal creates a new Subscription
with a new approved fixed-credit allocation; it never extends, rewrites, or
merges the prior Subscription or its ledger. The one-active-Subscription rule
continues to apply.

A Plan may define either a positive fixed-day validity duration or a positive
whole-number `durationMonths`, never an inferred conversion between them. A
month-based Subscription calculates its historical expiry by calendar-month
semantics in the Studio timezone; a fixed-day Subscription keeps the existing
day-based expiry behavior. The assigned Subscription snapshots whichever
duration form applied. Only a `durationMonths` Subscription is pause-eligible.

For Sprint 3, a Plan is fixed-credit only: it has a required informational INR
price, positive credit allocation, and validity duration measured from
Subscription activation. V1 has no in-app payment gateway, checkout, webhook,
payment reconciliation, refund, billing notification, or tax/invoice handling.
Owner or Staff/Admin manually provisions and confirms activation of an active
Plan for an active customer Membership. The resulting Subscription is active
immediately, retains the assigned Plan's historical terms, and issues its fixed
allocation once. Renewal is an Owner/Staff manual operation and a retired Plan
cannot be assigned or renewed; the customer must select a currently active Plan.
Plan-template edits apply only to future Subscriptions. A customer may request
end-of-term cancellation. Owner or Staff/Admin may perform immediate or
end-of-term cancellation with a required reason. At the configured effective end date, a
Subscription becomes inactive and its remaining available credits expire; an
existing valid reservation follows BR-11. An immediate Owner/Staff cancellation
is a trusted, tenant-scoped, reason-required, idempotent operation: it cancels
every future confirmed Booking under that Subscription, releases each linked
reservation, and reconciles capacity exactly once with the linked booking,
ledger, and audit history. The normal reservation-release ledger event is
followed by expiry of that released credit because its owning Subscription is
inactive; it cannot fund a new Booking or transfer to another Subscription.
No refund, monetary value, Incident, or penalty is created. End-of-term
cancellation does not cancel existing future Bookings; they follow their
ordinary Booking lifecycle. V1 has no unlimited Plans,
carry-forward, customer self-purchase, payment-provider state, or
Subscription `revoked` state. Pause is governed by BR-10 and remains
implementation-pending. A customer may have
only one active Subscription in the studio. A new assignment is rejected until
the previous active Subscription is inactive; historical Subscription and ledger
records remain unchanged.

### BR-10 — Subscription pause

A pause is an immediate bounded interval on an active subscription: it starts
at trusted server time when an authorized operation succeeds. Customer may
request only their own pause; Owner and Staff/Admin may assist only through a
trusted, verified-studio operation. Super Admin has no customer-subscription
pause authority. Future scheduled pauses are out of scope.

Pause allowance is independent of the fixed-credit entitlement and is a
cumulative subscription budget: `durationMonths × 5 calendar days` (one month
→ 5 days, two months → 10 days, three months → 15 days, six months → 30 days,
and twelve months → 60 days). Only a positive whole-number `durationMonths`
snapshot is eligible for this formula. A fixed-day Plan must not silently round
up or down and is not pause-eligible. The allowance may be split across multiple historical
pause periods, but their actual calendar-day durations may never exceed the
calculated total. Unused allowance is neither refunded nor converted to credit.

During pause, its credits are unavailable for new booking and the subscription
is shown as paused. The subscription's allocated, available, and reserved
credits and immutable ledger history do not change merely because it is paused.
Pause never allocates, consumes, refunds, releases, expires, or otherwise
creates a credit-ledger entry. Existing confirmed Bookings remain valid and are
not silently modified; their cancellation continues under BR-05. Rescheduling
cannot create a target Booking while paused because BR-02 eligibility fails.
No waitlist, attendance, or Incident behavior changes.

Each pause extends effective validity by its actual calendar-day duration. The
original historical start/end dates remain unchanged; effective expiry is derived
from those dates plus recorded pause periods. A pause crossing original expiry
keeps the Subscription valid through its extended effective expiry. On pause end,
remaining credits continue under ordinary rules and the Subscription is active
unless it has been cancelled or has another approved blocking state. If
Membership or Studio becomes inactive while paused, preserve pause and
subscription history without automatic cancellation or rewriting; new customer
booking operations remain blocked and existing Bookings retain their normal
lifecycle. Calendar days and effective dates use the authoritative studio
timezone under BR-16. Recurring billing remains out of scope.

### BR-11 — Credit expiry

Credits may expire only according to the owning plan's published expiry policy.
Expired credits cannot be reserved or returned to availability. A reservation
made while its Subscription is active remains reserved when that Subscription
expires before attendance: its Booking remains confirmed and ordinary expiry
does not void the Booking or return the credit to usable balance. Pause effects
are governed by BR-10.

For Sprint 3, credits are allocated exactly once when their active Subscription
is assigned. They have no individual expiry independent of that Subscription:
all remaining available credits expire when it reaches its configured end date, and no
credit carries forward to another Subscription. For a paused Subscription, that
boundary is its BR-10-derived effective expiry rather than its unchanged
historical end date. Owner and Staff/Admin may make
a trusted, tenant-scoped, validated, idempotent, transactional manual
adjustment with a reason and append-only ledger/audit history. An adjustment
must never reduce usable balance below zero. On Subscription expiry, remaining
available credits expire; an existing valid reservation instead remains reserved
and follows its Booking lifecycle under BR-03 and BR-04.

An immediate Owner/Staff cancellation under BR-09 is distinct from ordinary
expiry: every affected future confirmed Booking is cancelled, its reservation
is recorded as released, and the released credit then expires with the inactive
Subscription in the same trusted, idempotent reconciliation. It never becomes
usable for a new Booking and is never transferred to another Subscription.

## Waitlist

### BR-12 — Waitlist entry

Only a member with an active customer Membership, active Studio, and active
Subscription with at least one usable credit may join the waitlist for a
published, full Slot strictly before its start instant. Joining remains available
after the free-cancellation cutoff but never reserves or consumes a credit. A
customer may hold one deterministic active entry per Slot; retries never create
duplicates. Entries are FIFO by trusted creation time with deterministic identity
as tie-breaker, and position is calculated dynamically. Customers may withdraw
an active entry before Slot start; Staff/Admin and Owner may remove one with a
reason. Neither may reorder entries. Withdrawal/removal has no credit effect.

### BR-13 — Waitlist promotion

V1 uses automatic promotion only. When capacity opens through a free/late
cancellation, successful reschedule away from the original Slot, or capacity
increase, the trusted operation atomically evaluates the FIFO queue. It rechecks
active Studio, customer Membership/role, published future Slot, capacity, active
entry, no duplicate Booking, active Subscription, and usable credit. Success
creates the normal confirmed Booking and reserves exactly one existing credit;
there is no second credit system. An ineligible entry becomes terminal
`ineligible`, is audited, and does not block the next entry. Failed reschedules,
attendance, corrections, booking failures, and unresolved Slot cancellation with
Bookings do not create opportunities. There is no offer, manual promotion,
override, or notification workflow in V1.

### BR-14 — Waitlist closure and terminal history

At the exact Slot start instant, the queue is closed. Remaining active entries
become `expired-at-class-start` through a trusted idempotent closure/read/mutation
path; V1 needs no dedicated scheduler. Inactive members retain historical entries
but cannot be promoted. `withdrawn`, `ineligible`, `expired-at-class-start`, and
historical declined entries may be recreated. Entries never become attendance
records directly: only a promoted confirmed Booking is eligible under BR-07.
All waitlist transitions are tenant-scoped, idempotent, and audited under
BR-17 through BR-20.

## Governance

### BR-15 — Trainer assignment

A published slot requires exactly one active trainer with an active Membership
in that studio. That Membership is the trainer identity in V1; StudioFlow does
not create a separate trainer entity. A trainer may only view customer roster
information for their assigned slots. An inactive trainer cannot receive a new
assignment, while existing assignments and their historical context remain
unchanged. Assignment or reassignment after bookings exist is visible in the
operational history and notifies affected parties when notification rules
require it.

### BR-16 — Studio timezone

Every studio has one required IANA timezone, established during Super Admin
provisioning. It is authoritative for studio-local scheduling and time-based
business rules. Changing it is owner-only, must be explicitly confirmed, and
affects future display and policy evaluation only; it must not reinterpret
already-recorded instants. Timezone-change migration behaviour remains **approval
required** before implementation.

### BR-17 — History and auditability

Booking, credit, subscription, attendance, incident, slot, plan, membership,
and policy changes must retain business history. An audit event is append-only
and contains actor/system actor, studio, action, target, timestamp, result, and
the minimal before/after or reason needed to explain the change. Sensitive data
must not be copied unnecessarily. Historical records remain visible according
to role permissions and cannot be deleted through the normal product UI.

### BR-18 — Tenant isolation

All operational records belong to exactly one studio. A verified studio
membership is required for every normal-product read or action, and every server
operation derives authorization from it rather than client-provided studio
context. In V1, a normal user has zero or one studio membership; there is no
studio selector, switching, or multi-studio membership. Queries are constrained
to the verified membership's studio. Cross-studio links, aggregation, staff
access, and data export are prohibited unless a future explicitly authorized
feature changes this rule.

### BR-19 — Platform provisioning and configuration authority

Studio creation is independent of normal login/registration and is performed
only by a Super Admin in the protected `/super-admin` workspace. There is no
public Super Admin registration; the initial authority is provisioned through a
controlled administrative/bootstrap process. Provisioning creates the Studio,
configures its required platform-controlled information (including timezone),
assigns or creates its initial Studio Owner, and activates the Studio before
that owner can access its workspace. Super Admin is not a studio Membership role
and has no implicit customer, trainer, staff, or owner capability.

Configuration authority is deliberately split:

- **Super Admin controlled:** studio creation; activation, deactivation, and
  archive; initial-owner assignment; ownership/provisioning authority; tenant
  identity; and platform-level studio configuration. Platform controls must be
  recorded in platform audit history.
- **Studio Owner/Admin operational:** schedule/class/slot operations, trainer
  assignment, capacity, customer operations, and the studio-level plans/rules
  for which their role has permission in `ROLES_PERMISSIONS.md`. Owner retains
  owner-only policy, role, and timezone authority; staff/admin may manage plans
  and subscriptions but does not gain those owner-only powers.

Owner/Staff operational settings remain governed by `ROLES_PERMISSIONS.md`.
The detailed Owner/Admin split remains approval-required in `DECISIONS.md`.

### BR-20 — Trusted mutation integrity

Every state-changing request uses a trusted operation with an operation identity
that prevents duplicate processing. Retrying the same intent must return the
already-recorded outcome rather than reserve a second credit, create a second
booking/incident, or apply another penalty. Atomic operations either persist
their complete related state and audit events or leave the previous state intact.
The exact technical idempotency mechanism belongs to the implementing sprint.

### BR-21 — Membership and role lifecycle

A disabled/inactive user cannot access the application. A Membership is active
or inactive; only an active Membership to an active Studio grants normal-product
access. A deactivated Studio blocks both studio operations and customer access.
No client action may reactivate a user, Membership, or Studio. Deactivation or
revocation blocks subsequent authorized operations but does not delete history.
An inactive customer Membership or Studio blocks new customer booking operations;
existing confirmed Bookings and their reservations remain historically intact
and retain their state. They must not silently disappear, be deleted, or be
rewritten solely because the Membership or Studio becomes inactive.
Role changes are prospective, must be authorized under
`ROLES_PERMISSIONS.md`, and create audit events. Authorized administrators
provision or invite normal users and Memberships; normal users cannot
self-provision arbitrary studio memberships. Trusted operations always check
current active state. Owner-only provisioning is invitation-based: one active
invitation per email/studio expires after seven days and grants no access until
Firebase account/password setup succeeds. Existing Firebase accounts are
associated rather than duplicated. Owners can reactivate or revoke memberships
without deleting history. Inactive trainers cannot receive new slots; existing
future slots, bookings, and subscriptions remain unchanged in this slice.
V1 invitation delivery is a manually shared, owner-generated secure link;
StudioFlow does not send invitation email in this slice. Firebase password
recovery is not an invitation mechanism and is never triggered for an existing
Firebase account.

### BR-22 — Notification intent and delivery

Notifications are derived from durable business events; delivery never creates
or substitutes for state. The events that require notification, channel,
consent, retry/failure behaviour, and whether a delivery is mandatory or
best-effort are approval-required. The system must retain the relevant business
history even when no notification is sent or delivery fails.
