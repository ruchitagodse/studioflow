# Decisions and approvals

This is the authority for decisions that are unresolved or frozen. A proposed
default is not permission to implement; rules that depend on it remain
approval-required in `BUSINESS_RULES.md`.

## Decided and frozen

### Platform, identity, and tenancy

- StudioFlow is a focused single-studio Pilates operations and booking product,
  not a marketplace or broad gym platform.
- The normal login page is login-only: it has no Create Studio action and no
  studio selector. It includes Firebase Authentication password recovery.
- Normal users cannot create studios or self-provision arbitrary studio
  Memberships. Authorized administrators provision or invite users according to
  `ROLES_PERMISSIONS.md`.
- Studio creation is independent of normal login/registration. A dedicated,
  protected Super Admin workspace exists at `/super-admin`.
- There is no public Super Admin registration. Initial Super Admin authority is
  created through a controlled administrative/bootstrap process.
- Super Admin controls studio provisioning and lifecycle: create,
  activate/deactivate/archive, assign initial owner, manage ownership and
  provisioning authority, and manage platform-level studio configuration.
- In V1, a normal user has zero or one verified active studio Membership.
  Multi-studio membership, selection, and switching are out of scope.
- After authentication, a verified Super Admin routes to `/super-admin`.
  Otherwise the application resolves verified active Membership and effective
  role before routing to the appropriate studio workspace. A missing/invalid
  Membership shows access denied/account configuration required; it never offers
  studio creation or selection.
- Disabled users cannot access the application. Inactive Memberships cannot
  access their studio. Deactivated studios block both studio operations and
  customer access. No client may reactivate any of these states.
- V1 invitation delivery is manual: an Owner generates a secure invitation
  link, copies it, and shares it through their chosen channel. StudioFlow does
  not send transactional invitation email in this slice. Firebase password
  recovery is never used as an invitation mechanism, especially for an
  existing Firebase account. Transactional delivery remains deferred to the
  Notifications slice.

### Market and time

- Initial launch market is India; currency is INR; primary application language
  is English.
- Every Studio has one required IANA timezone, established during Super Admin
  provisioning. It is authoritative for studio-local scheduling and time-based
  business rules.
- Payment-provider-specific behaviour is not decided or implemented yet.

### Architecture and operational authority

- Firebase Auth is the identity provider; Firestore and trusted Cloud Functions
  are the intended operational platform. Normal development uses the configured
  Firebase development project; emulators are optional, not required every day.
- Booking-sensitive operations are tenant-scoped and trusted server operations
  decide capacity, credits, cutoff classification, waitlist promotion, penalties,
  audit history, and idempotency.
- Free cancellation includes the exact two-hour boundary before a slot.
- Owner/Staff operational authority is governed by
  `ROLES_PERMISSIONS.md`. Super Admin is not required for daily studio
  operations.
- The initial UI foundation was fixture-only. It now has persisted product
  behaviour only for the implemented Sprint 1 identity/provisioning, Sprint 2
  schedule, and Team & Membership Provisioning slices.

### Sprint 3 entitlement foundation

- V1 supports fixed-credit Plans only; unlimited Plans are deferred.
- A Plan has a required informational INR price, a positive fixed credit
  allocation, and a validity duration measured from Subscription activation.
  Sprint 3 does not collect payment.
- A Plan template changes prospectively. Each assigned Subscription retains the
  historical price, allocation, validity, and other entitlement terms that
  applied when it was assigned. Retired Plans cannot be newly assigned.
- Owner and Staff/Admin manually assign a Plan to an active customer
  Membership. Assignment immediately creates an active Subscription and its
  fixed-credit allocation; customer self-purchase is deferred.
- An active Subscription may be cancelled by Owner or Staff/Admin before its
  end date. It then becomes inactive; unconsumed credits become unavailable but
  remain historically recorded. At natural end, the Subscription becomes
  inactive and its remaining available credits expire; a valid reservation is
  honoured. There is no carry-forward, payment-provider state, or Subscription
  `revoked` state in V1. Manual renewal and the frozen pause policy are owned by
  Sprint 10; their implementation remains pending.
