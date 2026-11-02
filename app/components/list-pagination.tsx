import Link from "next/link";

export function ListPagination({ pathname, nextCursor, after, params = {}, cursorKey = "after" }: { pathname: string; nextCursor: string | null; after?: string; params?: Record<string, string>; cursorKey?: string }) {
  if (!nextCursor && !after) return null;
  const first = new URLSearchParams(params);
  const next = new URLSearchParams({ ...params, [cursorKey]: nextCursor ?? "" });
  return <nav aria-label="List pages" style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "18px", fontSize: 13 }}>
    {after && <Link prefetch={false} href={`${pathname}?${first}`}>First page</Link>}
    {nextCursor && <Link prefetch={false} href={`${pathname}?${next}`}>Next page →</Link>}
  </nav>;
}
