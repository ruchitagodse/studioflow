# Firestore read optimization — 2 November 2026

## Outcome and scope

Removed recurring workspace reads, centralized quota protection, reused trusted
document snapshots within each request, and bounded the principal list/history
loaders. Collection names, document structures and Firestore security rules are
unchanged. Required query indexes were deployed to `bookingsystem-27cdc` using
`firebase deploy --only firestore:indexes --project bookingsystem-27cdc --non-interactive`.
Application source changes remain in the local workspace; this is not a GitHub
main push or application deployment.

The objective is lower read consumption, not a promise that arbitrary traffic
will always fit the Spark allowance. Existing exhausted quota is not restored by
changing code. Production usage must still be monitored.

## 1. Audit findings before implementation

- The single global `WorkspaceLiveRefresh` effect used a 60-second interval,
  previously 15 seconds. It refreshed the current route on focus and visibility
  changes too. Customer/trainer and staff shells both installed this component.
  Cleanup existed, so this was avoidable polling rather than a listener leak.
- `BookingManagementActions` explicitly refreshed after mutations that already
  called `revalidatePath`, causing redundant refresh requests.
- Auth resolution already used React request memoization, but shell, appearance,
  profile and display loaders independently reread studio/member documents.
- Customer bookings eagerly loaded both tabs, a complete candidate reschedule
  schedule, subscription state and waitlist markers on every opening.
- Trainer names were fetched once per slot/booking rather than per distinct
  trainer. Legacy bookings could also reread their related slots.
- Subscription display paths reread member/subscription records and entered an
  expiry transaction even when a future active subscription required no change.
- Trainer/dashboard/incident/membership counters fetched complete records to
  count them. Studio slot history and several directories were unbounded.
- Plans and pauses fetched unrelated subscription/customer/plan data through the
  shared entitlement loader.
- There were no `getDoc`, `getDocs`, `onSnapshot`, browser Firestore imports,
  recurring client fetch loops, or auth-state Firestore subscriptions. Firebase
  reads use the trusted Admin SDK. React Strict Mode therefore did not install
  duplicate Firestore listeners. Normal form/session fetches remain event-driven.
- The remaining zero-delay `setTimeout` closes a schedule editor after success;
  it does not fetch data and is not recurring.

The repeatable static inventory is `firestore-read-inventory.json`; regenerate
with `npm run audit:reads`. It lists call sites, not measured production reads.

## 2. Polling, navigation and mutation refreshes

- Deleted `app/components/workspace-live-refresh.tsx`, including its timer,
  focus listener and visibility listener. Idle visible and hidden tabs now issue
  **zero application polling requests**.
- Added an explicit, pending-disabled Refresh button in workspace headers.
- Disabled Next Link prefetch throughout app navigation so a visible link does
  not preemptively read another protected route.
- Removed duplicate cancellation/reschedule `router.refresh()` calls. Existing
  Server Action route invalidation remains responsible for updating affected
  booking, schedule and entitlement views after successful mutations.
- Booking and subscription changes still run trusted transactions. An outdated
  displayed seat/credit count cannot authorize a booking.

## 3. Cache strategy, authorization and invalidation

`lib/firebase/reads.ts` provides:

- `readDocument(path)`: React `cache` memoization for one Server Component request.
  The full path, including verified studio and member IDs, is the cache key.
- `readQuery(query)`: a fresh query through the shared quota guard. Successful
  query results are not cached across explicit refreshes.
- `withFirestoreQuota(operation)`: the same quota boundary around transactions.

Auth, studio status, tenant-owned membership and membership index are verified
afresh on each protected request. Layouts/components within that request reuse
the same verified documents. No successful authorization result is stored in a
process-wide cache, localStorage or an additional client role cookie.

**Deliberate security choice:** membership is not trusted for an entire session.
Doing so would allow removed roles or deactivated studios to remain accessible.
Custom claims were considered but not introduced: without a complete revocation
and claim-refresh contract they would be a second, potentially stale authority.
This preserves the existing BR-18/BR-21 enforcement and the authenticated session
cookie's revocation check. It leaves four authorization document reads per fresh
protected request, rather than bypassing revocation to save those reads.

Current rules deny all direct browser Firestore access. Admin SDK reads bypass
those rules by design, so trusted server authorization remains essential. Rules
were not loosened to add browser caching or listeners.

