import "server-only";
import { cache } from "react";
import { getAdminDb } from "./admin";
import { createQuotaGuard } from "./quota";

// Shared across reads in this server process, not across users' successful results.
export const withFirestoreQuota = createQuotaGuard();

export function readQuery<T>(query: { get(): Promise<T> }): Promise<T> {
  return withFirestoreQuota(() => query.get());
}

/** Request-only deduplication. Full paths include the verified tenant boundary.
 * Do not use for transaction reads or reuse results after writing the same record.
 * React discards the memo at the end of each Server Component request.
 */
export const readDocument = cache((path: string) => readQuery(getAdminDb().doc(path)));
