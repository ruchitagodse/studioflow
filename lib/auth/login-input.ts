import { z } from "zod";

const emailSchema = z.string().email();

export function validateLoginInput(rawEmail: string, password: string) {
  const email = rawEmail.trim();
  const fieldErrors = {
    email: !email ? "Enter your email address." : !emailSchema.safeParse(email).success ? "Enter a valid email address, such as name@example.com." : undefined,
    password: !password ? "Enter your password." : undefined,
  };
  return { email, password, fieldErrors };
}

export function loginErrorCode(error: unknown): string {
  return error !== null && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "";
}

export function loginErrorMessage(error: unknown) {
  switch (loginErrorCode(error)) {
    case "auth/invalid-email": return "Enter a valid email address, such as name@example.com.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found": return "That email or password is not recognised.";
    case "auth/too-many-requests": return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed": return "Unable to connect. Check your internet connection and try again.";
    case "auth/user-disabled": return "This account is unavailable. Contact your studio administrator.";
    default: return "Unable to sign in. Please try again.";
  }
}