- Credits are allocated once on assignment/activation. Remaining available
  credits expire at their owning Subscription's expiry boundary, while a valid
  reservation is retained under the approved Sprint 4 policy. Owner and
  Staff/Admin may make a
  reasoned manual adjustment; an adjustment may never make usable balance
  negative. Ledger and audit history are append-only.

### Sprint 4 customer availability and booking

- A fixed credit from an active Subscription is eligible for every published,
  bookable Slot in the same studio. V1 has no class-specific or Plan-specific
  eligibility restrictions.
- New booking is allowed only while trusted server time is strictly earlier than
  the Slot start instant. There is no additional booking lead-time cutoff in
  V1.
- A reservation made while the Subscription is active remains honoured when
  that Subscription later expires before the Slot starts. The Booking remains
  confirmed and its credit remains reserved until its approved later lifecycle
  outcome; it never returns to usable balance merely because the Subscription
  expired.

### Sprint 5 customer booking management

- Customer cancellation is permitted only before the slot start instant. The
  two-hour cutoff is inclusive: cancellation at or earlier than two hours
  before the start is free; a later pre-start cancellation is late. Customer
  cancellation at or after the start is not allowed.
- A free cancellation returns its reserved credit. A late cancellation consumes
  its reserved credit and does not return it to usable balance. This approved
  credit outcome is not an additional incident-policy penalty; incident-policy
  configuration, fees, and other threshold actions remain deferred. Sprint 5
  creates no Incident record for a late cancellation; that event belongs to the
  future Incident/penalty domain.
- Customer rescheduling is allowed only at or earlier than the same inclusive
  two-hour free-cancellation cutoff. It is unavailable inside that window and
  at/after the original slot start. It is one atomic booking-change intent:
  when the target is full, unavailable, or invalid, the original confirmed
  Booking and reservation remain unchanged. Waitlist placement is not implied.
- An inactive customer Membership or Studio blocks new customer booking
  operations, but never silently deletes, rewrites, or removes existing
  confirmed Bookings, reservations, or historical records. A shutdown, refund,
  and customer-notification policy remains deferred.

### Sprint 6 trainer roster and attendance

- The existing Membership is the trainer identity. It retains the existing
  `trainerUid` Slot assignment; V1 trainer profile is limited to display name.
  Photo, specialization, contact, and other profile enhancements are deferred.
- Attendance is available from the Slot start instant through exactly 1 hour
  after its scheduled end, using trusted server time. It is then locked.
- Attendance outcomes are limited to `attended` and `no-show`. Each outcome
  consumes the Booking's existing reserved credit through the current ledger;
  it never returns the credit or introduces another credit system.
- The assigned Trainer can mark outcomes only for their assigned Slots.
  Owner/Staff/Admin may view and mark any Slot in their verified studio. Only
  Owner/Staff/Admin may correct a locked outcome, with a required reason and
  audit history; attendance is never deleted.
- Sprint 6 records factual attendance only. It creates no Incident record and
  implements no threshold, warning, fee, penalty, waiver, or policy evaluation.
  Those belong to the future Incident/penalty domain.
- Customers see only their own factual `Attended` or `No-show` outcome in
  booking history. Attendance statistics, analytics, dashboards, and
  leaderboards are out of scope.

### Sprint 7 Owner Incident Policy

- V1 Incident sources are only late cancellation and no-show. Free
  cancellation, attended, rescheduled-original, ordinary confirmed, and failed
  booking do not create Incidents.
- A qualifying source creates one deterministic, idempotent Incident. A
  no-show corrected to attended retains its historical Incident as `reversed`;
  an attended outcome corrected to no-show creates exactly one no-show Incident
  and never repeats credit consumption.
- The active studio policy flags a customer for Owner review at three active,
  non-waived, non-reversed Incidents in a rolling 30-day window using trusted
  server time. The triggering Incident counts. Current-policy evaluation is
  used, while each historical Incident retains its original policy snapshot.
- Threshold action is Owner review only: no automatic booking restriction,
  credit change, fee, debt, payment, refund, notification, or change to existing
  Bookings.
