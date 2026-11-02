"use client";

import { useTransition } from "react";
import styles from "./components/sprint-one.module.css";

export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [pending, startTransition] = useTransition();
  return <main className={styles.simplePage}><section className={styles.simpleCard}>
    <p className={styles.kicker}>PLEASE TRY AGAIN LATER</p><h1>We couldn’t load this page.</h1>
    <p className={styles.muted}>Your studio information is temporarily unavailable. Wait a little before trying again. If this continues, contact your studio administrator.</p>
    <button className={styles.primaryLink} disabled={pending} onClick={() => startTransition(reset)}>{pending ? "Trying again…" : "Try again"}</button>
  </section></main>;
}
