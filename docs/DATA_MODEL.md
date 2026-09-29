# Conceptual data model

This is a relationship and lifecycle model, not a Firestore schema. Field names,
document placement, indexes, denormalization, and rules belong to the sprint
that implements the relevant vertical slice. All entities are studio-scoped
except User and platform Super Admin authority; see BR-18 and BR-19 in
`BUSINESS_RULES.md`.

| Entity | Purpose and relationship | Lifecycle / important states |
| --- | --- | --- |
| User | Authenticated human identity. In V1, has zero or one studio Membership; may separately hold bootstrap-provisioned platform Super Admin authority. | Provider account lifecycle is provisioned, enabled, disabled, or recovery-pending; disabled users cannot access the application (BR-21). |
| Studio | Tenant and policy boundary. Created/activated by Super Admin; owns operational entities and an IANA timezone established during provisioning. | Provisioning, active, deactivated, archived (BR-19); a deactivated studio blocks studio and customer access (BR-21). |
| Membership | Joins one User to their one assigned Studio with role set and role-scoped profile. Customer, trainer, staff/admin, and owner are studio roles; Super Admin is not. A trainer is this existing Membership, not a separate entity; V1 needs only its display name. | Active or inactive (BR-21); invitation state belongs to Invitation, not Membership. |
| Invitation | Owner-created request for a non-owner Membership. Stores intended email, requested roles, expiry, and a secure token hash; it never stores a password or raw token. | Pending, accepted, expired, or revoked (BR-21). Pending grants no studio access. |
| Class | Reusable Pilates offering, such as Foundations; provides defaults for future slots. | Draft, active, retired; retiring does not erase historical slot identity. |
| Slot | Dated occurrence of one Class, capacity, one assigned trainer Membership, and local start/end. Has many bookings and waitlist entries. | Draft, published, cancelled, completed (BR-01, BR-15). |
| Booking | Customer's claim on a Slot, linked to one credit reservation when credit-backed. | Confirmed, cancelled-free, cancelled-late, attended, no-show, voided (BR-04). |
| Plan | Studio fixed-credit entitlement template with informational INR price, credit allocation, and either fixed-day validity or a positive whole-number `durationMonths`. Month duration is explicit; fixed days are never inferred as months. Assigned terms are retained by each Subscription. | Draft, active, retired; retirement preserves subscriptions/history and prevents new assignment (BR-09). |
| Subscription | Customer's historical instance of a Plan, with its assigned entitlement terms and end date. It governs whether linked credits are usable. A customer has at most one active Subscription in its studio. Each manual renewal creates a new instance and allocation; the prior instance remains historical. A month-based Subscription snapshots `durationMonths` and has calendar-month expiry; fixed-day Subscriptions retain day-based expiry and cannot pause. | Active, paused, or inactive; pause periods are auditable and derive effective expiry under BR-10. Inactive results from cancellation or natural expiry. Payment-provider and revoked states remain deferred. |
| Credit / ledger entry | A fixed credit issued once from a Subscription and its immutable changes: allocation, reservation, consumption, release, expiry, or adjustment. Ties back to Plan/Subscription and Booking where applicable. | Credit is available, reserved, consumed, or expired; returned is a release ledger action that restores available state. A valid reservation remains reserved across Subscription expiry (BR-03, BR-11). |
| Waitlist entry | Customer's deterministic FIFO intent to book a full Slot; it references existing Slot, Membership, Subscription, Booking, and ledger context without duplicating them. | Active, promoted, withdrawn, ineligible, or expired-at-class-start. A successful automatic promotion creates the linked Booking (BR-12–14). |
| Attendance | Factual Trainer/Staff/Admin-recorded outcome for one eligible confirmed Booking in a Slot. It retains its actor, timing, and correction history; no separate customer or trainer identity is duplicated. | Attended or no-show; corrections preserve history and require the BR-07 authority/reason. |
| Incident | A policy record referencing one qualifying Booking source: late cancellation or no-show. It retains studio/customer/Booking context, source identity/timestamp, type, state, policy snapshot, review state, and administrative actor/reason context without duplicating booking, attendance, or credit data. | Active, waived, or reversed. One deterministic record exists per qualifying source; waived/reversed records do not count under BR-08. |
| Audit event | Immutable explanation of a state-changing business event, including actor and target. | Append-only (BR-17). |

## Relationship summary

```text
User ──0..1 Membership── Studio ──< Class ──< Slot
                                  ├──< Booking >── Membership (customer)
                                  │      ├── Credit ledger entry
                                  │      ├── Attendance
                                  │      └── Incident
                                  ├──< Waitlist entry >── Membership (customer)
                                  ├──< Plan ──< Subscription >── Membership (customer)
                                  └──< Audit event
```

Super Admin authority is platform-scoped and conceptually administers Studios;
it is not a second Studio membership or a normal product role.

A Slot has one assigned trainer Membership under BR-15. Classes, plans, and
memberships may change prospectively; linked bookings, subscriptions, ledger
entries, attendance, and audit events preserve the historical business meaning.

## Lifecycle consistency

Lifecycle state names above are the conceptual authority. Operational transition
rules remain in the cited business rules, and flow sequencing remains in
`FLOWS.md`. Terminal history is preserved: no entity's normal lifecycle removes
the records needed to explain a booking, credit, attendance, incident, or audit
event.