- Owners may configure policy, view/review Incidents, waive an Incident with a
  reason, and reverse it when its factual source is corrected. Staff/Admin has
  read-only Incident visibility. Customers have no Incident history in V1.
- Incidents are never deleted. Creation, policy lifecycle, threshold review,
  waiver, and reversal are trusted, tenant-scoped, idempotent, and audited.
- **Sprint 9 repair:** Staff/Admin may correct factual attendance from no-show to
  attended but that does not change the linked Incident. Owner alone may make a
  separate, reasoned factual reversal after the source is corrected. Owner may
  also record an idempotent `incident.reviewed` acknowledgement; it changes no
  Incident state, credit, or threshold evaluation.
- Sprint 7 excludes automatic restrictions, fees, payments, credit penalties,
  notifications, waitlist, billing, analytics, a generalized rules engine, and
  the planned product-wide UI redesign.

### Sprint 8 Waitlist and Promotion

- V1 uses FIFO automatic promotion for full published future Slots. Active
  customers with an active Subscription and usable credit may join without a
  reservation; one deterministic entry per customer/Slot prevents duplicates.
- Free/late cancellation, successful reschedule from the original Slot, and
  capacity increase atomically promote the first currently eligible entry into a
  normal confirmed Booking with one existing-credit reservation.
- Ineligible entries are terminal and skipped. Customers may withdraw; active
  entries close at Slot start. Terminal entries may be recreated. No offers,
  manual promotion, reordering, notifications, or credit effect except a
  successful promotion reservation.
- Staff/Admin and Owner may view a bounded queue and remove an active entry with
  a reason; neither may reorder, manually promote, or override eligibility.

## Requires product-owner decision before its named slice

