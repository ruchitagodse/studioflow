import { describe, expect, it } from "vitest";
import { loginErrorMessage, validateLoginInput } from "../lib/auth/login-input";

describe("login email validation", () => {
  it.each(["sam@@example.com", "sam@example..com", "sam example@studio.com", "sam", "sam@studio"])("rejects malformed email %s before Firebase", (email) => {
    expect(validateLoginInput(email, "password").fieldErrors.email).toBeDefined();
  });
  it("trims copied email whitespace without modifying a password", () => {
    const result = validateLoginInput("  sam+pilates@example.com \n", " password ");
    expect(result.email).toBe("sam+pilates@example.com");
    expect(result.password).toBe(" password ");
    expect(result.fieldErrors).toEqual({ email: undefined, password: undefined });
  });
  it("identifies missing fields", () => {
    expect(validateLoginInput("  ", "").fieldErrors).toEqual({ email: "Enter your email address.", password: "Enter your password." });
  });
  it("maps invalid-email by Firebase code instead of exposing its raw message", () => {
    expect(loginErrorMessage({ code: "auth/invalid-email", message: "Firebase: Error (auth/invalid-email)." })).toBe("Enter a valid email address, such as name@example.com.");
    expect(loginErrorMessage(new Error("internal implementation details"))).toBe("Unable to sign in. Please try again.");
  });
});
