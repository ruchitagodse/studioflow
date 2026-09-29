# Product status

## Current state

The application foundation and Sprint 1 identity/provisioning UI are complete.
The root route is login-only and the protected customer, trainer, studio, and
platform workspaces are intentional entry shells; they do not expose later
product domains.

Product specification is frozen. The authoritative business rules, permissions,
flows, UI specification, and conceptual data model live in `docs/`. Sprints 1,
2, Team & Membership Provisioning, Sprint 3 Entitlement Foundation, Sprint 4
Customer Availability and Booking, Sprint 5 Customer Booking Management, Sprint
6 Trainer Roster and Attendance, Sprint 7 Owner Incident Policy, Sprint 8
Waitlist and Promotion, and Sprint 9 Incident-policy repair are complete.
Notification and payment slices have not started.

The final SSOT audit is complete and the pre-Sprint 1 decisions are frozen.
Later-slice decisions remain intentionally deferred in `DECISIONS.md`.

The tenant-entry model is decided: login is login-only; Super Admin provisions
studios independently; normal users have one verified studio Membership and are
routed to its appropriate workspace or receive access denied/account
configuration required. No studio selector exists in V1.

## Sprint 1 complete

- Firebase email/password login, password recovery, and HTTP-only server session
  cookies are implemented.
- `/entry` resolves verified Super Admin authority or one active studio
  Membership, then routes to `/super-admin`, `/studio`, `/trainer`, `/customer`,
  or the access-denied state.
- `/super-admin` supports trusted studio provisioning, required IANA timezone,
  initial owner create/assignment, and studio lifecycle status updates.
- Sprint 1 records are limited to platform admin authority, Studio, Membership
  index/member records, and platform audit events. Firestore browser access is
  deny-by-default; trusted Admin SDK operations enforce the boundary.
- Six focused unit tests cover Super Admin/role resolution, inactive and missing
  access, cross-studio membership confirmation, and provisioning validation. No
  later product domain—schedule, booking, credits, subscriptions, waitlists,
  attendance, penalties, notifications, or payments—has been implemented.

## Sprint 2 complete

- Approved Sprint 2 schedule rules are finalized: one-off slots only; a
  published slot has exactly one active same-studio trainer; same-trainer
  overlaps are rejected.
- Owner/staff users can create studio-scoped reusable classes and one-off slots
  through `/studio/schedule`. Trusted operations validate input, class/trainer
  ownership, capacity, studio-local time, DST gaps, and same-trainer overlap;
  schedule mutations append studio audit events.
- Browser Firestore access remains deny-by-default. No booking, credit,
  subscription, waitlist, attendance, penalty, notification, or payment records
  are introduced.

## Team & Membership Provisioning complete

- Owner-only `/studio/team` uses bounded tenant-scoped member and invitation
  queries, trusted invitation and membership actions, and persistent feedback.
- V1 invitations use a secure, owner-copyable manual link. No transactional
  invitation email or Firebase password-reset action is used for invitations.
- Pending invitations grant no access; acceptance validates the token, intended
  Firebase identity, seven-day expiry, one-active-studio rule, and active studio
  before activating member/index records. This slice does not touch bookings,
  subscriptions, or future trainer slots.

## Sprint 3 Entitlement Foundation complete

- Owner/Staff `/studio/entitlements` supports bounded Plan management, manual
  active-customer assignment, cancellation, reasoned adjustment, and bounded
  ledger viewing. Plans are fixed-credit with informational INR prices; a
  customer can have at most one active Subscription in the studio.
- Assignment snapshots Plan terms and atomically writes the fixed allocation,
  immutable ledger record, and audit events. Plan edits apply prospectively;
  retirement preserves historical records and blocks future assignment.
- Trusted expiry materializes an atomic expiry ledger event when an overdue
  Subscription is reached through a protected entitlement read or mutation.
  Customer `/customer/entitlements` shows their own active/inactive balance and
  bounded ledger history. Browser Firestore access remains deny-by-default.

## Pre-Sprint 4 regression repair complete

- `/trainer` now reads only `draft` and `published` Slots in the verified
  studio whose `trainerUid` equals the authenticated trainer's Firebase UID.
  It renders those assigned Slots directly; cancelled and completed Slots are
  excluded. Class retirement does not alter existing Slot visibility.
- Regression tests cover the assigned-trainer match and another trainer's
  exclusion. The trusted query is rooted at the verified studio, preserving
  tenant isolation.

## Sprint 4 Customer Availability and Booking complete

- Customer `/customer` shows a bounded studio-scoped list of published future
  Slots with studio-local date/time, class, trainer, capacity, booking status,
  and active-credit context. Slot detail supplies the explicit credit impact and
  a confirmation action; `/customer/bookings` separates upcoming results from a
  bounded history.
