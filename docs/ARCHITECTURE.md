# Architecture

## Current foundation

The application uses Next.js App Router and TypeScript. Route components are
Server Components unless interaction requires a Client Component. CSS Modules
provide local component styling with global design tokens in `app/globals.css`.
Sprint 1 implements Firebase email/password authentication, Firebase password
recovery, server-issued HTTP-only session cookies, trusted Admin SDK
provisioning, and protected route shells. Sprint 2 adds trusted class/one-off-
slot operations; Team & Membership Provisioning adds trusted invitation and
membership operations. Sprint 3 adds plans, subscriptions, credits, and their
ledger; Sprints 4 and 5 add customer booking and booking management; Sprint 6
adds trusted attendance. Sprint 7 implements trusted Incident policy and Sprint
8 implements waitlist/promotion. Notifications and payments remain outside the
implemented scope.

```text
app/
  page.tsx                 login-only entry
  super-admin/             protected platform provisioning workspace
  customer/, trainer/, studio/ protected workspace shells
  components/              reusable presentational and interactive UI
  api/auth/session/        session-cookie endpoint
  globals.css              design tokens, resets, shared primitives
lib/                       Firebase, authorization, validation, provisioning
firestore.rules            deny-by-default client Firestore policy for trusted operations
docs/                      product and engineering source of truth
```

## Intended production shape

```text
Next.js App Router UI
  ├─ Firebase Authentication (identity)
  ├─ Firestore (tenant-scoped operational data)
  ├─ Cloud Functions (trusted booking, cancellation, waitlist, penalty work)
  └─ notification provider (only after channels are chosen)
```

Use Firebase development project configuration for ordinary development. Emulators are optional for targeted integration tests, not a daily prerequisite.

Team provisioning uses trusted server actions. Invitation links contain a
high-entropy bearer token, while Firestore persists only its hash. The owner
copies and manually shares the generated link; no transactional email provider
or Firebase password-reset call participates in this slice. A server-only
invitation lookup index resolves the opaque link identifier; it is not exposed
to the browser or used as a tenant authorization boundary.

Sprint 1 uses an Admin SDK-only Firestore access model: browser Firestore reads
and writes are denied by `firestore.rules`; trusted server operations provision
the only Sprint 1 records. This makes client-provided studio context incapable
of granting data access. Future client data access requires an explicit
role-scoped rules expansion in its owning vertical slice.

### Tenant boundary and entry

Firestore documents will be rooted at `studios/{studioId}`. After login, the
application first resolves verified platform authority: a Super Admin routes to
protected `/super-admin`. Otherwise, a Membership authorizes a user for their
one assigned studio and role set; the application resolves that verified active
Membership and effective role, then routes to the appropriate workspace. If no
active valid Membership exists, the only result is access denied/account
configuration required. There is no Create Studio login action, studio selector,
or V1 studio switching.

Security rules must prove both the authenticated user and their verified
Membership before allowing data access. Client-provided studio context is never
an authorization boundary. Cross-document booking changes run in a callable
Cloud Function or transaction after the same membership check. Super Admin
provisioning is a separate platform-authorized boundary under BR-19, exposed by
the protected `/super-admin` workspace, not normal studio application
authorization. Super Admin bootstrap is controlled and has no public
registration path. The operator-only
`npm run bootstrap:super-admin -- --uid=<Firebase Auth UID>` utility loads the
local Firebase environment and grants the
initial authority only after validating an existing enabled Firebase Auth user;
it is never exposed in application UI.

For every normal tenant-scoped operation, enforce this order:

```text
authenticated user → verified active Membership → verified active Studio
→ authorized role → operation scoped to that Membership's studio
```

Super Admin operations use a separately verified platform authority and are
limited to BR-19; that authority must not bypass normal studio authorization by
accepting an arbitrary client-provided studio ID.

### Conceptual data ownership

