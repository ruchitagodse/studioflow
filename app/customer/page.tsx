import { redirect } from "next/navigation";
import { connection } from "next/server";
import { CustomerBookingShell } from "@/app/components/customer-booking-shell";
import { CustomerSchedule } from "@/app/components/customer-schedule";
import { requireWorkspace } from "@/lib/auth/server";
import { getCustomerSchedule } from "@/lib/bookings";

export default async function CustomerWorkspace() {
  await connection();
  let principal;
  let accessError: unknown;
  try { principal = await requireWorkspace("/customer"); } catch (error) {
    accessError = error;
    console.error("Studio Calendar customer access resolution failed.", error);
  }
  if (!principal) redirect(accessError instanceof Error && accessError.message === "NO_ACTIVE_SESSION" ? "/" : "/access-denied");
  let schedule;
  try { schedule = await getCustomerSchedule(principal, false); } catch (error) {
    console.error("Studio Calendar customer schedule failed.", error);
    redirect("/access-denied");
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: schedule.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <CustomerBookingShell active="book" title="Ready for your next session?" subtitle={`Find your rhythm at ${schedule.studioName}.`} compactHeader heroHeader>
    <CustomerSchedule slots={schedule.slots} timezone={schedule.timezone} today={today} />
  </CustomerBookingShell>;
}
