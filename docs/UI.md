# UI and experience specification

## Direction

Ember Dark is the default appearance: charcoal backgrounds, raised dark cards,
warm orange actions, and clear sans-serif headings, based on the approved visual
reference. Other built-in studio themes remain available in Appearance. Existing
explicit studio selections are preserved. Customer home includes a studio-time
weekly date picker, real booking markers, a date-filtered list of the bounded
upcoming schedule and a next-class card. Membership and profile remain accessible
through the customer navigation, without extra summary or quick-link cards on home.
Calendar markers describe listed availability and bookings, never workout progress.
The customer date strip shows seven days starting at studio-local today, with
forward navigation; returning to earlier weeks stops at today. Past dates are
not displayed.

The Nature Minimal alternative retains warm off-white surfaces, deep leaf-green
actions, and sage accents. Across themes, keep the experience calm and focused.
Avoid decorative colored side stripes on studio cards and notices. Prefer
neutral dividers and flatter sections, with restrained color in icons, actions,
and explicit status labels.
Use the shared StudioIcon/StudioAction outline icons for studio actions and
section cues. Pair icons with meaningful visible labels; icon-only close and
overflow controls require accessible names. Do not use decorative Unicode
symbols as substitutes for actions or add nonfunctional controls.
Customer booking is mobile-first; operations is desktop-first and responsive.
Workspace data loads on page entry and explicit Refresh, without global polling
or focus-triggered reloads. Successful mutations revalidate affected routes.
Studio activity presents readable event labels with category icons, studio-time
date grouping, and search/category filters over the latest bounded results.
The dashboard uses the same event-label mapping. Display formatting never
changes stored audit records or their ordering.
The studio Classes page leads with searchable, status-filtered class rows.
Create and edit open native modal forms with contained feedback and fixed action
footers on mobile; the class library stays visible without an introductory form.
Membership pauses display recorded allowance used/remaining and explicit
unavailable reasons. The immediate-pause confirmation follows BR-10, keeps errors
inside its native dialog, and formats pause dates in the studio timezone.
The mobile studio menu uses searchable grouped links to implemented screens.
Attendance rosters remain in Schedule and policy controls remain in Incidents;
unimplemented settings/notification shortcuts are omitted. The menu locks page
scroll, contains keyboard focus, and restores focus when dismissed.
Appearance previews a selection locally before saving, labels the saved theme,
and provides pending/success/error feedback. A preview never changes the active
studio theme; persistence continues through the owner-authorized theme action.
Memberships and Pauses share labelled icon navigation. Mobile status filters
show icons and counts without horizontal scrolling; green active/ready, amber
paused, and danger cancelled accents supplement text. Keep color on badges,
icons, and actions rather than decorative card stripes.
Trainer home prioritizes the current/next published session and today’s assigned
schedule. Classes, Attendance, roster and Profile share compact icon navigation
and studio-time context. Drafts are labelled and do not link to attendance;
ended session labels describe time rather than claiming attendance is complete.
Trainer roster actions use a confirmation dialog and follow BR-07; correction
controls stay out of the trainer surface. Profile presents real account/studio
details with functional navigation and sign-out rather than decorative actions.
Trainer home keeps empty schedule states compact, uses one studio-image greeting
header, and presents daily counts and functional Classes/Attendance shortcuts
before the schedule. Never fabricate activity when the assigned schedule is empty.
Availability displayed on a page is a snapshot; booking decisions always use
fresh transactional validation under BR-02 and BR-18. Paginated directories and
histories expose explicit next/first page controls. Studio calendar navigation
loads the selected day, week, or month rather than the entire slot history.

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
  The studio roster includes customer search and outcome filters. Confirm the
  selected customer/outcome and show its BR-07 credit impact before submission;
  marking and reasoned corrections retain their existing trusted authorization.
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
  The studio queue uses session filters and a labelled position per entry.
  Removal opens a reasoned confirmation sheet with the customer and session
  context; errors remain inside the sheet. Timestamps use the studio timezone.
- **Plans and entitlements:** Owner/Staff can create, edit, activate, retire,
  and list Plans; manually renew or cancel customer Subscriptions; view bounded
  ledger history; and make a reasoned adjustment.
  The Subscriptions and Credits boards show one current membership per customer,
  preferring active/paused membership, otherwise the most recent inactive one.
  History exposes previous memberships and their original ledgers from the
  bounded subscription results. Counts, searches, and exports use current rows.
  Renewal records and immutable history continue to follow BR-09 and BR-17.
  Customer cancellation is
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

Studio mobile navigation provides Overview, Schedule, Customers, and More;
More opens the existing role-filtered navigation drawer. Booking and roster
work remains under Schedule. Mobile Overview prioritizes today's next/current
class and roster access; weekly and membership summaries expand under Studio
details. The desktop overview retains its operational layout.

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