Request caches end with the request, so there is no cross-request mutation
invalidation race. Successful mutations retain their route revalidation. Explicit
fresh reads bypass request memoization after subscription expiry/resumption or
waitlist lifecycle writes in the same request. Transaction reads are never
replaced by cached snapshots.

## 4. Queries and page loaders

- Customer home fetches published future slots only (maximum 60), with only
  future confirmed booking markers. It no longer loads an unused subscription.
- Slot detail reads that slot, one matching confirmed booking and the direct
  deterministic waitlist document instead of two 50-record history scans.
- Bookings renders only the selected Upcoming or History view. It uses ordered
  20-record pages and a count aggregation for the Upcoming label. The mapper
  preserves query order and the implicit document-ID tie-breaker: Upcoming is
  earliest first and History latest first, including across cursor pages. History
  includes past records and terminal future bookings. Reschedule candidates are
  fetched only when the user opens Reschedule; mutation-time validation is fresh.
- Studio calendar queries only the selected studio-local day/week/month. The
  existing calendar controls now navigate to those server query windows. Pages
  contain at most 40 slots; selected period and cursor are preserved in URLs.
- Classes, customers, staff, trainer directory and platform studios use
  25-record cursor pages. Trainer assignment summaries load up to 100 future
  slots for the trainers on the selected directory page, with their own cursor.
  These summaries explicitly describe upcoming assignments, rather than reading
  all historical slots to build a directory row.
- Cursor pages use `limit(size + 1)` and `startAfter(snapshot)`, preserving equal
  sort values through Firestore's implicit document-ID ordering. The lookahead
  costs at most one extra document. A subsequent page costs up to one cursor
  document lookup. Cursor IDs reject path separators/control characters; the
  collection path always comes from trusted server context, never browser input.
- Schedule selectors fetch active classes/trainers; display names missing from
  those selectors may require separate member lookups on other detail screens.
- Plan-only screens do not load customers or subscriptions. Pause-only screens
  skip plans. Other entitlement boards retain their bounded shared data needed
  by renewal/assignment controls and membership history.
- Trainer roster totals, grouped studio attendance totals and incident review
  totals use count aggregations rather than loading whole rosters/history
  documents. Customer reserved passes come directly from the owned subscription's
  ledger-maintained `reservedCredits`; there is no all-plan booking-count query.
  This excludes previous-plan reservations while retaining unresolved past
  reservations under BR-03. Existing bounded incident-count behavior and all
  transactional policy checks are preserved.
- Ledger and assignment projections use `select` where practical to reduce
  payload. Selecting fields does **not** itself reduce billed document reads.

## 5. Quota errors and listener lifecycle

Every production SDK `.get()` and `runTransaction` call in `app`/`lib` now passes
through the shared quota boundary. Regression tests enforce this architecture.
Resource-exhausted codes (numeric gRPC 8 and SDK string variants) become a safe
service error. Authentication, permission and validation errors are not retried
or relabeled as quota failures.

There are **zero automatic application retries**. After a quota failure, the
process rejects further database operations before making SDK calls during a
cooldown. Subsequent manual attempts back off exponentially from 60 seconds,
with up to 20% jitter, four backoff steps and a maximum five-minute cooldown.
Success resets the failure sequence. Manual retry remains available on the
service/error screen, without a timer or redirect loop.

The guard is process-local. Separate server instances have separate cooldowns;
already-started concurrent calls cannot be recalled. Firebase's transaction
conflict retries remain intact to preserve atomicity. This guard does not replace
quota monitoring or impose an application-wide distributed rate limit.

There are no production Firestore listeners to unsubscribe or duplicate. The
former focus/visibility listeners and their automatic refresh effects are gone.
No new browser data subscription or background fetch was introduced.

## 6. Estimated consumption

These are arithmetic examples, **not production measurements**. Assume one
workspace stays visible for eight hours and each load costs 30 document reads,
with ten explicit refreshes during the day. Navigation and mutations are extra.

| Scenario | Loads in eight hours | Estimated reads |
| --- | ---: | ---: |
| Original 15-second timer + initial load | 1,921 | 57,630 |
| Interim 60-second timer + initial load | 481 | 14,430 |
| No polling: initial load + ten manual refreshes | 11 | 330 |

