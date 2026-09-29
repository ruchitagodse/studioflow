# StudioFlow product brief

## The product

StudioFlow helps a small or medium Pilates studio run its class schedule and customer bookings. It is not a fitness marketplace, an on-demand workout library, or a full gym operating system.

The product has four studio roles: customer, trainer, studio staff/admin, and
studio owner. A person may hold more than one of these roles in their one
assigned studio. Super Admin is a separate platform-level authority, not a
studio role.

Studio creation is a platform operation performed by a Super Admin. There is no
customer-facing, trainer-facing, staff-facing, or owner-facing “Create Studio”
path, and login is login-only.

Owner team provisioning uses secure invitation links that the Owner copies and
shares manually in V1. StudioFlow does not send invitation email in this slice,
and Firebase password recovery is never used as an invitation mechanism.

Initial launch is India, with INR as the currency and English as the primary
application language. Payment-provider-specific behaviour remains deferred.

## Product boundary

The initial product concentrates on scheduled group classes and bookable slots:

- Customers discover availability, book, manage bookings, join waitlists, and understand their active plan and remaining credits.
- Staff create class slots, assign trainers, set capacity, manage customers and plans, and handle booking exceptions.
- Trainers see their assigned schedule, class rosters, and record attendance or no-shows.
- Owners receive a concise operational view, rather than a complex BI suite.

Not yet in scope: multi-studio consumer discovery or user studio switching,
live streaming, workout content, retail/POS, payroll, trainer marketplace,
social/community feeds, hardware access control, or generalized gym membership
features.

## Business rules

`BUSINESS_RULES.md` is the authoritative rule source. In particular, the
two-hour cancellation boundary is inclusive (`cancelledAt <= startsAt - 2 hours`),
all booking-sensitive operations are trusted and atomic, and tenant isolation is
non-negotiable. Do not duplicate or alter operational rules in this brief.

## Experience principles

- Booking should feel confident: show date, time, trainer, duration, location, capacity context, and the effect on credits before confirmation.
- Explain constraints before an irreversible action, especially cancellation cutoffs and penalties.
- Make the next useful action unmistakable; avoid crowded dashboards.
- Use warm, quiet visual language that supports a premium studio atmosphere.
- Account for loading, empty, error, success, keyboard, and small-screen states in every user-facing flow.
