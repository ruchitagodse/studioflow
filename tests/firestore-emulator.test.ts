import { randomUUID } from "node:crypto";
import { initializeApp, deleteApp, type App } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBooking, cancelCustomerBooking, rescheduleCustomerBooking, getCustomerSlot, getCustomerBookingsPage } from "../lib/bookings";
import { readCustomerSubscription } from "../lib/entitlements";
import { readPage } from "../lib/firebase/pagination";
import type { Principal } from "../lib/auth/server";

const emulator = process.env.FIRESTORE_EMULATOR_HOST;
// Never run fixture writes against a real Firebase project.
const enabled = Boolean(emulator && /^(127\.0\.0\.1|localhost):\d+$/.test(emulator));
describe.skipIf(!enabled)("Firestore emulator: optimized reads and atomic booking flows", () => {
  let app: App;
  beforeAll(() => { app = initializeApp({ projectId: "demo-studioflow" }); });
  afterAll(async () => { if (app) await deleteApp(app); });

  async function fixture(capacity = 2) {
    const db = getFirestore(app);
    const studioId = `test-${randomUUID()}`;
    const root = `studios/${studioId}`;
    const startsAt = new Date(Date.now() + 86_400_000);
    const endsAt = new Date(startsAt.getTime() + 3_600_000);
    const slot = { className: "Reformer", trainerUid: "trainer", trainerName: "Trainer", localDate: startsAt.toISOString().slice(0, 10), startTime: "10:00", endTime: "11:00", timezone: "Asia/Kolkata", startsAt: Timestamp.fromDate(startsAt), endsAt: Timestamp.fromDate(endsAt), capacity, confirmedBookingCount: 0, status: "published" };
    const batch = db.batch();
    batch.set(db.doc(root), { status: "active", timezone: "Asia/Kolkata", name: "Emulator studio" });
    batch.set(db.doc(`${root}/members/trainer`), { displayName: "Trainer", roles: ["trainer"], status: "active" });
    for (const uid of ["customer-a", "customer-b"]) {
      batch.set(db.doc(`${root}/members/${uid}`), { studioId, displayName: uid, roles: ["customer"], status: "active", activeSubscriptionId: uid, latestSubscriptionId: uid });
      batch.set(db.doc(`${root}/subscriptions/${uid}`), { customerUid: uid, status: "active", availableCredits: 8, reservedCredits: 0, startsAt: Timestamp.now(), endsAt: Timestamp.fromMillis(Date.now() + 30 * 86_400_000), historicalTerms: { creditAllocation: 8, planName: "8 sessions" } });
    }
    batch.set(db.doc(`${root}/slots/11111111-1111-4111-8111-111111111111`), slot);
    batch.set(db.doc(`${root}/slots/22222222-2222-4222-8222-222222222222`), { ...slot, startsAt: Timestamp.fromMillis(startsAt.getTime() + 3_600_000) });
    await batch.commit();
    const principal = (uid = "customer-a"): Principal => ({ uid, email: null, studioId, roles: ["customer"], superAdmin: false, workspace: "/customer" });
    return { db, root, principal };
  }

  it("books, restores the session view, cancels and returns exactly one credit", async () => {
    const { db, root, principal } = await fixture();
    const result = await createBooking(principal(), { slotId: "11111111-1111-4111-8111-111111111111", operationId: randomUUID() });
    const slot = await getCustomerSlot(principal(), "11111111-1111-4111-8111-111111111111");
    expect(slot?.slot.alreadyBooked).toBe(true);
    expect(slot?.subscription.usableCredits).toBe(7);
    const operationId = randomUUID();
    await cancelCustomerBooking(principal(), { bookingId: result.bookingId, operationId });
    const balance = (await db.doc(`${root}/subscriptions/customer-a`).get()).data();
    expect(balance?.availableCredits).toBe(8);
    expect(balance?.reservedCredits).toBe(0);
    const history = await getCustomerBookingsPage(principal(), "history");
    expect(history.items.map((item) => item.id)).toContain(result.bookingId);
    expect(history.upcomingCount).toBe(0);
  });

  it("reschedules atomically and leaves the original intact on target failure", async () => {
    const { db, root, principal } = await fixture();
    const booked = await createBooking(principal(), { slotId: "11111111-1111-4111-8111-111111111111", operationId: randomUUID() });
    await expect(rescheduleCustomerBooking(principal(), { bookingId: booked.bookingId, targetSlotId: "33333333-3333-4333-8333-333333333333", operationId: randomUUID() })).rejects.toThrow();
    expect((await db.doc(`${root}/bookings/${booked.bookingId}`).get()).data()?.status).toBe("confirmed");
    await rescheduleCustomerBooking(principal(), { bookingId: booked.bookingId, targetSlotId: "22222222-2222-4222-8222-222222222222", operationId: randomUUID() });
    const upcoming = await getCustomerBookingsPage(principal(), "upcoming");
    expect(upcoming.items).toHaveLength(1);
    expect(upcoming.items[0].slotId).toBe("22222222-2222-4222-8222-222222222222");
    expect((await db.doc(`${root}/subscriptions/customer-a`).get()).data()?.availableCredits).toBe(7);
  });

  it("rechecks live capacity for concurrent users instead of trusting an earlier view", async () => {
    const { db, root, principal } = await fixture(1);
    expect((await getCustomerSlot(principal("customer-b"), "11111111-1111-4111-8111-111111111111"))?.slot.remainingCapacity).toBe(1);
    const outcomes = await Promise.allSettled(["customer-a", "customer-b"].map((uid) => createBooking(principal(uid), { slotId: "11111111-1111-4111-8111-111111111111", operationId: randomUUID() })));
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await db.doc(`${root}/slots/11111111-1111-4111-8111-111111111111`).get()).data()?.confirmedBookingCount).toBe(1);
  }, 20_000); // The real SDK may back off while retrying an emulator transaction conflict.

  it("preserves the two-hour cutoff and consumes a late-cancelled pass", async () => {
    const { db, root, principal } = await fixture();
    await db.doc(`${root}/slots/11111111-1111-4111-8111-111111111111`).update({ startsAt: Timestamp.fromMillis(Date.now() + 30 * 60_000), endsAt: Timestamp.fromMillis(Date.now() + 90 * 60_000) });
    const booked = await createBooking(principal(), { slotId: "11111111-1111-4111-8111-111111111111", operationId: randomUUID() });
    await expect(rescheduleCustomerBooking(principal(), { bookingId: booked.bookingId, targetSlotId: "22222222-2222-4222-8222-222222222222", operationId: randomUUID() })).rejects.toThrow("RESCHEDULE_CUTOFF_PASSED");
    const cancelled = await cancelCustomerBooking(principal(), { bookingId: booked.bookingId, operationId: randomUUID() });
    expect(cancelled.creditOutcome).toBe("consumed");
    const subscription = (await db.doc(`${root}/subscriptions/customer-a`).get()).data();
    expect(subscription?.availableCredits).toBe(7);
    expect(subscription?.reservedCredits).toBe(0);
    expect((await db.doc(`${root}/bookings/${booked.bookingId}`).get()).data()?.status).toBe("cancelled-late");
  });

  it("isolates same-named records across tenants and rejects revoked membership", async () => {
    const a = await fixture(); const b = await fixture();
    await createBooking(a.principal(), { slotId: "11111111-1111-4111-8111-111111111111", operationId: randomUUID() });
    expect((await getCustomerBookingsPage(b.principal(), "upcoming")).items).toHaveLength(0);
    await b.db.doc(`${b.root}/members/customer-a`).update({ status: "inactive" });
    await expect(createBooking(b.principal(), { slotId: "11111111-1111-4111-8111-111111111111", operationId: randomUUID() })).rejects.toThrow();
    expect((await b.db.doc(`${b.root}/slots/11111111-1111-4111-8111-111111111111`).get()).data()?.confirmedBookingCount).toBe(0);
  });

  it("loads history in cursor pages with no duplicates, even for equal timestamps", async () => {
    const { db, root } = await fixture();
    const collection = `${root}/history-fixture`;
    const batch = db.batch();
    for (let n = 0; n < 5; n++) batch.set(db.doc(`${collection}/record-${n}`), { createdAt: Timestamp.fromMillis(1), value: n });
    await batch.commit();
    const query = db.collection(collection).orderBy("createdAt", "desc");
    const first = await readPage(query, collection, undefined, 2);
    const second = await readPage(query, collection, first.nextCursor!, 2);
    const third = await readPage(query, collection, second.nextCursor!, 2);
    expect(new Set([...first.docs, ...second.docs, ...third.docs].map((doc) => doc.id)).size).toBe(5);
    expect(third.nextCursor).toBeNull();
  });

  it("checks subscription ownership and does not expire an active future subscription", async () => {
    const { db, root, principal } = await fixture();
    const subscription = await readCustomerSubscription(principal().studioId!, "customer-a");
    expect(subscription?.data()?.availableCredits).toBe(8);
    expect((await db.collection(`${root}/auditEvents`).get()).empty).toBe(true);
    await db.doc(`${root}/members/customer-a`).update({ activeSubscriptionId: "customer-b" });
    expect(await readCustomerSubscription(principal().studioId!, "customer-a")).toBeNull();
  });
});