Removing polling alone reduces this example by approximately 99.4% versus the
original timer, or 97.7% versus the interim timer. Per-load query improvements
are additional and depend on actual data sizes.

Other examples:

- Auth + default theme + shell: seven duplicate document reads can become four
  distinct request reads. Including profile's repeated studio/member reads,
  nine can become four when these components render in the same request.
- Twenty classes with the same trainer previously fetched that member twenty
  times; request reuse fetches it once.
- The former membership booking scan/count is eliminated entirely: the current
  subscription already contains the ledger-maintained reserved balance. This
  removes one aggregation request per membership view in addition to correcting
  cross-plan counts. A dashboard with twenty eight-person rosters previously
  loaded up to 160 booking records;
  grouped attendance counting needs three aggregation requests instead.
- A 1,000-slot studio history previously loaded every slot whenever the schedule
  opened; it now loads at most 41 within the requested period (40 plus lookahead),
  excluding required class/trainer selector reads.

For typical counts of up to 1,000 matched index entries, an aggregation is billed
as one read, with a one-read minimum. Larger counts can cost more. See the
[official Firestore pricing documentation](https://firebase.google.com/docs/firestore/pricing).
The [free-tier usage limits](https://firebase.google.com/docs/firestore/quotas)
still apply to the project as a whole.

## 7. Validation

- `npm run lint`: passed without warnings.
- `npm run typecheck`: passed.
- Production build on Node 22: passed; all application routes compiled using
  `npm exec --yes --package=node@22 -- node node_modules/next/dist/bin/next build`.
- `npm run test:emulator`: isolated `demo-studioflow` project, localhost Firestore
  emulator, with no production fixture writes: **126 tests passed in 23 files**
  (all existing 118 plus eight permanent regressions), including fifteen
  SDK/Firestore integration tests. The contention test has a
  20-second allowance for real SDK transaction-conflict backoff; its final run
  completed in about three seconds. Late cancellation and the two-hour
  rescheduling cutoff also passed in the emulator.
- New regressions cover three Upcoming pages with ties and prior-cursor/First
  page navigation, multiple History pages, actual renewal with immutable old
  ledger snapshots, current-plan bookings, mixed historical/current bookings,
  another customer/studio, unresolved past reservations, current rescheduling
  and cancellation, and old-plan cancellation without credit transfer.
- Tests cover session restoration, session revocation, membership changes,
  deactivated studios, different users/studios, read deduplication by tenant,
  quota cooldown/jitter, zero polling, central query guards, calendar periods,
  cursor pages with equal timestamps, booking/cancellation/rescheduling,
  concurrent capacity, reservation balances and subscription ownership.
- Existing rule suites cover attendance/no-show, subscription/credit lifecycle,
  incident restrictions and waitlists.
- Production browser navigation across authenticated dashboards was not fully
  exercised while the project's live quota was exhausted. A successful build is
  not a claim of end-to-end browser coverage. Backend flows were exercised in the
  emulator; authorized UI verification can resume after live quota recovery.
- Index deployment succeeded. Composite indexes can take time to finish building.

### Production-readiness corrections

The subsequent review reproduced two missed cases despite the original 118
passing tests. Both are now fixed in read-model code only: `bookingViews` no
longer re-sorts query pages, and `getCustomerEntitlement` reads the resolved
subscription's authoritative reserved balance. No authentication, UI, transaction,
historical ledger, rules, schema or index changes were required. The eight new
regressions above exercise the fixes and existing credit lifecycle operations.
No production push or deployment was performed for these corrections. Production
browser verification remains pending verified quota recovery and authorized
smoke tests; emulator results are not production verification.

## 8. Remaining potential read costs

- Every protected request intentionally retains fresh authorization reads.
- Active class/trainer selector catalogs and approved platform palettes remain
  complete catalogs. Very large catalogs may warrant searchable picker endpoints
  later; arbitrary truncation would hide valid choices.
- Studio dashboard today and weekly chart queries overlap. Both remain bounded;
  combining them blindly could drop today's data once the weekly limit is hit.
- Existing bounded operational views still load up to 50 subscriptions/incidents,
  100 waitlist entries, and relevant related records. Large studios or many
  explicit refreshes can still consume substantial quota.
- Trainer display/count pages retain the existing 100-assigned-slot bound.
  Membership boards retain their existing 50-subscription history window. These
  are documented pre-existing completeness limits, not newly unbounded scans.
- Count aggregations, cursor lookaheads, related documents, real transactions,
  conflict retries and Firebase Console browsing still consume read quota.
- Client-side table search operates on the loaded page. Use page controls to
  inspect further results; this is not a global full-text search implementation.
- Live read totals and traffic attribution were not available from the source
  audit. Check the Firebase Usage dashboard after rollout; this report does not
  assert a measured cause or a guaranteed daily budget.

## Implementation file index

The companion inventory lists every database call site. Principal implementation
files and navigation changes are listed below.

- `.gitignore`
- `app/components/customer-bookings-readable.module.css`
- `app/components/workspace-refresh.tsx`
- `app/customer/actions.ts`
- `app/error.tsx`
- `app/studio/entitlements/data.ts`
- `app/studio/pause-requests/page.tsx`
- `app/studio/plans/page.tsx`
- `app/access-denied/page.tsx`
- `app/components/admin-header.tsx`
- `app/components/admin-sidebar.tsx`
- `app/components/customer-booking-shell.tsx`
- `app/components/customer-bookings-tabs.tsx`
- `app/components/customer-schedule.tsx`
- `app/components/customers-manager.tsx`
- `app/components/invitation-acceptance.tsx`
- `app/components/list-pagination.tsx`
- `app/components/login-form.tsx`
- `app/components/studio-dashboard.tsx`
- `app/components/trainer-manager.tsx`
- `app/components/workspace-refresh.tsx`
- `app/components/workspace-shell.tsx`
- `app/customer/actions.ts`
- `app/customer/bookings/page.tsx`
- `app/customer/page.tsx`
- `app/customer/profile/page.tsx`
- `app/forgot-password/page.tsx`
- `app/studio/activity/page.tsx`
- `app/studio/classes/page.tsx`
- `app/studio/customers/[customerUid]/page.tsx`
- `app/studio/customers/page.tsx`
- `app/studio/entitlements/data.ts`
- `app/studio/schedule/page.tsx`
- `app/studio/staff/page.tsx`
- `app/studio/theme/page.tsx`
- `app/studio/trainer/page.tsx`
- `app/studio/waitlist/page.tsx`
- `app/super-admin/page.tsx`
- `app/trainer/attendance/page.tsx`
- `app/trainer/classes/page.tsx`
- `app/trainer/page.tsx`
- `app/trainer/profile/page.tsx`
- `docs/ARCHITECTURE.md`
- `docs/UI.md`
- `firebase.json`
- `firestore.indexes.json`
- `lib/attendance.ts`
- `lib/auth/server.ts`
- `lib/bookings.ts`
- `lib/brand-palettes.ts`
- `lib/customer-membership.ts`
- `lib/entitlements.ts`
- `lib/firebase/pagination.ts`
- `lib/firebase/quota.ts`
- `lib/firebase/reads.ts`
- `lib/incidents.ts`
- `lib/provisioning.ts`
- `lib/schedule-window.ts`
- `lib/schedule.ts`
- `lib/studio-theme.ts`
- `lib/team.ts`
- `lib/trainer-schedule.ts`
- `lib/waitlist.ts`
- `lib/attendance.ts`
- `lib/auth/server.ts`
- `lib/bookings.ts`
- `lib/brand-palettes.ts`
- `lib/customer-membership.ts`
- `lib/entitlements.ts`
- `lib/incidents.ts`
- `lib/provisioning.ts`
- `lib/schedule.ts`
- `lib/studio-theme.ts`
- `lib/team.ts`
- `lib/trainer-schedule.ts`
- `lib/waitlist.ts`
- `package.json`
- `scripts/audit-firestore-reads.mjs`
- `tests/auth-server.test.ts`
- `tests/booking-membership-regressions.emulator.test.ts`
- `tests/firestore-emulator.test.ts`
- `tests/firestore-policy.test.ts`
- `tests/firestore-quota.test.ts`
- `tests/firestore-reads.test.ts`
- `tests/schedule-window.test.ts`
- `tests/server-only.ts`
- `vitest.config.ts`

`app/components/workspace-live-refresh.tsx` was removed.
