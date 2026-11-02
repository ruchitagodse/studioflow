# Production-readiness review — 2 November 2026

**Decision: both reproduced correctness findings are fixed and regression-tested;
deployment remains on HOLD pending production browser testing after verified
quota recovery and hosting checks.** No commit, branch
push, merge, application deployment, or production database-record change was performed in
this review. Production index metadata was inspected read-only.

## Findings and completed corrections

### P2 — Upcoming ordering conflicts with cursor ordering

Location: `lib/bookings.ts:181–191`.

The Upcoming query orders `slotStartsAt` ascending, but `bookingViews` sorts every
returned page descending. Three future classes in chronological order
`one, two, three` display as `three, two, one`. With multiple pages, each page is
reversed independently, so the overall list is not chronologically ordered.

Reproduced against the isolated Firestore emulator: expected
`[one, two, three]`, received `[three, two, one]`.

**Fixed:** the mapper preserves the query's ordered documents without sorting
again. Upcoming remains ascending, History descending, and cursor construction is
unchanged. Permanent emulator regressions cover three Upcoming pages, multiple
History pages, equal timestamps at page boundaries, no duplicates/missing items,
revisiting a previous cursor URL (browser Back) and First page. The existing UI
offers First/Next controls; no new Previous button or unrelated UI was added.

### P2 — A renewed plan displays reservations from previous plans

Location: `lib/entitlements.ts:211–221`.

The current subscription is correctly resolved and ownership-checked, but its
displayed reserved count comes from all of that customer's future confirmed
bookings in the studio. The count is not restricted to the current subscription.

Reproduction: an expired subscription retains one valid future reservation; a new
subscription has eight available and zero reserved credits. The current plan UI
reports eight available and one reserved, despite that reservation belonging to
the old plan. This is an existing display issue retained in the optimized query,
not evidence of a new ledger write or a transfer of credits.

Reproduced against the emulator: expected current-plan reserved count `0`,
received `1`.

**Fixed:** the credit-balance metric now uses the resolved, ownership-checked
subscription's authoritative `reservedCredits`, which existing transactions
maintain with its immutable ledger. The all-plan count query is removed. Old
reservations stay with the old plan; unresolved past reservations stay reserved
until their recorded outcome under BR-03. The all-plan Upcoming booking label
remains separate. No old ledger entries, old subscriptions, transaction logic or
authentication checks were modified. Tests verify actual renewal, old ledger
immutability, current reservations, mixed history, tenant/customer separation,
rescheduling and both old/current-plan cancellation balances.

The original 118 tests missed these cases, which temporary review reproductions
confirmed. Eight permanent regressions have now been added in
`tests/booking-membership-regressions.emulator.test.ts`. The complete emulator
suite passes **126 tests in 23 files**, including all original 118. Lint and
typecheck also pass. Production browser verification remains pending.

## Verified checklist

