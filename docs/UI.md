# UI and experience specification

## Direction

Retain the established StudioFlow direction: warm off-white surfaces, deep leaf
green actions, sage/clay/sun capacity accents, restrained serif display type,
and clean sans-serif interface text. It should feel calm and considered rather
than clinical or feature-dense. Customer booking is mobile-first; operations is
desktop-first and responsive. Existing shell routes are visual fixtures only.

## Screen map and navigation

| Surface | Primary screens | Navigation |
| --- | --- | --- |
| Customer | Login, password recovery, access denied/account configuration required, onboarding, schedule, slot details, booking confirmation, upcoming booking detail, booking history, membership/credits, pause, notifications, profile | Mobile bottom nav: Book, Bookings, Membership, Profile. Desktop header mirrors these; no studio selector in V1. |
| Trainer | Today, schedule, assigned class detail/roster, attendance confirmation | Mobile: Today, Schedule, Profile. Desktop: compact left rail. No customer-management or plan nav. |
| Staff/admin | Overview, schedule, slot detail/editor, bookings, customer detail, plans/subscriptions, exception queue, read-only Incident context | Desktop left rail: Overview, Schedule, Bookings, Customers, Plans. Responsive compact header/drawer on small screens. |
| Owner | All staff/admin screens plus studio rules, team/roles, audit history, studio settings, and Incident policy/review | Same staff navigation with Settings section; `/studio/team` has a bounded member/invitation list, manually-copyable invitation link, and guarded membership actions. Dangerous/impactful settings have explicit confirmation. |
| Super Admin | Platform provisioning: create studio, configure Super-Admin-controlled settings, assign/create first owner, activate/deactivate studio, ownership/provisioning authority | Dedicated protected `/super-admin` workspace; never appears as a Create Studio action on normal login or studio navigation. |

Route names and URL conventions are implementation decisions for the relevant
sprint. Login contains sign-in only, password recovery, and never Create Studio.
After authentication, the application routes a verified Super Admin to
`/super-admin`; otherwise it resolves one verified Membership and effective role
then routes to the appropriate workspace. An active studio and role context must be visible
in operational surfaces. Multiple-role people may enter another surface for a
role they hold, as defined in `ROLES_PERMISSIONS.md`, but cannot switch studios.

## Customer screen requirements

- **Schedule:** date picker, availability-aware cards, filters only when the
  schedule needs them, and clear trainer/time/duration/capacity information.
- **Class detail:** facts required to decide, available credit context, and one
  primary action: Book, Join waitlist, or unavailable reason. Waitlist states
  follow BR-12–14: position, withdrawal, promotion/Booking, ineligibility, and
  class-start closure; no offer or notification UI exists in V1.
- **Booking confirmation:** explicit class summary, credit impact, and the
  correct cancellation information from BR-05. Never promise persistence before
  the trusted operation completes.
- **Bookings:** upcoming first, then history; detail page supports cancel or
  reschedule only when available and labels a late consequence before commit.
  History may show the customer's own factual `Attended` or `No-show` outcome
  under BR-07, without percentages, analytics, dashboards, or leaderboards.
- **Membership:** active/paused subscription state, usable credits, meaningful
  credit history, plan information, remaining pause allowance, effective expiry,
  and the approved immediate pause action under BR-10.
- **Onboarding/profile:** minimum necessary studio-required details; no health
  or social features without a scope change.

## Trainer, staff, and owner requirements

- **Trainer attendance module:** treat this as a distinct, mobile-first module,
  not an admin CRUD screen. Trainer home emphasizes the next class, then a calm
  scan of today's classes with time, class, trainer, booked/capacity context,
  and one obvious **View roster** action. The roster prioritizes class context,
  a minimal customer list, large fast attendance controls, and one clear
  save/complete action. Its completed state reports attended and no-show
  counts. A locked state explains BR-07 and exposes the reasoned Owner/Staff
  correction action only where authorized. Avoid giant or nested modals, dense
  tables, and decorative status-card grids.
- **Staff/Owner attendance:** provide a scannable today view showing class,
  trainer, booked count, attendance state, and roster access. It follows the
  same attendance module rather than duplicating a second CRUD workflow.
- **Staff schedule/slot editor:** calendar/list switch only when justified;
  creation/edit form captures required class, time, capacity, and trainer data.
  Existing booking impact is surfaced before a change.
