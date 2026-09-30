"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseClientConfigured, getClientAuth } from "@/lib/firebase/client";
import styles from "./sprint-one.module.css";

export function LoginForm({ continuePath }: { continuePath?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const configured = firebaseClientConfigured();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget); const email = String(form.get("email") ?? "").trim(); const password = String(form.get("password") ?? "");
    const nextErrors = { email: !email ? "Enter your email address." : !/^\S+@\S+\.\S+$/.test(email) ? "Enter a valid email address." : undefined, password: !password ? "Enter your password." : undefined };
    setFieldErrors(nextErrors); if (nextErrors.email || nextErrors.password) return;
    setPending(true);
    try { const credential = await signInWithEmailAndPassword(getClientAuth(), email, password); const response = await fetch("/api/auth/session", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: await credential.user.getIdToken() }) }); const result = await response.json() as { message?: string }; if (!response.ok) throw new Error(result.message ?? "Unable to establish a secure session."); router.replace(continuePath?.startsWith("/invite/") ? continuePath : "/entry"); } catch (reason) { setError(reason instanceof Error ? friendlyAuthError(reason.message) : "Unable to sign in. Please try again."); setPending(false); }
  }

  return <main className={styles.authPage}><section className={styles.authAside} aria-hidden="true"><div className={styles.brand}><span>S</span>studioflow</div><div><p>WELCOME BACK</p><h1>Practice,<br />without the admin.</h1><small>A thoughtful home for your Pilates studio.</small></div><div className={styles.authShape} /></section><section className={styles.authPanel}><div className={styles.mobileBrand}><span>S</span>studioflow</div><div className={styles.authCard}><p className={styles.kicker}>SIGN IN</p><h2>Welcome back</h2><p className={styles.muted}>Use the credentials provided by your studio.</p>{!configured && <div className={styles.warning} role="alert"><b>Firebase setup required</b><span>Add the values in <code>.env.local</code> from <code>.env.example</code> to enable sign-in.</span></div>}<form onSubmit={onSubmit} className={styles.form} noValidate><label>Email<input name="email" type="email" autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "login-email-error" : undefined} disabled={!configured || pending} placeholder="you@studio.com" onChange={() => setFieldErrors((current) => ({ ...current, email: undefined }))} /></label>{fieldErrors.email && <p id="login-email-error" className={styles.fieldError} role="alert">{fieldErrors.email}</p>}<label>Password<span className={styles.passwordField}><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "login-password-error" : undefined} disabled={!configured || pending} placeholder="Your password" onChange={() => setFieldErrors((current) => ({ ...current, password: undefined }))} /><button type="button" className={styles.passwordToggle} onClick={() => setShowPassword((visible) => !visible)} disabled={!configured || pending} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.7" />{showPassword && <path d="m4 4 16 16" />}</svg></button></span></label>{fieldErrors.password && <p id="login-password-error" className={styles.fieldError} role="alert">{fieldErrors.password}</p>}{error && <p className={styles.formError} role="alert">{error}</p>}<button className={styles.primary} disabled={!configured || pending}>{pending ? "Signing you in…" : "Sign in"}</button></form><Link className={styles.textLink} href="/forgot-password">Forgot your password?</Link><p className={styles.authFoot}>Need access? Contact your studio administrator.</p></div></section></main>;
}

function friendlyAuthError(message: string) { if (message.includes("invalid-credential") || message.includes("wrong-password")) return "That email or password is not recognised."; if (message.includes("too-many-requests")) return "Too many attempts. Please wait a moment and try again."; return message; }