| Area | Evidence and result |
| --- | --- |
| Audit reviewed | Reviewed `FIRESTORE_READ_AUDIT.md`, the generated read inventory, source changes and their stated limitations. |
| Change baseline | Remote main verified as `08cd5835141b5a7f273afeee9a4a3cfff093bb50` using `git ls-remote`. Working branch is `master`, still based on the initial create-next-app commit. |
| Change scope | Ignoring line-ending differences, 69 modified files, 27 additions and one removed polling component differ from the published baseline in reviewed source/configuration trees. These include earlier UI/auth/renewal work, not just read optimization. See `PRODUCTION_REVIEW_FILES.json`. |
| Polling/focus reloads | Zero application `setInterval`/Firestore listeners in the inventory. Refresh is explicitly user-triggered. The remaining zero-delay editor-close timer performs no I/O. Invitation refresh is event-driven; successful business mutations retain targeted route invalidation. |
| Membership caching | React request memoization only; full tenant paths form document keys. No global successful principal cache, client role authority or new custom claims. Every protected request verifies the session with revocation checking and resolves the tenant-owned member/studio records. |
| Tenant isolation | Server derives studio from verified membership; direct client Firestore access remains denied. No rules or collection/document schema changes. Admin SDK bypasses rules, so the server checks remain the authorization boundary. |
| Transactions | Compared 37 mutation function declarations with the published baseline, normalizing only quota/read wrappers. No remaining mutation-function differences. Transaction reads and balance/ledger/audit writes remain atomic and uncached. |
| Business and regression tests | Complete emulator run passed 126 tests in 23 files: the original 118 plus eight permanent regressions. Fifteen SDK integration cases cover the existing lifecycle operations and both fixes. Unit suites cover attendance/no-show, incidents, subscriptions and waitlists. This is not production verification. |
| Index definitions | All 15 declared indexes match the live project's definitions. All 15 are `READY`; no declared index is missing. Checked through Firestore Admin metadata without reading customer documents. |
| Local environment | Required Firebase web/Admin variables present. Web/server project IDs match; service-account email matches the project; private key parses. Current session lifetime is valid. Secret values were not printed. |
| Emulator separation | No emulator variables found in `.env.local` or the current process. Test fixtures explicitly use `demo-studioflow` and require a localhost emulator. |
| Runtime/build | Machine default is Node 24.20.0; package requires Node 22.x and firebase-admin requires Node >=22. Downloaded a temporary Node 22.23.4 runtime without changing project dependencies; production build passed on Node 22. |
| Browser bundle | No Admin private-key marker, `FIREBASE_PRIVATE_KEY` or `FIREBASE_CLIENT_EMAIL` found in `.next/static`. Admin modules retain server-only boundaries. |
| Build configuration | Standard Next server deployment; no static-export configuration. Session cookies are HTTP-only, SameSite=Lax, and Secure in production. Firebase configuration covers rules/indexes/emulator, not a Next application hosting deployment. |
| Git hygiene | `.env*`, build artifacts, dependencies and emulator logs are ignored. Several root-level diagnostic screenshots remain untracked and must not be staged. The blank `.env.example` is also ignored and requires a deliberate allowlist decision. |

The Firestore Admin metadata API initially returned string enums, while the
comparison expected numeric enums. That comparison was corrected before drawing
the conclusion above: all definitions match. No index changes were made during
this review.

## Pending before deployment

- [x] Correct both reproduced findings and add permanent regression tests.
- [x] Rerun lint, typecheck and the full emulator suite after the corrections.
- [x] Rerun the production build on Node 22 after the corrections: passed.
- [ ] Review cache behavior in actual Next requests; unit tests mock React request
      boundaries and Firebase session verification.
- [ ] Confirm Firestore quota recovery through authorized operational monitoring.
- [ ] Run production-browser smoke tests only after recovery: sign-in/session
      restoration; customer, trainer and staff navigation; calendar day/week/month
      changes; multiple pagination pages; booking/cancellation/rescheduling;
      current membership plus old reservations; role revocation; and two-studio
      isolation using authorized test accounts.
- [ ] Observe the browser network panel for idle, hidden-tab and focus changes.
      Confirm there is no automatic route refresh or listener duplication and
      that successful actions update the affected view once.
- [ ] Check deployed hosting environment variables, Firebase authorized domains,
      HTTPS and runtime settings. The local `.env.local` check does not verify
      the hosting provider's configuration; no hosting project binding or
      production CI workflow was available in this checkout.
- [ ] Observe actual Firestore read usage after controlled smoke testing. The
      audit's 99.4% example is arithmetic, not a measured production reduction.

No authenticated production browser smoke test was performed in this review.
Quota recovery itself was not established by the index metadata check.

## Remaining risks and read costs

- Four authorization document reads per fresh protected request are intentional.
- Three complete catalogs remain: active classes, active trainers and approved
  platform palettes. Large catalogs may need searchable selectors later.
- Dashboard daily/weekly queries overlap; bounded membership, waitlist, related
  name/slot lookups and count aggregations still cost reads. A 50-subscription or
  100-slot window is not a complete history for a large studio.
