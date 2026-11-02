export function isFirestoreQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return [8, "8", "resource-exhausted", "RESOURCE_EXHAUSTED", "firestore/resource-exhausted"].includes(error.code as string | number);
}

export class FirestoreQuotaError extends Error {
  readonly code = "resource-exhausted";
  constructor() { super("Studio data is temporarily unavailable. Please try again later."); }
}

/** Back off failures only; never cache a successful authorization decision. */
export function createQuotaGuard(now: () => number = Date.now, random: () => number = Math.random) {
  let retryAfter = 0;
  let failures = 0;
  return async function guard<T>(operation: () => Promise<T>): Promise<T> {
    if (now() < retryAfter) throw new FirestoreQuotaError();
    try {
      const result = await operation();
      failures = 0;
      return result;
    }
    catch (error) {
      if (!isFirestoreQuotaError(error)) throw error;
      // No automatic retries. Manual attempts after a cooldown back off at most
      // four steps, with jitter to avoid synchronized clients across instances.
      failures = Math.min(failures + 1, 4);
      retryAfter = now() + Math.min(300_000, 60_000 * 2 ** (failures - 1) * (1 + .2 * random()));
      throw new FirestoreQuotaError();
    }
  };
}