| Decision required | Required before | Why it matters | Options | Current proposed default |
| --- | --- | --- | --- | --- |
| Owner/Admin operational setting split | Slice 2 / affected settings | Defines owner-only versus staff/admin authority for studio profile, booking presentation, notification templates, and customer-service overrides. | Owner-only; staff/admin; owner approval with staff execution. | Keep policy, roles, and timezone owner-only; allow staff/admin daily operations. |
| ~~Team invitation and membership lifecycle~~ | **Decided** | Owner-only invitation-based provisioning; one active invitation per email/studio expires after seven days; existing Firebase accounts are associated without duplication; owners can reactivate/deactivate without deletion. Inactive trainers cannot receive new slots; existing future slots, bookings, and subscriptions remain unchanged. | — | — |
| ~~Plan and subscription adjustment authority~~ | **Decided for Sprint 3** | Owner and Staff/Admin manage Plan templates, manually assign/cancel Subscriptions, and make reasoned credit adjustments. | — | — |
| ~~Recurring slot generation and overlap policy~~ | **Decided for Sprint 2** | One-off slots only; recurring-slot generation is out of scope. Overlapping slots for the same trainer are rejected. | — | — |
| Slot completion and cancellation consequences | Future slot-lifecycle policy | Defines when a past slot completes and effects on bookings, credits, waitlist, and notifications. The completion policy must preserve the approved BR-07 attendance window. | Automatic/manual completion; refund/rebook/other approved cancellation handling. | Do not enable cancellation with bookings until policy is decided. |
| ~~Trainer staffing model~~ | **Decided for Sprint 2** | A published slot requires exactly one active trainer belonging to the same studio. | — | — |
| ~~Class retirement effect on future slots~~ | **Decided for Sprint 2** | Retiring a Class blocks new Slot creation but preserves the Class and all existing Slots unchanged; Slots continue through their own lifecycle and require explicit cancellation. | — | — |
| ~~Initial entitlement source and authority~~ | **Decided for Sprint 3** | Owner or Staff/Admin manually assigns a Plan; assignment is immediately active and allocates fixed credits. | — | — |
| ~~Plan entitlement type~~ | **Decided for Sprint 3** | Fixed-credit Plans only; unlimited Plans are deferred. | — | — |
| ~~Plan model and change policy~~ | **Decided for Sprint 3** | Required informational INR price, fixed allocation, duration-from-activation validity, and prospective template changes with historical Subscription terms. | — | — |
| ~~Non-billing subscription lifecycle~~ | **Decided for Sprint 3 / extended by Sprint 10** | Immediate active assignment; natural expiry expires remaining credits; no revoked or payment-provider state. Sprint 10 owns manual renewal, cancellation effects, and pause implementation. | — | — |
| ~~Credit allocation and balance policy~~ | **Decided for Sprint 3** | Allocate once at assignment/activation; no carry-forward; expiry at Subscription end; reasoned Owner/Staff adjustment; never negative. | — | — |
| ~~Concurrent active Subscriptions~~ | **Decided for Sprint 3** | A customer may have only one active Subscription in their studio. A new Plan may be assigned only after the previous Subscription is inactive; historical subscriptions and ledgers remain unchanged. | — | — |
| ~~Credit eligibility (D-S4-1)~~ | **Decided for Sprint 4** | Fixed credits are eligible for every published, bookable Slot in the studio; V1 has no class-specific eligibility restrictions. | — | — |
| ~~Booking lead-time (D-S4-2)~~ | **Decided for Sprint 4** | Booking is allowed only while trusted server time is strictly before the Slot start instant; V1 has no additional cutoff. | — | — |
| ~~Credit expiry after reservation (D-S4-3)~~ | **Decided for Sprint 4** | Honour a valid reservation across Subscription expiry; the Booking remains confirmed and its credit remains reserved, not usable. | — | — |
| ~~Post-start cancellation and late rescheduling~~ | **Decided for Sprint 5** | Customer cancellation is blocked at/after start; customer rescheduling is allowed only at/earlier than the inclusive two-hour cutoff. | — | — |
| ~~Inactive-entity future-booking/subscription treatment~~ | **Decided for Sprint 5** | Inactivity blocks new booking operations but preserves existing confirmed Bookings, reservations, and history unchanged. | — | — |
| ~~Incident policy~~ | **Decided for Sprint 7** | Late-cancellation/no-show only; three active Incidents in 30 rolling days; current-policy evaluation; Owner review only; Owner waiver/reversal and Staff read-only visibility. | — | — |
| ~~Waitlist lifecycle~~ | **Decided for Sprint 8** | FIFO automatic promotion, reserve only on confirmed promotion, skip ineligible entries, trusted class-start closure, and bounded Staff/Owner view/removal. | — | — |
| Notifications | Slice 8/9 | Defines events, channels, consent, guarantees, retries/failure behaviour, and templates. | Best-effort or required delivery; selected channels. | Record durable intent; do not promise delivery until policy is chosen. |
| ~~Subscription pause implementation~~ | **Decided** | Whole-month-only formula, cumulative split allowance, immediate customer/Owner/Staff pause authority, booking preservation, inactivity preservation, and derived effective expiry are frozen in BR-10. | — | Implementation remains a future slice. |
| Timezone-change migration | Owner settings implementation | Prevents reinterpreting historical/future slot instants. | Owner change with migration; Super Admin only; no change after activation. | Defer; never reinterpret recorded instants. |

## Subscription Pause — final approved policy

**Approved:** pause allowance is independent of credits and equals subscription
duration in calendar months × five calendar days. Pausing does not create,
consume, refund, release, or expire a credit or ledger entry, and an approved
pause extends effective subscription validity by its approved duration. Existing
reserved credits are not silently changed.

**Final policy:** only a whole-calendar-month subscription duration can use the
formula; non-whole-month Plans require a separate product decision before pause
is enabled. The calculated allowance is a cumulative budget which may be split
across multiple pause periods, never exceeded, refunded, or converted into
credits. Customer may pause only their own Subscription; Owner/Staff/Admin may
assist in their verified studio; Super Admin cannot pause customer subscriptions.
Pauses begin immediately at trusted server time; scheduled pauses are out of
scope. Existing confirmed Bookings remain valid, cancellation remains governed
by BR-05, and reschedule targets are blocked by pause eligibility. Pause history
is retained through Membership/Studio inactivity without automatic cancellation.
Effective expiry equals historical expiry plus actual recorded pause days.

