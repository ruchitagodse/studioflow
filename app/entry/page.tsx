import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentPrincipal } from "@/lib/auth/server";

export default async function EntryPage() {
  await connection();
  let principal = null;
  try {
    principal = await getCurrentPrincipal();
  } catch (error) {
    console.error("StudioFlow access resolution failed at /entry.", error);
  }
  redirect(principal?.workspace ?? "/");
}
