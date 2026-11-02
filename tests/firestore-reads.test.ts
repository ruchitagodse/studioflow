import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("../lib/firebase/admin", () => ({ getAdminDb: () => ({ doc: (path: string) => ({ get: () => state.read(path) }) }) }));
// Exercise the memo adapter with a separate memo per imported request fixture.
vi.mock("react", () => ({ cache: (fn: (path: string) => unknown) => {
  const memo = new Map();
  return (path: string) => { if (!memo.has(path)) memo.set(path, fn(path)); return memo.get(path); };
} }));
beforeEach(() => { vi.resetModules(); state.read.mockReset().mockImplementation(async (path) => ({ path })); });

describe("central Firestore read boundary", () => {
  it("deduplicates shared record reads by full tenant path", async () => {
    const { readDocument } = await import("../lib/firebase/reads");
    const results = await Promise.all([readDocument("studios/a/members/sam"), readDocument("studios/a/members/sam"), readDocument("studios/b/members/sam")]);
    expect(state.read).toHaveBeenCalledTimes(2);
    expect(results[0]).toBe(results[1]); expect(results[0]).not.toEqual(results[2]);
  });
  it("blocks other reads and mutations after quota exhaustion without retry loops", async () => {
    const { readQuery, withFirestoreQuota } = await import("../lib/firebase/reads");
    const get = vi.fn().mockRejectedValue({ code: 8 });
    await expect(readQuery({ get })).rejects.toMatchObject({ code: "resource-exhausted" });
    const later = vi.fn();
    await expect(readQuery({ get: later })).rejects.toMatchObject({ code: "resource-exhausted" });
    await expect(withFirestoreQuota(later)).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(get).toHaveBeenCalledTimes(1); expect(later).not.toHaveBeenCalled();
  });
  it("does not cache successful query results across explicit refreshes", async () => {
    const { readQuery } = await import("../lib/firebase/reads");
    const get = vi.fn().mockResolvedValueOnce("old").mockResolvedValueOnce("new");
    expect(await readQuery({ get })).toBe("old"); expect(await readQuery({ get })).toBe("new");
  });
});