## Sprint 10 — Billing, Subscription Lifecycle, Pause & Credit Expiry

Pause is fully decided in BR-10. The following is the frozen V1 billing
boundary. It is deliberately manual and does not imply a payment provider.

| Decision | Frozen V1 outcome |
| --- | --- | --- |
| Payment provider | No in-app gateway, online checkout, webhook, payment reconciliation, or payment-failure workflow. |
| Purchase authority | Owner or Staff/Admin manually provisions a Subscription; customer self-purchase is deferred. |
| Activation evidence | An authorized Owner or Staff/Admin manually confirms activation; it is not payment-provider-driven. |
| Paid-but-unactivated state | Not applicable because no payment processing exists. |
| Renewal authority | Owner or Staff/Admin performs manual renewal. |
| Renewal model | Each renewal creates a new historical Subscription and its own approved fixed-credit allocation; the previous Subscription and ledger are never extended or rewritten. |
| Pause-eligible duration | A Plan may explicitly define a positive whole-number `durationMonths`. Only its assigned Subscription snapshot is pause-eligible; fixed-day `validityDays` Plans remain valid but never silently convert to months. |
| Customer cancellation | End-of-term only. |
| Owner/Staff cancellation | Immediate or end-of-term; a reason is required. |
| Immediate cancellation effect | Atomically cancel future confirmed Bookings under the Subscription, release their reservations, then expire those released credits with the inactive Subscription; reconcile capacity exactly once and do not create Incidents, penalties, refunds, or transferable value. |
| Refunds | Excluded from this phase. |
| Retired Plan at renewal | Blocked; renewal requires a currently active Plan. |
| Billing notifications | Deferred; no notification infrastructure is introduced. |
| Tax/invoice | Out of scope. |

Already frozen and preserved for Sprint 10: fixed-credit only, no carry-forward,
unused available credits expire at Subscription effective expiry, valid reserved
credits survive ordinary expiry, Plan history is immutable, retired Plans cannot
be newly assigned, and pause has no credit movement. Renewal always creates a
new historical Subscription and must not merge or alter prior terms or ledger
history.

### Sprint 10 approved V1 boundary

- **Provider/payment:** no in-app payment gateway, checkout, webhook, payment
  reconciliation, payment-failure workflow, refund processing, billing
  notification, or India tax/invoice handling in this phase.
- **Provisioning/activation:** Owner or Staff/Admin manually provisions and
  manually confirms activation. Customer self-purchase is not enabled.
- **Renewal:** Owner or Staff/Admin performs manual renewal only. A retired Plan
  cannot renew; a currently active Plan is required. Renewal creates a new
  Subscription with its own approved allocation; the prior Subscription remains
  historical and unchanged.
- **Cancellation:** customer requests end-of-term cancellation only. Owner or
  Staff/Admin may apply immediate or end-of-term cancellation, with a required
  reason. Immediate cancellation atomically cancels future confirmed Bookings,
  releases their reservations, and reconciles capacity once; it creates no
  Incident or penalty. Those released credits then expire with the inactive
  Subscription and cannot fund a new Booking or transfer elsewhere. End-of-term
  cancellation preserves future Bookings. No refund is implied.
- **Credit expiry:** unused available credits expire at effective Subscription
  expiry; a valid reserved credit remains reserved and its confirmed Booking
  remains valid across ordinary expiry. Credits never carry forward. Pause
  extends effective expiry under BR-10 without moving credits.
- **Month-based validity:** a `durationMonths` Plan uses Studio-timezone
  calendar-month expiry and snapshots that value on assignment. A fixed-day Plan
  retains day-based expiry and is not pause-eligible.
- **Existing Bookings:** pause preserves confirmed Bookings; ordinary expiry and
  end-of-term cancellation preserve a valid reservation/confirmed Booking. No
  payment-failure behavior exists because payment processing is absent.
- **Audit:** trusted, tenant-scoped, idempotent operations must record manual
  provisioning, manual activation, renewal, cancellation request/effective
  cancellation, pause/resume, credit expiry, Plan retirement, and authorized
  correction. Payment audit events are not created in V1 because there is no
  payment flow.

