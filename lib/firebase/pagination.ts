import "server-only";
import type { DocumentData, Query } from "firebase-admin/firestore";
import { readDocument, readQuery } from "./reads";

export function validCursor(value: unknown): string | undefined {
  return typeof value === "string" && value.length <= 1500 && value !== "." && value !== ".." && !/[\/\x00-\x1f]/.test(value) ? value || undefined : undefined;
}

/** collectionPath must come from the verified principal, never a browser field. */
export async function readPage<T extends DocumentData>(query: Query<T>, collectionPath: string, after?: string, pageSize = 25) {
  // Firestore includes the document ID as the implicit final ordering key.
  let bounded = query;
  const cursor = validCursor(after);
  if (cursor) {
    const snapshot = await readDocument(`${collectionPath}/${cursor}`);
    if (snapshot.exists) bounded = bounded.startAfter(snapshot);
  }
  const result = await readQuery(bounded.limit(pageSize + 1));
  const docs = result.docs.slice(0, pageSize);
  return { docs, nextCursor: result.docs.length > pageSize ? docs.at(-1)?.id ?? null : null };
}
