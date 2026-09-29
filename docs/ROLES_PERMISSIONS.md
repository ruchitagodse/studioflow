# Roles and permissions

This document defines product authorization; tenant enforcement is governed by
BR-18 in `BUSINESS_RULES.md`. “View” means only within the verified assigned
studio. Super Admin authority is governed by BR-19 and is not a Membership role.

| Capability | Customer | Trainer | Staff/admin | Owner |
| --- | --- | --- | --- | --- |
| View published schedule and class details | Own booking context | Assigned classes | All classes | All classes |
| Create/manage own booking, cancellation, reschedule, waitlist entry | Yes | No | On behalf of customer | On behalf of customer |
| View/remove studio waitlist entries | Own entry only | No | View; remove with reason | View; remove with reason |
| View own subscription, credits, history | Yes | Own customer record if applicable | All customers | All customers |
| Request or assist subscription pause | Own Subscription only | No | Assist within studio | Assist within studio |
| View class roster / own attendance outcome | Own attendance outcome in own booking history | Assigned slots only | All slots | All slots |
| Mark attendance/no-show | No | Assigned slots only | All slots | All slots |
| Correct attendance | No | No | All slots; locked correction follows BR-07 | All slots; locked correction follows BR-07 |
| Create/edit/cancel slots and assign trainers | No | No | Yes | Yes |
| Manage customer records and customer-service bookings | Own profile only | No | Yes | Yes |
| Manage plans and customer subscriptions | No | No | Yes | Yes |
| Request subscription cancellation | End-of-term own Subscription | No | Immediate or end-of-term with reason | Immediate or end-of-term with reason |
| Make a reasoned manual credit adjustment | No | No | Yes | Yes |
| View Incident records / review state | No | No | Read-only | Yes |
| Configure Incident policy; waive or factually reverse an Incident | No | No | No | Yes |
| Provision/invite customer, trainer, or staff/admin Membership | No | No | No | Yes |
| View operational dashboard/audit history | No | Own assigned operational context | Operational records needed for work | All studio operational/audit records |
| Manage non-owner staff/trainer roles and studio settings | No | No | No | Yes |

## Super Admin

Super Admin is a platform-level authority. It uses the dedicated protected
`/super-admin` workspace, not a studio workspace. It can create, activate,
deactivate, or archive studios; configure platform-level studio settings; assign
or create the initial Studio Owner; and manage ownership/provisioning authority.
There is no public Super Admin registration; authority is granted through the
controlled bootstrap process. Its actions require platform audit history under
BR-19.

## Role constraints

- Customers never see another customer's identity, contact information, credit
  balance, booking history, incidents, or attendance.
- Trainers see only the minimum roster data necessary for their assigned slots;
  they do not manage plans, customer accounts, policy, or unrelated slots.
- Staff/Admin may read Incident records within their verified studio but cannot
  configure policy, waive, reverse, or alter threshold-review state; those
  actions are Owner-only under BR-08.
- Attendance authority, timing, locked-state correction, and historical
  preservation are governed by BR-07. A customer can see only their own factual
  attendance outcome; they cannot view another customer's attendance or mark an
  outcome.
- Staff/admin actions affecting a customer must state an operational reason when
  the action is an adjustment, override, or exception; normal customer service
  actions still create the audit required by BR-17.
- Owners have studio-wide authority but cannot access another studio by holding
  owner status elsewhere.

## Multiple roles

In V1, Membership holds a set of roles for one person at exactly one assigned
studio. The effective permission is the union of those roles, restricted to that
studio. A role-aware route may show the appropriate workspace or allow a person
to enter an additional surface for a role they hold, but there is no studio
switching. Actions record the person and authority used. An owner who is also a
customer may make their own booking as a customer; staff acting for a customer
must use the staff path and record that context.

There is no global studio role. Super Admin is the distinct platform authority.
Owners provision/invite non-owner Memberships and manage non-owner role changes;
Super Admin manages ownership/provisioning authority. All membership and role
changes follow BR-17, BR-18, and BR-21.