Sprint 10's product-decision boundary is fully frozen. Its implementation
remains pending the owning roadmap slice.

## Sprint 3 decision record and remaining approval

The approved Sprint 3 entitlement contract is recorded in the frozen decisions
above. The option analysis below is retained as historical decision-pass
context; it is not a list of outstanding approvals. The only remaining Sprint
3 approval is explicitly labelled **Remaining approval** below.

### 1. Entitlement type and plan allocation (decided)

**Meaning:** decide whether a Plan grants a finite number of bookable sessions
or may grant unlimited access, and state the finite allocation amount when it
is finite.

**Why Sprint 3 needs it:** the subscription assignment and ledger cannot issue
an entitlement without knowing what is being issued.

| Option | Future booking/credit consequence |
| --- | --- |
| Fixed credits only | Each allocation issues a defined number of credits; Sprint 4 can atomically reserve exactly one eligible available credit. |
| Fixed credits plus unlimited | Sprint 4 needs a separately approved unlimited-booking eligibility path; a credit reservation cannot be its universal booking invariant. |

`Plan entitlement type` is decided as fixed credits only. A Plan therefore
carries a positive allocation amount; unlimited access is deferred.

### 2. Plan commercial and historical contract (decided)

**Meaning:** define the minimum information a studio enters when it creates a
Plan, including whether price is shown before payment integration and what
validity means for a manually assigned entitlement.

**Why Sprint 3 needs it:** staff need a truthful Plan editor and future
Subscriptions need a historical snapshot that remains understandable when a
Plan changes.

| Decision | Options | Future consequence |
| --- | --- | --- |
| Price before billing | Required INR display price; optional informational price; omit price until Billing | A display price is not payment confirmation; the selected option controls whether historical price is retained with a Subscription. |
| Validity without online billing | Non-expiring allocation; duration from activation; explicit end date at assignment | Determines when credits can expire and whether Sprint 4 can treat an otherwise available credit as eligible. |
| Plan changes after assignment | Immutable entitlement/commercial fields; or prospective versioned changes with historical snapshot | Existing Subscriptions and ledger entries must keep the plan terms under which credits were issued. |
| Retirement | Already frozen: draft, active, and retired Plan states; retirement preserves historical subscriptions | A retired Plan cannot be used for new assignments, while existing history remains explainable. |

Name, customer-facing description, status, and (for fixed credits) allocation
amount are the minimum expected Plan concepts. Class-specific eligibility may
remain deferred to Sprint 4 because no booking is implemented in Sprint 3; no
all-class or selected-class behavior may be assumed meanwhile.

**Approved outcome:** Plan price is required and informational in INR; validity
is a duration from activation; template changes apply only to future
Subscriptions; and each assigned Subscription retains its historical terms.

### 3. Subscription assignment and non-billing lifecycle (decided)

**Meaning:** define how a customer receives an entitlement before checkout or a
payment provider exists, and what ending that entitlement means.

**Why Sprint 3 needs it:** only an active Subscription makes credits available
under BR-09; the assignment flow must therefore know its initial and terminal
states.

| Decision | Options | Future consequence |
| --- | --- | --- |
| Initial assignment source | Staff/Admin or Owner manual assignment; migrated/externally confirmed allocation | `ROLES_PERMISSIONS.md` already authorizes Staff/Admin and Owner to manage customer subscriptions. The selected source determines the trusted audit reason and allocation trigger; customer self-purchase remains a later billing decision. |
| Initial state and activation | Create active immediately; create pending-activation then explicit authorized activation | Determines when credits become available and when the allocation ledger event occurs. |
| End states | Expire by approved validity; cancel prospectively; add a distinct revoked state | Determines whether remaining credits are unavailable, expired, or require a later explicit resolution. `revoked` is not currently a Subscription state in the SSOT. |
| Inactive entitlement treatment | Remaining credits expire; remain historically recorded but unavailable; require an authorized manual resolution | Sprint 4 must not reserve credits from an inactive Subscription, but needs this rule to explain the balance and customer UI. |

