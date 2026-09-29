"use client";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getClientAuth } from "@/lib/firebase/client";
import styles from "./sprint-one.module.css";

export function LogoutButton({ className, withIcon = false }: { className?: string; withIcon?: boolean }) {
  const router = useRouter();
  async function logout() { try { await signOut(getClientAuth()); } catch {} await fetch("/api/auth/session", { method: "DELETE" }); router.replace("/"); }
  return <button className={`${styles.logout}${className ? ` ${className}` : ""}`} type="button" onClick={logout}>
    {withIcon && <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M14 8l4 4-4 4M18 12H9" /></svg>}
    Sign out
  </button>;
}
