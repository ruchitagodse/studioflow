import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import styles from "./admin-ui.module.css";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

export function AdminPageHeader({ eyebrow, title, description, actions, breadcrumbs }: { eyebrow: string; title: string; description?: ReactNode; actions?: ReactNode; breadcrumbs?: ReactNode }) {
  return <header className={styles.pageHeader}>{breadcrumbs && <nav className={styles.breadcrumbs} aria-label="Breadcrumb">{breadcrumbs}</nav>}<div className={styles.pageHeaderRow}><div><p className={styles.eyebrow}>{eyebrow}</p><h1>{title}</h1>{description && <p className={styles.description}>{description}</p>}</div>{actions && <div className={styles.headerActions}>{actions}</div>}</div></header>;
}

export function AdminCard({ variant = "default", className = "", ...props }: HTMLAttributes<HTMLElement> & { variant?: "default" | "elevated" | "outlined" | "interactive" | "danger" | "info" }) {
  return <section {...props} className={`${styles.card} ${styles[variant]} ${className}`} />;
}

export function AdminStatCard({ icon, value, label, context }: { icon?: ReactNode; value: ReactNode; label: string; context?: ReactNode }) {
  return <AdminCard className={styles.statCard}>{icon && <span className={styles.statIcon}>{icon}</span>}<strong>{value}</strong><span>{label}</span>{context && <small>{context}</small>}</AdminCard>;
}

export function AdminButton({ variant = "primary", size = "medium", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "icon"; size?: "small" | "medium" | "large" }) {
  return <button {...props} className={`${styles.button} ${styles[variant]} ${styles[size]} ${className}`} />;
}

export function AdminBadge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}

export function AdminFormField({ label, hint, error, required, children }: { label: string; hint?: ReactNode; error?: ReactNode; required?: boolean; children: ReactNode }) {
  return <label className={styles.field}><span>{label}{required && <b aria-hidden="true"> *</b>}</span>{children}{error ? <small className={styles.fieldError}>{error}</small> : hint && <small>{hint}</small>}</label>;
}

export function AdminInput(props: InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className={`${styles.input} ${props.className ?? ""}`} />; }
export function AdminTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} className={`${styles.textarea} ${props.className ?? ""}`} />; }

export function AdminEmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className={styles.emptyState}><h2>{title}</h2>{children && <p>{children}</p>}{action}</div>;
}

export function AdminAlert({ tone = "info", children }: { tone?: Tone; children: ReactNode }) { return <div className={`${styles.alert} ${styles[tone]}`} role={tone === "danger" ? "alert" : "status"}>{children}</div>; }