`paused`, renewal, payment-past-due, provider confirmation, and payment failure
remain deferred to the Billing/Subscription Lifecycle slice. Sprint 3 must not
silently introduce them.

**Approved outcome:** Owner or Staff/Admin manually assigns an active Plan to
an active customer; the Subscription is active immediately. Cancellation makes
it inactive and makes its remaining credits unavailable but historically
visible. Natural end makes it inactive and expires remaining credits. A
`revoked` state is not part of V1.

### 4. Credit allocation, expiry, and adjustment policy (decided)

**Meaning:** define the lifecycle of the finite credits issued by an active
Subscription.

**Why Sprint 3 needs it:** it governs the initial balance shown to a customer,
the ledger allocation entry, and the trusted conditions that Sprint 4 will use
for a reservation.

| Decision | Options | Future consequence |
| --- | --- | --- |
| Allocation timing | Once on activation; once per entitlement period | Periodic allocation implies an approved period/renewal model and idempotent issuance per period. |
| Carry-forward | Unused credits carry forward; expire at entitlement end; expire on individual dates | Determines the eligible balance in a later booking attempt. |
| Credit expiry | No expiry for V1; expiry derived from approved Plan validity; separately configured expiry | BR-11 prohibits guessing this. The approved Sprint 4 outcome honours a valid reservation that crosses the Subscription expiry boundary. |
| Manual adjustment authority | Owner-only; Staff/Admin with a required reason; Owner approval with Staff/Admin execution | Determines who can create an adjustment ledger entry and corresponding audit event. |
| Negative balance | Never allow; allow only audited debt/override | Allowing negatives changes customer balance, adjustment UI, and later booking eligibility. |

Every issued credit must retain its originating Subscription/Plan context. The
exact Firestore representation—individual credit units versus another safely
auditable implementation—is an engineering choice after the product rules above
are approved; it must preserve the BR-03 states and ledger history.

**Approved outcome:** allocate once at assignment/activation; no carry-forward;
remaining available credits expire at the owning Subscription end; a valid
reservation is honoured across that boundary; Owner and Staff/Admin may make a
reasoned adjustment; usable balance may never be negative.

### 5. Ledger and concurrent mutation contract

The following are already frozen by BR-03, BR-17, BR-18, and BR-20 and do not
need new product approval:

- The ledger is immutable and append-only. Its actions are allocation,
  reservation, consumption, release/return, expiry, and manual adjustment.
- Each entry carries the actor or system actor, studio, target/reference,
  timestamp, action, result, and the minimal reason/before-after information
  needed to explain the change. It never contains credentials or unnecessary
  sensitive data.
- Current balance is derived from, or safely maintained from, immutable ledger
  history; it is never a client-controlled value.
- Each balance-changing operation has a stable operation identity, is
  tenant-scoped, and is atomic with its ledger and audit records.
- Sprint 4's required invariant is: **one eligible, unexpired, available credit
  can be atomically reserved exactly once.** Booking itself remains out of
  scope for Sprint 3.

Ledger pagination, whether to materialize a read model, and exact balance
snapshot fields are implementation decisions. They must support bounded
tenant-scoped history queries and may not load an entire studio or customer
ledger screen at once.

### Concurrent active subscriptions (decided)

A customer may have **one active Subscription per studio** in V1. Before a new
Plan is assigned, an existing active Subscription must be expired or cancelled.
The historical Subscription and its ledger remain unchanged; the new
Subscription receives its own approved fixed-credit allocation. Credit balances
are never aggregated across concurrent active Subscriptions because concurrent
active Subscriptions are not supported. A future concurrent-subscription
requirement is a separate product decision and migration/architecture change.

## Sprint 4 booking decision record (decided)

The option analysis below is retained as decision history. The approved outcomes
are authoritative and unblock Sprint 4 Customer Availability and Booking.

### D-S4-1 — Credit eligibility

**Simple meaning:** decide whether a customer's fixed credits work for every
published Pilates class, or only for classes included by the Plan they were
assigned. For example, an 8-credit Plan could book any published Reformer,
Mat, or Tower slot, or it could be limited to published Reformer slots.

