import { readDocument } from "@/lib/firebase/reads";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import Image from "next/image";
import Link from "next/link";
import { CustomerBookingShell } from "@/app/components/customer-booking-shell";
import { LogoutButton } from "@/app/components/logout-button";
import { requireWorkspace } from "@/lib/auth/server";
import heroImage from "@/app/assets/pilates-hero-v2.png";
import styles from "./customer-profile.module.css";

function initials(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "S";
}

function ProfileIcon({ name }: { name: "calendar" | "membership" | "studio" | "security" }) {
  const paths = {
    calendar: <><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4m8-4v4M4 11h16M8 15h3" /></>,
    membership: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18m-13 5h4" /></>,
    studio: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    security: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

export default async function CustomerProfilePage() {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/customer"); } catch { redirect("/access-denied"); }
  if (!principal.studioId) redirect("/access-denied");
  const [member, studio] = await Promise.all([
    readDocument(`studios/${principal.studioId}/members/${principal.uid}`),
    readDocument(`studios/${principal.studioId}`),
  ]);
  const name = String(member.data()?.displayName ?? "").trim() || principal.email?.split("@")[0] || "Studio member";
  const studioName = String(studio.data()?.name ?? "Your Pilates studio");
  return <CustomerBookingShell active="profile" title="Your profile" subtitle="Your Pilates space, all in one place." profileHeader>
    <div className={styles.profile}>
      <section className={styles.identityCard} aria-labelledby="profile-name">
        <div className={styles.cover}><Image src={heroImage} alt="" fill sizes="(max-width: 767px) 100vw, 700px" priority /><span>MAKE TIME FOR YOURSELF</span></div>
        <div className={styles.identity}><span className={styles.avatar} aria-hidden="true">{initials(name)}</span><div><span className={styles.memberLabel}>PILATES MEMBER</span><h2 id="profile-name">{name}</h2><p>{principal.email ?? "Email not available"}</p></div></div>
      </section>
      <nav className={styles.shortcuts} aria-label="Your Pilates membership and bookings">
        <Link prefetch={false} href="/customer/entitlements"><span className={styles.shortcutIcon}><ProfileIcon name="membership" /></span><span aria-hidden="true" className={styles.arrow}>↗</span><strong>My membership</strong><small>Plan, class passes & pause</small></Link>
        <Link prefetch={false} href="/customer/bookings"><span className={styles.shortcutIcon}><ProfileIcon name="calendar" /></span><span aria-hidden="true" className={styles.arrow}>↗</span><strong>My bookings</strong><small>Upcoming classes & history</small></Link>
      </nav>
      <section className={styles.account} aria-labelledby="account-details"><h2 id="account-details">Account details</h2><div className={styles.accountCard}>
        <div className={styles.accountRow}><span className={styles.rowIcon}><ProfileIcon name="studio" /></span><div><span>Your studio</span><strong>{studioName}</strong></div><small>Customer</small></div>
        <Link prefetch={false} className={styles.accountRow} href="/forgot-password"><span className={styles.rowIcon}><ProfileIcon name="security" /></span><div><strong>Password & security</strong><span>Reset your account password</span></div><span className={styles.chevron} aria-hidden="true">›</span></Link>
      </div></section>
      <footer className={styles.footer}><LogoutButton className={styles.signOut} withIcon /><p>Need to update your details? Contact your studio team.</p></footer>
    </div>
  </CustomerBookingShell>;
}
