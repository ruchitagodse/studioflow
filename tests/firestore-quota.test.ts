import { describe, expect, it, vi } from "vitest";
import { createQuotaGuard, isFirestoreQuotaError } from "../lib/firebase/quota";

describe("Firestore quota handling", () => {
  it("recognizes SDK quota codes without treating other failures as quota exhaustion", () => {
    for (const code of [8, "8", "resource-exhausted", "RESOURCE_EXHAUSTED", "firestore/resource-exhausted"]) expect(isFirestoreQuotaError({ code })).toBe(true);
    for (const error of [null, new Error("Quota exceeded"), { code: 7 }, { code: "auth/invalid-session-cookie" }]) expect(isFirestoreQuotaError(error)).toBe(false);
  });
  it("backs off repeated reads and retries after the cooldown", async () => {
    let now = 100;
    const guard = createQuotaGuard(() => now, () => 0);
    const read = vi.fn().mockRejectedValueOnce({ code: 8 }).mockResolvedValue("fresh authorization");
    await expect(guard(read)).rejects.toMatchObject({ code: "resource-exhausted" });
    await expect(guard(read)).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(read).toHaveBeenCalledTimes(1);
    now += 60_000;
    await expect(guard(read)).resolves.toBe("fresh authorization");
    await expect(guard(read)).resolves.toBe("fresh authorization");
    expect(read).toHaveBeenCalledTimes(3);
  });
  it("preserves non-quota failures and does not delay subsequent checks", async () => {
    const guard = createQuotaGuard();
    const failure = new Error("permission denied");
    await expect(guard(async () => { throw failure; })).rejects.toBe(failure);
    await expect(guard(async () => "fresh")).resolves.toBe("fresh");
  });
  it("increases cooldowns with bounded jitter, caps them, and resets after success", async () => {
    let now = 1;
    const guard = createQuotaGuard(() => now, () => 1);
    const operation = vi.fn().mockRejectedValue({ code: 8 });
    for (const duration of [72_000, 144_000, 288_000, 300_000, 300_000]) {
      await expect(guard(operation)).rejects.toMatchObject({ code: "resource-exhausted" });
      const attempts = operation.mock.calls.length;
      now += duration - 1;
      await expect(guard(operation)).rejects.toMatchObject({ code: "resource-exhausted" });
      expect(operation).toHaveBeenCalledTimes(attempts);
      now += 1;
    }
    operation.mockResolvedValueOnce("recovered");
    await expect(guard(operation)).resolves.toBe("recovered");
    await expect(guard(operation)).rejects.toMatchObject({ code: "resource-exhausted" });
    now += 72_000;
    operation.mockResolvedValueOnce("ok");
    await expect(guard(operation)).resolves.toBe("ok");
  });
});
