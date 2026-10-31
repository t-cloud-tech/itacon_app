import { getDocs, queryEqual, type Query, type QuerySnapshot, type DocumentData } from "firebase/firestore";

/**
 * Short-lived read cache for Firestore queries.
 *
 * Several pages/services read the same full collections (users, salesPersons, orders, ...)
 * several times per screen. Identical queries issued within the TTL share one network read,
 * and concurrent identical queries share one in-flight promise. Call
 * `invalidateFirestoreCache()` after writes that later reads must see immediately.
 */
const TTL_MS = 15_000;

interface Entry {
  query: Query<DocumentData>;
  promise: Promise<QuerySnapshot<DocumentData>>;
  at: number;
}

let entries: Entry[] = [];

export function cachedGetDocs(q: Query<DocumentData>): Promise<QuerySnapshot<DocumentData>> {
  const now = Date.now();
  entries = entries.filter((e) => now - e.at < TTL_MS);

  const hit = entries.find((e) => queryEqual(e.query, q));
  if (hit) return hit.promise;

  const entry: Entry = { query: q, at: now, promise: getDocs(q) };
  // Never cache failures (e.g. permission-denied or offline) so the next call retries.
  entry.promise.catch(() => {
    entries = entries.filter((e) => e !== entry);
  });
  entries.push(entry);
  return entry.promise;
}

export function invalidateFirestoreCache(): void {
  entries = [];
}
