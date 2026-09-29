import { redirect } from "next/navigation";
import { connection } from "next/server";
import { CustomerBookingShell } from "@/app/components/customer-booking-shell";
import styles from "@/app/components/booking.module.css";
import { requireWorkspace } from "@/lib/auth/server";

function initials(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "S";
}

export default async function CustomerProfilePage() {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/customer"); } catch { redirect("/access-denied"); }
  const name = principal.email?.split("@")[0] ?? "Studio member";
  return <CustomerBookingShell active="profile" title="Your profile" subtitle="Your account details and StudioFlow access.">
    <section className={styles.profileCard} aria-labelledby="profile-name">
      <span className={styles.profileAvatar} aria-hidden="true">{initials(name)}</span>
      <p className={styles.kicker}>CUSTOMER</p>
      <h2 id="profile-name">{name}</h2>
      <p className={styles.profileEmail}>{principal.email ?? "Email not available"}</p>
      <dl className={styles.profileDetails}>
        <div><dt>Role</dt><dd>Customer</dd></div>
        <div><dt>Account</dt><dd>StudioFlow member</dd></div>
      </dl>
      <p className={styles.profileHint}>Use the account menu in the header to sign out securely.</p>
    </section>
  </CustomerBookingShell>;
}