- **Staff customer detail:** customer profile, bookings, subscription/credit
  context, bounded read-only Incident context, and history appropriate to Staff
  authority under BR-08.
- **Staff/Owner waitlist:** bounded Slot queue with customer, joined time,
  dynamic position, status, and a reasoned removal action where BR-12 permits.
  Do not show reordering, manual promotion, offers, priority configuration, or
  analytics.
- **Plans and entitlements:** Owner/Staff can create, edit, activate, retire,
  and list Plans; manually renew or cancel customer Subscriptions; view bounded
  ledger history; and make a reasoned adjustment. Customer cancellation is
  end-of-term only. Operator immediate cancellation requires a reason and a
  clear future-booking and released-credit-expiry impact confirmation. Customer
  membership shows active or inactive Subscription status, usable balance, and
  bounded understandable history. Pause controls appear only for an active
  month-based Subscription and explain when a fixed-day plan is ineligible.
  Forms show loading, empty, validation,
  permission, success, inactive, and expired states without claiming payment
  was collected.
- **Exception queue:** only actionable booking, waitlist, attendance, or policy
  exceptions; not a generic notification feed.
- **Owner Incident policy/review:** use a functional minimum—not a redesign—for
  bounded Incident history, current 3-in-30 review state, policy configuration,
  and reasoned waiver/factual reversal. Make clear that review has no automatic
  restriction, credit, fee, or customer-notification effect under BR-08.
- **Owner settings:** plans, policy configuration, team/role management,
  timezone, and audit history. Show impact language before consequential edits.
- **Operations overview:** concise counts/trends and items needing action—not a
  generalized analytics product.

## Shared components

Build reusable components as each vertical slice needs them: login form,
access-denied/account-configuration panel, role-aware app shell, page header,
date selector, slot card, capacity badge,
booking status badge, credit balance, policy notice, empty-state panel, inline
form error, confirmation dialog, toast/result notice, skeleton, roster row,
audit/history timeline, and guarded action button. Components communicate state
through text and icon/colour together; colour alone never conveys availability
or status.

## State and feedback requirements

| State | Requirement |
| --- | --- |
| Loading | Use layout-preserving skeletons for schedule, roster, dashboard, and history; disable duplicate submissions with an in-progress label. |
| Empty | Explain why the list is empty and offer the next relevant action (for example, no upcoming bookings → view schedule). Do not use empty dashboards as decoration. |
| Error | State what failed in plain language, preserve safe form input, provide retry where safe, and distinguish permission, availability conflict, and payment/provider outcomes. |
| Permission denied | Show an access-denied/account-configuration screen or inline denial that identifies the unavailable action without exposing tenant data; provide only the approved recovery/support path. |
| Success | Confirm the result, summarize changed booking/credit state, and provide one useful next action. Toasts supplement—not replace—persistent confirmation when a user needs proof. |
| Disabled / full / unavailable | Explain the reason: slot full, waitlist unavailable, credit unavailable/expired, subscription paused, cutoff passed, or no permission. Disabled controls retain readable labels. |
| Confirmation | Require explicit confirmation for booking, waitlist entry, cancellation, late cancellation, reschedule, attendance/no-show, slot cancellation, plan/policy changes, and timezone/role changes when impact warrants it. Dialogs show material consequence before the final action. |

Disabled user, inactive Membership, or inactive Studio states must route to the
appropriate access-denied/account-configuration presentation; the UI cannot
offer client-side reactivation, studio creation, or studio selection.

## Responsive behaviour

Customer screens prioritize a single-column touch layout, persistent bottom
navigation, 44px minimum interactive targets, and dialogs that become bottom
sheets when appropriate. Staff/owner tools favor tables/lists and contextual
side panels on desktop; at smaller widths, collapse to cards and an accessible
navigation drawer without removing actions. Trainer flows favour the fast mobile
roster path while retaining a desktop schedule view.

## Accessibility baseline

- Meet WCAG 2.2 AA colour contrast, keyboard reachability, visible focus,
  semantic headings, labelled inputs, and error messages associated with inputs.
- Use native buttons/links correctly; dialogs trap focus, announce their title,
  close predictably, and return focus to their trigger.
- Announce asynchronous booking/attendance results with appropriate live-region
  semantics; never rely on transient colour or animation alone.
- Date/time controls expose studio timezone and have accessible text equivalents.
- Respect reduced motion and do not make time-critical policy text disappear.
