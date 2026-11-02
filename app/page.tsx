import { redirect } from "next/navigation";
import { LoginForm } from "@/app/components/login-form";
import { getCurrentPrincipal } from "@/lib/auth/server";
import { isFirestoreQuotaError } from "@/lib/firebase/quota";
import { ServiceUnavailable } from "@/app/components/service-unavailable";

export default async function Home({ searchParams }: { searchParams: Promise<{ continue?: string }> }) {
  let principal = null;
  try {
    principal = await getCurrentPrincipal();
  } catch (error) {
    if (isFirestoreQuotaError(error)) return <ServiceUnavailable />;
    // Firebase configuration is surfaced in the login UI for local setup.
  }
  if (principal) redirect("/entry");
  const { continue: continuePath } = await searchParams;
  return <LoginForm continuePath={continuePath} />;
}
