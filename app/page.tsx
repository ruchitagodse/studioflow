import { redirect } from "next/navigation";
import { LoginForm } from "@/app/components/login-form";
import { getCurrentPrincipal } from "@/lib/auth/server";

export default async function Home({ searchParams }: { searchParams: Promise<{ continue?: string }> }) {
  let principal = null;
  try {
    principal = await getCurrentPrincipal();
  } catch {
    // Firebase configuration is surfaced in the login UI for local setup.
  }
  if (principal) redirect("/entry");
  const { continue: continuePath } = await searchParams;
  return <LoginForm continuePath={continuePath} />;
}