- The quota cooldown is per server process; multiple instances and already
  in-flight operations can still consume quota. SDK conflict retries are retained.
- Pagination uses one lookahead and potentially one cursor-document read. Deleted
  cursors currently restart the first page. Client table filtering/count labels
  refer to loaded data; smoke-test that these limitations are understandable.
- Lazy reschedule requests need browser verification for network failures,
  cancellation, pending-button recovery and successful action refresh behavior.
- Firebase CLI and Java are external prerequisites for emulator testing; `npm ci`
  alone does not install them. Pin their versions in CI when CI is configured.
- Returning to a previously deployed application version could restore the old
  polling behavior. Any rollback must account for that read-consumption risk.

## Safe commit and push plan — not executed

1. Preserve the current workspace and its unrelated/uncommitted work. Do not reset
   `master`, force-push, or run `git add .` here.
2. With the fixes verified, fetch origin and create an isolated worktree on a
   branch such as `codex/firestore-read-optimization` from fresh `origin/main`.
   If remote main changed, repeat the comparison against the new commit.
3. Copy only explicitly reviewed application/configuration/test/documentation
   files into that worktree. Keep existing upstream-only files such as `CLAUDE.md`.
   Explicitly record removal of `workspace-live-refresh.tsx`.
4. Separate earlier UI/auth/renewal changes from optimization changes into
   independently reviewable commits where practical. If they must ship together,
   the PR title/body must describe the full combined scope.
5. Exclude `.env.local`, all service-account keys, `.next`, dependencies, debug
   logs, root diagnostic screenshots and temporary review evidence. Include a
   blank `.env.example` only after inspecting it and explicitly staging it.
6. Review `git diff --cached --check`, `git diff --cached --stat`, the complete
   staged diff and a secret scan. Confirm package/lock consistency and unchanged
   security rules. Run all checks from the clean worktree using Node 22.
7. Commit to the review branch. Any authorized push should be
   `git push -u origin codex/firestore-read-optimization`, followed by a PR and an
   isolated preview deployment. Do not use a preview with production fixture data
   or bulk-write smoke-test fixtures into the live project.
8. Finish the quota-recovery production-browser checklist and read monitoring.
   Present the exact PR/commit, full scope, checks and remaining risks for review.
9. **Obtain explicit confirmation before merging or pushing anything to main.**
   No main push or merge is authorized by this review request.

Added indexes are backward-compatible and can remain during an application
rollback. No data migration or security-rule rollback is needed for the read
optimization itself. The application hosting/deployment path must be confirmed
separately from the successful Firestore index deployment.

## Fix completion and final diff review

The correction pass changed only `lib/bookings.ts`, `lib/entitlements.ts`, the
new eight-case emulator regression file, the two requested audit/review documents,
and regenerated `firestore-read-inventory.json`. Compared with the start of the
correction pass, all 14 mutation function declarations in the two edited modules
are byte-for-byte unchanged. Authentication, tenant validation, pagination
controls/cursor implementation, UI, indexes and deployment configuration were not
edited. Existing historical ledger entries were not changed; emulator cases use
isolated test fixtures and verify immutable old entries across renewal/cancellation.

Final verification:

| Command/check | Result |
| --- | --- |
| `npm run test:emulator` | 126 passed, 23 files; original 118 plus eight new cases, fifteen total SDK integration cases |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm exec --yes --package=node@22 -- node node_modules/next/dist/bin/next build` | Passed |
| Generated read inventory | 0 polling sites, 0 browser Firestore listeners; one fewer aggregation call site |
| Source diff | Two read-model fixes only; no mutation/auth/UI changes |
| Production activity during correction pass | No production deployment, main push or production data changes |

Both code findings are resolved. Remaining deployment gates are the unchecked
production-browser, quota-recovery, hosting and monitoring items above. Use the
isolated `codex/firestore-read-optimization` worktree/PR plan above; obtain explicit
approval before any eventual main merge/push or production deployment.
