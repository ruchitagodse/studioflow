import { randomUUID } from "node:crypto";
import { initializeApp, deleteApp, type App } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cancelCustomerBooking, createBooking, getCustomerBookingsPage, rescheduleCustomerBooking } from "../lib/bookings";
import { getCustomerEntitlement, renewSubscription } from "../lib/entitlements";
import type { Principal } from "../lib/auth/server";

const enabled = /^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "");
const slotA = "11111111-1111-4111-8111-111111111111";
const slotB = "22222222-2222-4222-8222-222222222222";
const slotOld = "33333333-3333-4333-8333-333333333333";
const day = 86_400_000;

describe.skipIf(!enabled)("production-readiness ordering and membership regressions", () => {
  let app: App;
  beforeAll(() => { app = initializeApp({ projectId: "demo-studioflow" }); });
  afterAll(async () => { if (app) await deleteApp(app); });

  async function fixture(current = true) {
    const db = getFirestore(app);
    const studioId = `regression-${randomUUID()}`;
    const root = `studios/${studioId}`;
    const base = Date.now();
    const principal: Principal = { uid: "customer", email: null, studioId, roles: ["customer"], superAdmin: false, workspace: "/customer" };
    const batch = db.batch();
    batch.set(db.doc(root), { status: "active", name: "Regression studio", timezone: "Asia/Kolkata" });
    batch.set(db.doc(`${root}/members/customer`), { studioId, status: "active", roles: ["customer"], ...(current ? { activeSubscriptionId: "current", latestSubscriptionId: "current" } : {}) });
    batch.set(db.doc(`${root}/members/trainer`), { studioId, status: "active", roles: ["trainer"], displayName: "Trainer" });
    if (current) batch.set(db.doc(`${root}/subscriptions/current`), { customerUid: "customer", status: "active", startsAt: Timestamp.fromMillis(base), endsAt: Timestamp.fromMillis(base + 30 * day), availableCredits: 8, reservedCredits: 0, historicalTerms: { creditAllocation: 8, planName: "Current plan" } });
    for (const [index, id] of [slotA, slotB, slotOld].entries()) {
      batch.set(db.doc(`${root}/slots/${id}`), { className: "Reformer", trainerUid: "trainer", trainerName: "Trainer", status: "published", startsAt: Timestamp.fromMillis(base + (index + 1) * day), endsAt: Timestamp.fromMillis(base + (index + 1) * day + 3_600_000), localDate: new Date(base + (index + 1) * day).toISOString().slice(0, 10), startTime: "10:00", endTime: "11:00", timezone: "Asia/Kolkata", capacity: 8, confirmedBookingCount: 0 });
    }
    await batch.commit();
    return { db, root, principal, base };
  }

  type Fixture = Awaited<ReturnType<typeof fixture>>;

  async function oldMembership(f: Fixture) {
    const old = f.db.doc(`${f.root}/subscriptions/old`);
    const batch = f.db.batch();
    batch.set(old, { customerUid: "customer", status: "inactive", inactiveReason: "expired", startsAt: Timestamp.fromMillis(f.base - 30 * day), endsAt: Timestamp.fromMillis(f.base - day), availableCredits: 0, reservedCredits: 1, historicalTerms: { creditAllocation: 8, planName: "Previous plan" } });
    batch.set(old.collection("ledger").doc("allocation-old"), { action: "allocation", amount: 8, balanceBefore: 0, balanceAfter: 8, createdAt: Timestamp.fromMillis(f.base - 30 * day) });
    batch.set(old.collection("ledger").doc("reservation-old"), { action: "reservation", amount: -1, balanceBefore: 8, balanceAfter: 7, reservedCreditsBefore: 0, reservedCreditsAfter: 1, referenceId: "old-booking", createdAt: Timestamp.fromMillis(f.base - 2 * day) });
    batch.set(old.collection("ledger").doc("expiry-old"), { action: "expiry", amount: -7, balanceBefore: 7, balanceAfter: 0, createdAt: Timestamp.fromMillis(f.base - day) });
    batch.set(f.db.doc(`${f.root}/bookings/old-booking`), { customerUid: "customer", subscriptionId: "old", status: "confirmed", slotId: slotOld, trainerUid: "trainer", slotStartsAt: Timestamp.fromMillis(f.base + 3 * day), reservationLedgerId: "reservation-old" });
    batch.update(f.db.doc(`${f.root}/slots/${slotOld}`), { confirmedBookingCount: 1 });
    await batch.commit();
    return old;
  }

  async function snapshot(ref: FirebaseFirestore.DocumentReference) {
    const [record, ledger] = await Promise.all([ref.get(), ref.collection("ledger").orderBy("__name__").get()]);
    return JSON.stringify({ record: record.data(), ledger: ledger.docs.map((doc) => ({ id: doc.id, data: doc.data() })) });
  }

  async function seedBookings(f: Fixture, count: number, history = false) {
    const batch = f.db.batch();
    // Reverse insertion order, with equal timestamps crossing page boundaries.
    for (let index = count - 1; index >= 0; index--) {
      batch.set(f.db.doc(`${f.root}/bookings/booking-${String(index).padStart(3, "0")}`), { customerUid: "customer", subscriptionId: "current", trainerUid: "trainer", status: history ? "attended" : "confirmed", slotStartsAt: Timestamp.fromMillis(f.base + (history ? -30 * day : day) + Math.floor(index / 3) * 60_000) });
    }
    await batch.commit();
  }

  it("preserves chronological Upcoming order over three pages, including ties and previous/first navigation", async () => {
    const f = await fixture();
    await seedBookings(f, 45);
    const first = await getCustomerBookingsPage(f.principal, "upcoming");
    const second = await getCustomerBookingsPage(f.principal, "upcoming", first.nextCursor!);
    const third = await getCustomerBookingsPage(f.principal, "upcoming", second.nextCursor!);
    expect([first.items.length, second.items.length, third.items.length]).toEqual([20, 20, 5]);
    const items = [...first.items, ...second.items, ...third.items];
    expect(items.map((item) => item.id)).toEqual(Array.from({ length: 45 }, (_, index) => `booking-${String(index).padStart(3, "0")}`));
    expect(new Set(items.map((item) => item.id)).size).toBe(45);
    expect(items.map((item) => item.startsAt)).toEqual(items.map((item) => item.startsAt).sort());
    expect(first.nextCursor).toBe(first.items.at(-1)?.id);
    expect(second.nextCursor).toBe(second.items.at(-1)?.id);
    expect(third.nextCursor).toBeNull();
    expect(first.upcomingCount).toBe(45);
    // These are the same URLs revisited by browser Back and First page.
    expect((await getCustomerBookingsPage(f.principal, "upcoming", first.nextCursor!)).items).toEqual(second.items);
    expect((await getCustomerBookingsPage(f.principal, "upcoming")).items).toEqual(first.items);
  });

  it("preserves reverse chronological History order and cursor ties over multiple pages", async () => {
    const f = await fixture();
    await seedBookings(f, 24, true);
    const first = await getCustomerBookingsPage(f.principal, "history");
    const second = await getCustomerBookingsPage(f.principal, "history", first.nextCursor!);
    expect([...first.items, ...second.items].map((item) => item.id)).toEqual(Array.from({ length: 24 }, (_, index) => `booking-${String(23 - index).padStart(3, "0")}`));
    expect(first.nextCursor).toBe(first.items.at(-1)?.id);
    expect(second.nextCursor).toBeNull();
    expect((await getCustomerBookingsPage(f.principal, "history")).items).toEqual(first.items);
  });

  it("renews into a new entitlement without importing old reservations or rewriting the historical ledger", async () => {
    const f = await fixture(false);
    const old = await oldMembership(f);
    await f.db.doc(`${f.root}/members/customer`).update({ latestSubscriptionId: "old" });
    const before = await snapshot(old);
    await f.db.doc(`${f.root}/plans/renewal-plan`).set({ name: "Renewed plan", status: "active", pricePaise: 160000, creditAllocation: 16, validityDays: 30 });
    const staff: Principal = { ...f.principal, uid: "staff", roles: ["staff"], workspace: "/studio" };
    const id = await renewSubscription(staff, { customerUid: "customer", planId: "renewal-plan", operationId: randomUUID() });
    const view = await getCustomerEntitlement(f.principal);
    expect(view.subscription).toMatchObject({ id, availableCredits: 16, reservedCredits: 0, usedCredits: 0 });
    expect(view.ledger.map((entry) => entry.action)).toEqual(["allocation"]);
    expect((await getCustomerBookingsPage(f.principal, "upcoming")).upcomingCount).toBe(1);
    expect(await snapshot(old)).toBe(before);
  });

  it("reports reservations belonging to the current plan after real booking transactions", async () => {
    const f = await fixture();
    await createBooking(f.principal, { slotId: slotA, operationId: randomUUID() });
    await createBooking(f.principal, { slotId: slotB, operationId: randomUUID() });
    expect((await getCustomerEntitlement(f.principal)).subscription).toMatchObject({ id: "current", availableCredits: 6, reservedCredits: 2, usedCredits: 0 });
  });

  it("isolates current balances from mixed old/current history, other customers and another studio", async () => {
    const f = await fixture();
    const otherStudio = await fixture();
    const old = await oldMembership(f);
    const before = await snapshot(old);
    await createBooking(f.principal, { slotId: slotA, operationId: randomUUID() });
    const batch = f.db.batch();
    for (const [id, subscriptionId, status, customerUid, past] of [
      ["current-attended", "current", "attended", "customer", true],
      ["current-cancelled", "current", "cancelled-free", "customer", false],
      ["old-attended", "old", "attended", "customer", true],
      ["other-customer", "other", "confirmed", "someone-else", false],
    ] as const) batch.set(f.db.doc(`${f.root}/bookings/${id}`), { subscriptionId, status, customerUid, trainerUid: "trainer", slotStartsAt: Timestamp.fromMillis(f.base + (past ? -day : day)) });
    batch.update(f.db.doc(`${f.root}/subscriptions/current`), { availableCredits: 6 });
    batch.set(f.db.doc(`${f.root}/subscriptions/current/ledger/past-reservation`), { action: "reservation", amount: -1, balanceBefore: 7, balanceAfter: 6, reservedCreditsBefore: 1, reservedCreditsAfter: 2, referenceId: "current-attended", createdAt: Timestamp.fromMillis(f.base - day) });
    batch.set(f.db.doc(`${f.root}/subscriptions/current/ledger/past-consumption`), { action: "consumption", amount: 0, balanceBefore: 6, balanceAfter: 6, reservedCreditsBefore: 2, reservedCreditsAfter: 1, referenceId: "current-attended", createdAt: Timestamp.fromMillis(f.base - day + 1) });
    await batch.commit();
    await createBooking(otherStudio.principal, { slotId: slotA, operationId: randomUUID() });
    expect((await getCustomerEntitlement(f.principal)).subscription).toMatchObject({ availableCredits: 6, reservedCredits: 1, usedCredits: 1 });
    expect((await getCustomerEntitlement(otherStudio.principal)).subscription).toMatchObject({ availableCredits: 7, reservedCredits: 1, usedCredits: 0 });
    expect(await snapshot(old)).toBe(before);
  });

  it("keeps an unresolved past reservation reserved until its ledger outcome is recorded", async () => {
    const f = await fixture();
    await createBooking(f.principal, { slotId: slotA, operationId: randomUUID() });
    const batch = f.db.batch();
    batch.set(f.db.doc(`${f.root}/bookings/past-pending`), { customerUid: "customer", subscriptionId: "current", status: "confirmed", trainerUid: "trainer", slotStartsAt: Timestamp.fromMillis(f.base - day) });
    batch.set(f.db.doc(`${f.root}/subscriptions/current/ledger/past-reservation`), { action: "reservation", amount: -1, balanceBefore: 7, balanceAfter: 6, reservedCreditsBefore: 1, reservedCreditsAfter: 2, referenceId: "past-pending", createdAt: Timestamp.fromMillis(f.base - 2 * day) });
    batch.update(f.db.doc(`${f.root}/subscriptions/current`), { availableCredits: 6, reservedCredits: 2 });
    await batch.commit();
    expect((await getCustomerBookingsPage(f.principal, "upcoming")).upcomingCount).toBe(1);
    expect((await getCustomerEntitlement(f.principal)).subscription).toMatchObject({ availableCredits: 6, reservedCredits: 2, usedCredits: 0 });
  });

  it("preserves current-plan balances through rescheduling and cancellation with an old reservation present", async () => {
    const f = await fixture();
    const old = await oldMembership(f);
    const before = await snapshot(old);
    const booked = await createBooking(f.principal, { slotId: slotA, operationId: randomUUID() });
    const moved = await rescheduleCustomerBooking(f.principal, { bookingId: booked.bookingId, targetSlotId: slotB, operationId: randomUUID() });
    expect((await getCustomerEntitlement(f.principal)).subscription).toMatchObject({ availableCredits: 7, reservedCredits: 1, usedCredits: 0 });
    await cancelCustomerBooking(f.principal, { bookingId: moved.bookingId, operationId: randomUUID() });
    expect((await getCustomerEntitlement(f.principal)).subscription).toMatchObject({ availableCredits: 8, reservedCredits: 0, usedCredits: 0 });
    expect((await getCustomerBookingsPage(f.principal, "upcoming")).upcomingCount).toBe(1);
    expect(await snapshot(old)).toBe(before);
  });

  it("resolves a previous plan's cancellation against that plan without crediting the current plan", async () => {
    const f = await fixture();
    const old = await oldMembership(f);
    const originalEntries = (await old.collection("ledger").get()).docs;
    const result = await cancelCustomerBooking(f.principal, { bookingId: "old-booking", operationId: randomUUID() });
    expect(result.creditOutcome).toBe("expired");
    expect((await old.get()).data()).toMatchObject({ availableCredits: 0, reservedCredits: 0 });
    expect((await getCustomerEntitlement(f.principal)).subscription).toMatchObject({ availableCredits: 8, reservedCredits: 0, usedCredits: 0 });
    for (const entry of originalEntries) expect((await entry.ref.get()).data()).toEqual(entry.data());
    expect((await old.collection("ledger").get()).size).toBe(originalEntries.length + 1);
    expect((await f.db.doc(`${f.root}/members/customer`).get()).data()?.activeSubscriptionId).toBe("current");
  });
});