| Option | Booking transaction effect | Future Plan configuration effect |
| --- | --- | --- |
| **A. All published classes** | One available, unexpired credit from the active Subscription is eligible for any published, bookable Slot in that studio. No class eligibility comparison is required inside the transaction. | Plan needs no class/type eligibility setting. |
| **B. Selected eligible classes/types** | The transaction must atomically confirm that the Slot's Class or type is included in the historical entitlement terms of the active Subscription before reserving a credit. | Plan needs a defined eligible-Class/type selection, and the assigned Subscription must retain that selection so later Plan edits do not change an existing customer's access. |

**Approved outcome:** **A. All published classes.** An active customer's fixed
credits may reserve any published, bookable Slot in their verified studio. V1
does not add class/type eligibility fields to Plans or Subscriptions.

### D-S4-2 — Booking lead-time

**Simple meaning:** decide how close to a class a customer may make a new
booking. For example, a 6:00 PM slot is either bookable until 6:00 PM, or it
stops accepting new bookings at a configured earlier time such as 5:00 PM.

| Option | Exact trusted cutoff | Booking transaction effect |
| --- | --- | --- |
| **A. Until the start instant** | Permit only when trusted server time is strictly earlier than `slot.startsAt`; at `slot.startsAt` and after, booking is closed. | The transaction checks that the Slot is future at commit time. |
| **B. Configured lead time** | Permit only when trusted server time is strictly earlier than `slot.startsAt - studio.bookingLeadTime`. The owner-configured duration must be supplied as part of approval. | The transaction reads the verified Studio setting and rejects attempts at or after that cutoff. |

The stored Slot start is an unambiguous instant. The Studio's required IANA
timezone remains authoritative for entering, displaying, and explaining the
local deadline under BR-16; trusted server time, not browser time, makes the
comparison.

**Approved outcome:** **A. Until the start instant.** The trusted booking
transaction permits a new booking only when server time is strictly earlier than
`slot.startsAt`; at that instant and afterward it rejects the booking. V1 has
no separate lead-time setting.

### D-S4-3 — Credit expiry after reservation

**Simple meaning:** decide what happens when a customer books while their
Subscription is active but the Subscription ends before their class. For
example, a customer reserves one of eight credits for a Friday slot, and the
Subscription ends on Thursday night.

| Option | Booking and reserved-credit effect | Ledger and audit effect |
| --- | --- | --- |
| **A. Honour the reservation** | The confirmed Booking remains valid. The reserved credit remains reserved beyond the Subscription end and may be consumed at attendance or resolved by the applicable later booking outcome. | Normal expiry does not expire that reserved amount. The original reservation and its later resolution remain append-only and are audited. |
| **B. Invalidate at expiry** | At expiry, the system voids the Booking and resolves its reservation; the Slot capacity is released. The credit cannot become usable because the Subscription has expired. | Record the explicit reservation-resolution and expiry outcome plus a booking-void audit event atomically. This is not a free-cancellation “release” that restores usable credit under BR-03. |
| **C. Other explicitly defined behaviour** | Must state whether the Booking stays confirmed, changes state, or requires customer/staff action, and what happens to capacity. | Must state the exact immutable ledger action(s), audit event(s), and whether any credit is usable after expiry. |

**Approved outcome:** **A. Honour the reservation.** When the Subscription
expires, a confirmed Booking made while it was active remains confirmed. Its
reserved credit stays reserved until a later approved lifecycle action resolves
it. Ordinary Subscription expiry must not release it to usable balance or void
the Booking.

**Terminology clarification:** BR-03 uses **release** for a free cancellation
that restores a credit to usable balance. The approved outcome does not release
or expire a valid reserved credit at Subscription expiry. Later cancellation,
attendance, no-show, and other resolution policies remain governed by their
own slices and rules.

## Deferred by scope, not a decision

Multi-studio memberships, studio selection/switching, marketplace discovery,
content streaming, retail/POS, payroll, social features, hardware access
control, trainer marketplace, and generalized gym management remain out of
scope. They require an explicit product-scope change.