- `studios/{studioId}`: studio profile, timezone, rules, plan catalog.
- `studios/{studioId}/members/{uid}`: role membership and customer profile.
- `studios/{studioId}/slots/{slotId}`: concrete dated class availability.
- `studios/{studioId}/bookings/{bookingId}`: booking lifecycle and credit link.
- `studios/{studioId}/plans/{planId}`: mutable prospective fixed-credit Plan templates.
- `studios/{studioId}/subscriptions/{subscriptionId}`: one active customer Subscription at most, immutable assigned terms, lifecycle state, and trusted balance snapshot.
- `studios/{studioId}/subscriptions/{subscriptionId}/ledger/{entryId}`: append-only, bounded credit history for that Subscription.
- `studios/{studioId}/auditEvents/{eventId}`: append-only business history.

Sprint 6 extends the established tenant-rooted Booking and ledger model without
a duplicate trainer or customer identity. Sprint 7 adds Incident/policy ownership
required by BR-08. Sprint 8 adds a tenant-rooted Waitlist Entry with deterministic
customer/Slot identity and bounded FIFO queries.
Promotion extends the existing trusted booking transaction: it verifies current
eligibility, creates the normal confirmed Booking, reserves one existing credit,
updates capacity, and records audit history atomically. Exact schema and indexes
are implemented in its tenant-scoped operations.

This describes tenant ownership, not final document layout. The conceptual entity
model is in `DATA_MODEL.md`; exact Firestore schema, indexes, and security rules
are added only by their owning authenticated vertical slice—not guessed ahead of
it.

### Trusted operations

The browser may request a booking action but cannot decide capacity, credit deduction, cancellation classification, waitlist promotion, penalty application, or audit entries. These execute atomically in trusted server logic using the studio timezone and server time. Sprint 4 accepts a new booking only before the Slot start instant and allows a fixed credit for any published, bookable Slot in the verified studio; a valid reservation is retained across Subscription expiry. Sprint 5 rescheduling must likewise be one trusted atomic operation: target validation failure leaves the original Booking and reservation unchanged. Validate all action inputs with Zod at the trusted boundary.

Sprint 3 Plan, Subscription, expiry, and adjustment operations run only through
trusted server actions after verified studio-role resolution. Assignment,
expiry, and adjustment use Firestore transactions: each balance-changing action
writes its immutable ledger entry and audit event atomically, while a stable
operation identifier makes retried allocation/adjustment requests idempotent.
The browser never supplies a studio authorization boundary. Subscription expiry
is materialized idempotently when a trusted entitlement read or mutation finds
that the configured end instant has passed.

Sprint 10 manual renewal and immediate cancellation use the same verified
studio-role boundary and transactional/idempotent pattern. Renewal creates a
new Subscription and its allocation without rewriting the prior historical
Subscription or ledger. Immediate Owner/Staff cancellation requires a reason
and atomically reconciles each future confirmed Booking, linked reservation,
capacity update, ledger entry, and audit event; it does not create an Incident
or penalty. Each released credit then expires with its inactive owning
Subscription, cannot fund another Booking, and is not transferred. Exact schema
remains owned by that implementation slice.

Month-based Plan duration is explicit in the assigned historical terms rather
than inferred from a fixed day count. Trusted lifecycle operations compute those
Subscriptions' calendar-month expiry and pause periods in the verified Studio
timezone; fixed-day Subscriptions remain non-pause-eligible.

Sprint 6 attendance mutations use the same trusted server boundary: they derive
the studio and actor from the verified session, re-read the Slot, Booking,
Membership, and reservation in a transaction, enforce BR-07 role/window
eligibility, and atomically persist the factual outcome, credit consumption, and
required audit history. Client-supplied studio, trainer, customer, or booking
context is never an authorization boundary.

Sprint 7 extends only qualifying late-cancellation and no-show source
transitions under BR-08. Its trusted operations derive studio, actor, and
authority from the verified session; use deterministic source identity to make
Incident creation and threshold evaluation idempotent; preserve source history;
and write required audit events without another credit movement. Owner-only
policy/waiver/reversal actions and Staff read-only queries remain tenant-scoped
and bounded. Exact schema, indexes, and implementation details remain owned by
that slice.

### Query and UI state

TanStack Query will own remote client state when Firebase reads are introduced; local UI state remains in components. Keep optimistic updates limited to flows with clear reconciliation behavior. UI routes should include route-level loading and error boundaries when they begin fetching real data.
