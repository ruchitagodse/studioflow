"use client";

import { useState, type ReactNode } from "react";
import styles from "./studio-mobile-overview.module.css";

export function StudioOverviewDetails({ children, className }: { children: ReactNode; className: string }) {
  const [expanded, setExpanded] = useState(false);
  return <section className={`${className} ${styles.details}`}>
    <button className={styles.detailsToggle} type="button" aria-expanded={expanded} aria-controls="studio-overview-details" onClick={() => setExpanded(!expanded)}>Studio details <span aria-hidden="true">{expanded ? "−" : "+"}</span></button>
    <div id="studio-overview-details" className={styles.detailsBody} data-expanded={expanded}>{children}</div>
  </section>;
}
