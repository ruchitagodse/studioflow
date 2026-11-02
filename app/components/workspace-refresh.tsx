"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

/** An explicit refresh only: no timers, focus handlers, or background requests. */
export function WorkspaceRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button type="button" onClick={() => startTransition(() => router.refresh())} disabled={pending}
    aria-label="Refresh current page" style={{ minHeight: 44, padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: 9, background: "var(--color-surface)", color: "var(--color-text-muted)", fontSize: 12, cursor: "pointer" }}>
    {pending ? "Refreshing…" : "Refresh"}
  </button>;
}
