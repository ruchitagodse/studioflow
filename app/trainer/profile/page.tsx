import { redirect } from "next/navigation";
import { connection } from "next/server";
import { TrainerMobileNav } from "@/app/components/trainer-mobile-nav";
import styles from "@/app/trainer/trainer-dashboard.module.css";
import { requireWorkspace } from "@/lib/auth/server";

function initials(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "T";
}

export default async function TrainerProfilePage() {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/trainer"); } catch { redirect("/access-denied"); }
  const name = principal.email?.split("@")[0] ?? "Trainer";
  return <main className={`${styles.page} ${styles.profilePage}`}>
    <header className={styles.profileHeader}><p className={styles.kicker}>TRAINER WORKSPACE</p><h1>Your profile</h1><p>Account details for your StudioFlow trainer access.</p></header>
    <section className={styles.trainerProfileCard} aria-labelledby="trainer-profile-name">
      <span className={styles.trainerAvatar} aria-hidden="true">{initials(name)}</span>
      <p className={styles.kicker}>TRAINER</p>
      <h2 id="trainer-profile-name">{name}</h2>
      <p className={styles.profileEmail}>{principal.email ?? "Email not available"}</p>
      <dl className={styles.profileDetails}><div><dt>Role</dt><dd>Trainer</dd></div><div><dt>Access</dt><dd>StudioFlow member</dd></div></dl>
      <p className={styles.profileHint}>Use the account menu in the header to sign out securely.</p>
    </section>
    <TrainerMobileNav active="profile" />
  </main>;
}
