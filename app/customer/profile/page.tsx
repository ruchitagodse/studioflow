import { redirect } from "next/navigation";
import { connection } from "next/server";
import Image from "next/image";
import { CustomerBookingShell } from "@/app/components/customer-booking-shell";
import styles from "@/app/components/booking.module.css";
import { requireWorkspace } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";
import heroImage from "@/app/assets/pilates-hero-v2.png";

function initials(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "S";
}

function ProfileIcon({ name }: { name: "person" | "account" }) {
  const paths = name === "person"
    ? <><circle cx="12" cy="8" r="3" /><path d="M5.5 20c.7-3.6 2.9-5.5 6.5-5.5s5.8 1.9 6.5 5.5" /></>
    : <><path d="m5 9 2.2 9h9.6L19 9l-3-2.5-4 2-4-2L5 9Z" /><path d="M9 11.5h6" /></>;
  return <span className={styles.profileDetailIcon} aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">{paths}</svg></span>;
}

export default async function CustomerProfilePage() {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/customer"); } catch { redirect("/access-denied"); }
  const member = principal.studioId ? await getAdminDb().doc(`studios/${principal.studioId}/members/${principal.uid}`).get() : null;
  const name = String(member?.data()?.displayName ?? "").trim() || principal.email?.split("@")[0] || "Studio member";
  return <CustomerBookingShell active="profile" title="Your profile" subtitle="Your account details and StudioFlow access." profileHeader>
    <section className={styles.profileSurface} aria-labelledby="profile-name">
      <div className={styles.profileHeroImage} aria-hidden="true"><Image src={heroImage} alt="" fill sizes="100vw" priority /></div>
      <div className={styles.profileCard}>
        <span className={styles.profileAvatar} aria-hidden="true">{initials(name)}<span className={styles.profileEditMark}><svg viewBox="0 0 24 24" focusable="false"><path d="m5 19 3.4-.7L18 8.7a2.1 2.1 0 0 0-3-3l-9.6 9.6L5 19Z" /><path d="m13.5 7.2 3.3 3.3" /></svg></span></span>
        <p className={styles.kicker}>CUSTOMER</p>
        <h2 id="profile-name">{name}</h2>
        <p className={styles.profileEmail}>{principal.email ?? "Email not available"}</p>
        <dl className={styles.profileDetails}>
          <div><ProfileIcon name="person" /><dt>Role</dt><dd>Customer</dd><span className={styles.profileChevron} aria-hidden="true">›</span></div>
          <div><ProfileIcon name="account" /><dt>Account</dt><dd>StudioFlow member</dd><span className={styles.profileChevron} aria-hidden="true">›</span></div>
        </dl>
      </div>
    </section>
  </CustomerBookingShell>;
}
