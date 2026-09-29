# Delivery roadmap

## Status and sequencing

The UI foundation is complete and Sprint 1 is complete. Each remaining slice is a
shippable vertical path: UI, trusted backend operation, validation,
authorization, state change, audit history, and focused automated tests.

## Foundation completed

- Focused product boundary and implementation architecture.
- Polished responsive identity and protected-workspace shells establishing the
  StudioFlow visual direction.
- Authoritative business rules, permissions, flows, UI specification, conceptual
  data model, approval register, and status record.
- Sprint 1: protected Super Admin provisioning, Firebase identity/session entry,
  one-studio tenant resolution, protected workspace shells, trusted Membership
  provisioning, and deny-by-default Firestore client rules.

## Proposed vertical slices

1. **Platform provisioning, identity, and protected entry — complete**
   - Protected `/super-admin` workspace, Super Admin-only studio provisioning,
     required platform-controlled configuration, initial owner assignment,
     Firebase Auth login-only entry with password recovery, one-studio Membership
     authorization, role-aware routing, and
     access-denied/account-configuration state.
   - Test Super Admin authority, unauthenticated/missing/inactive Membership,
     inactive Studio, cross-tenant access, single-studio membership, and
     multi-role-within-one-studio. No schedule or booking mutation yet.

2. **Owner/admin schedule foundation — complete**
   - Class/slot management UI, trainer assignment, capacity/timezone validation,
     publication/cancellation states, and published schedule read.
   - Test class-versus-slot behaviour, permissions, invalid capacity/time,
     trainer/overlap policy, cancellation effects, audit, and tenant isolation.
     No customer booking yet.

3. **Team & Membership Provisioning — complete**
   - Owner-only team list, manually shared secure invitation links, existing-account association, pending/active/inactive lifecycle, permitted role/profile changes, bounded queries, and audit history. StudioFlow does not send invitation email or use Firebase password recovery as an invitation mechanism.
   - Enforce one active studio membership, seven-day invitation expiry, and no automatic future-slot, booking, or subscription changes on deactivation.

4. **Entitlement foundation — complete**
   - Plan management, approved initial subscription/credit allocation path,
     immutable ledger, customer credit balance/history, and authorized
     adjustments with reasons. This slice does not require online checkout.
   - Test issue/reserve preconditions, adjustment authority, expiry policy where
     approved, idempotency, audit, and tenant isolation.
   - Implemented fixed-credit Plans, historical Subscription terms, one active
     Subscription per customer per studio, transactional allocation/expiry/
     adjustment ledger records, and Owner/Staff entitlement UI. No booking or
     billing path is included.

5. **Customer availability and booking — complete**
   - Customer schedule/detail UI, eligible-credit read, trusted atomic booking,
     capacity decrement, credit reservation, confirmation, and booking history.
   - Test duplicate booking, full-slot race, unavailable/expired credit, active
     reservation across Subscription expiry, authorization, audit, and all UI
     loading/error/full/success states.
   - Sprint 4 eligibility, start-instant cutoff, and reservation-expiry policy
     are frozen in BR-02 and BR-11; later cancellation, attendance, waitlist,
     notification, and penalty rules remain deferred.
   - Implemented bounded published-slot availability, class detail and
     confirmation UI, upcoming and bounded booking history, trusted atomic
     capacity/credit reservation, deterministic idempotency, and booking/credit
     audit history. No booking-management or later lifecycle action is included.

6. **Customer booking management — complete**
   - Upcoming booking detail, free/late cancellation, rescheduling, cutoff
     explanation, and atomic capacity reconciliation. A free cancellation
     returns the reserved credit; a late pre-start cancellation consumes it.
     Customer cancellation is blocked at/after slot start.
   - Customer rescheduling is allowed only at/earlier than the inclusive
     two-hour cutoff. A full or unavailable target leaves the original Booking
     and reservation unchanged; no waitlist placement is implied.
   - Test exact two-hour boundary, post-start rejection, target conflict,
     failed reschedule preservation, late-credit consumption, audit, inactive
     Membership/Studio new-booking rejection, and no Incident creation,
     incident-policy penalty, warning, or fee before that domain is approved.
   - Implemented customer cancellation/rescheduling UI, trusted atomic
     free/late cancellation, reservation-preserving reschedule, capacity
     reconciliation, idempotency, ledger/audit history, and bounded target-slot
     selection. No Incident, warning, fee, threshold, or penalty behavior was
     added.

