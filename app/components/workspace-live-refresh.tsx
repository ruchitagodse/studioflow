"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Keeps server-authoritative booking, capacity, and roster views current without browser Firestore access. */
export function WorkspaceLiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const interval = window.setInterval(refresh, 15_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); };
  }, [router]);
  return null;
}