- The trusted booking transaction derives customer and studio from the verified
  server session, rechecks active customer Membership and Studio, enforces
  published/future/capacity/duplicate/active-Subscription/credit conditions,
  reserves one credit, increments confirmed capacity, and writes the Booking,
  immutable ledger reservation, and audit events atomically.
- Deterministic customer-slot Booking identity prevents duplicate bookings;
  stable operation IDs make retried requests idempotent. A reservation survives
  natural Subscription expiry without becoming usable again. Browser Firestore
  access remains deny-by-default.

## Sprint 5 Customer Booking Management complete

- Customer `/customer/bookings` provides guarded cancellation and rescheduling
  for eligible upcoming Bookings. The exact two-hour boundary is free, late
  pre-start cancellation consumes the existing reservation, and post-start
  customer cancellation is rejected.
- Trusted transactions update the Booking, slot capacity, existing Subscription
  reservation/balance, immutable ledger, and audit history together. A
  reschedule transfers the existing reservation atomically; an invalid or full
  target leaves the original Booking untouched.
- Sprint 5 creates no Incident record and implements no warning, fee, threshold,
  penalty, waitlist, attendance, notification, billing, or pause behavior.

## Sprint 6 — complete

- The existing Membership is the trainer identity; V1 trainer profile needs a
  display name only. The existing `trainerUid` assignment, one-active-trainer
  rule, overlap protection, and inactive-trainer constraints remain unchanged.
- BR-07 defines the attendance window from exact Slot start through 30 minutes
  after scheduled end. Outcomes are limited to attended and no-show; both
  consume the existing reservation. Locked outcomes may be corrected only by
  Owner/Staff with a reason and audit history.
- Trainer `/trainer` provides the verified assigned schedule and roster entry.
  Trainer `/trainer/slots/[slotId]` and Owner/Staff
  `/studio/attendance/[slotId]` use trusted tenant-scoped reads; they expose
  only the roster data each role is authorized to see.
- Trusted attendance operations atomically validate the active studio/member,
  trainer scope or Owner/Staff authority, Slot window, eligible confirmed
  Booking, and existing reservation before recording attended/no-show,
  consuming that reservation once, updating confirmed capacity, and recording
  append-only ledger/audit history. Owner/Staff corrections require a reason
  and preserve the former outcome in audit history.
- Sprint 6 records factual attendance only. It creates no Incident records and
  implements no thresholds, warnings, fees, penalties, waivers, or policy
  evaluation. Customers may see only their own attended/no-show outcome in
  booking history.

## Sprint 7 — Owner Incident Policy — complete

- BR-08 now limits Incident sources to late cancellation and no-show, with one
  deterministic Incident per qualifying source. It defines `active`, `waived`,
  and `reversed` states; an Owner performs a separate factual reversal after a
  no-show-to-attended correction, while attended-to-no-show creates one Incident
  without a second credit movement.
- The active studio policy flags three active, non-waived, non-reversed
  Incidents in a rolling 30-day trusted-server-time window for Owner review.
  Current policy evaluates current state; historical records retain their policy
  snapshot.
- V1 has no automatic restriction, fee, payment, credit penalty, notification,
  customer Incident history, or change to existing Bookings. Owner controls
  policy, waiver, and factual reversal; Staff/Admin has read-only visibility.
- Trusted late-cancellation and no-show transactions now create one deterministic
  Incident record with policy snapshot and audit history, without another credit
  movement. Attendance correction may create the qualifying Incident; an Owner
  performs separate factual reversal under BR-08. Owner/Staff `/studio/incidents` is bounded and tenant-scoped;
  Owner policy/waiver/reversal/review actions are server-authoritative and Staff
  is read-only. Current review state is derived from the current policy and
  in-window active Incidents.

## Sprint 8 — Waitlist and Promotion — complete

- BR-12–14 are implemented through tenant-scoped server operations: customers can
  join/withdraw a bounded FIFO queue; staff/owners can remove an entry with a
  reason; automatic promotion makes one normal confirmed Booking and one existing
  credit reservation atomically. Promotion follows free/late cancellation,
  successful reschedule away from the original slot, and capacity increases.
  Ineligible entries are terminally recorded and skipped; active entries close
  idempotently at class start. Customer and studio waitlist surfaces are live.
  No offer, notification, manual promotion, or priority workflow was added.

## Next

Sprint 9 Incident-policy repair is complete. Sprint 10's manual lifecycle,
pause, month-based expiry, and cancellation implementation is complete in the
codebase and covered by the automated validation suite. A live Firebase
end-to-end operator/customer verification remains before this slice is marked
fully complete. Notifications, online billing, and other later-slice work remain
unimplemented.