7. **Trainer roster and attendance — complete**
   - Implemented an assigned trainer schedule, server-authorized trainer and
     studio roster routes, and factual attended/no-show capture in the approved
     BR-07 window. Either outcome consumes the existing reservation exactly
     once; Owner/Staff correction preserves the prior outcome in audit history.
     Customer booking history shows only the customer's own factual outcome.
   - Reuses Membership as trainer identity and the existing `trainerUid` Slot
     assignment; no duplicate trainer/customer identity or credit system was
     introduced. Focused tests cover window boundaries, candidate eligibility,
     trainer scope, correction authority/reason validation, and exactly-once
     consumption logic. No Incident record, threshold, warning, fee, penalty,
     waiver, or policy evaluation is included.

8. **Sprint 7 — Owner Incident Policy — complete**
   - Implemented only BR-08: deterministic late-cancellation/no-show Incident
     records; active/waived/reversed state; three active Incidents in a rolling
     30-day window; Owner-review state; Owner policy, waiver, and factual
     reversal actions; Staff read-only visibility; audit and focused tests.
   - No automatic booking restriction, credit penalty, fee, payment, debt,
     notification, customer Incident history, analytics, generalized rules
     engine, or product-wide UI redesign.
   - Tested source eligibility, one Incident per source, correction transitions,
     threshold/idempotency/current-policy evaluation, tenant and role scope,
     Owner-only changes, Staff read-only access, and zero additional credit
     movement.

9. **Sprint 8 — Waitlist and Promotion — complete**
   - Implemented BR-12–14 only: deterministic FIFO entries, dynamic position,
     automatic promotion, promotion-time eligibility, normal Booking/credit
     reservation, ineligibility skip, withdrawal/removal, class-start closure,
     bounded functional UI, audit, authorization, and concurrency-safe transactions.
   - No offers, manual promotion, notifications, payments, billing, fees, debt,
     Incident change, priority system, analytics, or visual redesign.

10. **Sprint 9 — Owner Incident Policy repair — complete**
   - Repaired Owner-only factual reversal, idempotent policy operations, derived
     current review state, and the Owner-only `incident.reviewed` acknowledgement.
   - No restriction, penalty, notification, customer Incident history, or visual
     redesign is included.

11. **Billing, subscription lifecycle, pause, and credit expiry**
   - No payment gateway, checkout, provider reconciliation, refund, tax/invoice,
     or billing-notification work is included in V1. Pause policy is frozen in BR-10: whole-month eligibility, cumulative split
     allowance, immediate customer/Owner/Staff authority, booking preservation,
     and effective-expiry extension. Pause implementation remains pending. The
     manual no-payment billing boundary, provisioning/activation, manual renewal,
     cancellation, and credit expiry are frozen and implementation-ready.
   - Test manual activation, renewal as a new historical Subscription/allocation,
     immediate-cancellation booking/reservation/capacity reconciliation,
     pause/booking interaction, expiry/reservation, adjustments, plan retirement,
     and idempotent policy edges. Payment and notification behaviour are excluded.
   - Implemented: explicit month-based Plan/Subscription terms, manual
     provisioning/activation and renewal, immediate/end-of-term cancellation,
     reservation release followed by expiry, trusted pause periods, effective
     expiry, bounded functional UI, audit/idempotency, and focused tests. Live
     Firebase end-to-end verification remains before completion is claimed.

12. **Focused operations polish**
    - Staff customer-service workflow, exception queue, owner operations
      overview, and usability/accessibility hardening driven only by shipped
      features.
    - Do not expand into generalized analytics or unrelated fitness features.

## Slice completion criteria

A slice is complete only when its real path works with target UI; loading,
empty, error, disabled, permission-denied, and success states are covered;
client and trusted validation agree; authorization and tenant isolation are
tested; state changes are idempotent and audited; and relevant SSOT documents
and decisions are updated.
