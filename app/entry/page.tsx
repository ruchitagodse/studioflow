import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentPrincipal } from "@/lib/auth/server";
import { isFirestoreQuotaError } from "@/lib/firebase/quota";
import { ServiceUnavailable } from "@/app/components/service-unavailable";

export default async function EntryPage() {
  await connection();
  let principal = null;
  try {
    principal = await getCurrentPrincipal();
  } catch (error) {
    if (isFirestoreQuotaError(error)) return <ServiceUnavailable />;
    console.error("Studio Calendar access resolution failed at /entry.", error);
  }
  redirect(principal?.workspace ?? "/");
}
