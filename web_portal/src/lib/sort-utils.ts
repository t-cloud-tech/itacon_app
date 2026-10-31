// Converts Firestore Timestamps, ISO strings, Dates or millis into epoch millis (0 if unknown).
export function toMillis(v: any): number {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  if (typeof v._seconds === "number") return v._seconds * 1000;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

// Returns a new array sorted newest-first by the given date getter.
export function sortNewestFirst<T>(items: T[], getDate: (item: T) => any): T[] {
  return [...items].sort((a, b) => toMillis(getDate(b)) - toMillis(getDate(a)));
}
