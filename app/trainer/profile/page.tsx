import { redirect } from "next/navigation";
import { connection } from "next/server";
import Image from "next/image";
import { TrainerMobileNav } from "@/app/components/trainer-mobile-nav";
import styles from "@/app/trainer/trainer-dashboard.module.css";
import { requireWorkspace } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";
import heroImage from "@/app/assets/pilates-hero-v2.png";

function initials(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "T";
}

function ProfileIcon({ name }: { name: "person" | "account" }) {
  const paths = name === "person"
    ? <><circle cx="12" cy="8" r="3" /><path d="M5.5 20c.7-3.6 2.9-5.5 6.5-5.5s5.8 1.9 6.5 5.5" /></>
    : <><path d="m5 9 2.2 9h9.6L19 9l-3-2.5-4 2-4-2L5 9Z" /><path d="M9 11.5h6" /></>;
  return <span className={styles.trainerProfileDetailIcon} aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">{paths}</svg></span>;
}

export default async function TrainerProfilePage() {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/trainer"); } catch { redirect("/access-denied"); }
  const member = await getAdminDb().doc(`studios/${principal.studioId}/members/${principal.uid}`).get();
  const name = String(member.data()?.displayName ?? "").trim() || "Trainer";
  return <main className={`${styles.page} ${styles.profilePage}`}>
    <header className={styles.profileHeader}><h1>Your profile</h1><p>Account details for your StudioFlow trainer access.</p></header>
    <section className={styles.trainerProfileSurface} aria-labelledby="trainer-profile-name">
      <div className={styles.trainerProfileHeroImage} aria-hidden="true"><Image src={heroImage} alt="" fill sizes="100vw" priority /></div>
      <div className={styles.trainerProfileCard}>
        <span className={styles.trainerAvatar} aria-hidden="true">{initials(name)}</span>
        <p className={styles.kicker}>TRAINER</p>
        <h2 id="trainer-profile-name">{name}</h2>
        <p className={styles.profileEmail}>{principal.email ?? "Email not available"}</p>
        <dl className={styles.profileDetails}>
          <div><ProfileIcon name="person" /><dt>Role</dt><dd>Trainer</dd><span className={styles.trainerProfileChevron} aria-hidden="true">›</span></div>
          <div><ProfileIcon name="account" /><dt>Account</dt><dd>StudioFlow member</dd><span className={styles.trainerProfileChevron} aria-hidden="true">›</span></div>
        </dl>
      </div>
    </section>
    <TrainerMobileNav active="profile" />
  </main>;
}
