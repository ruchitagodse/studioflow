import { describe, expect, it } from "vitest";
import { provisionStudioSchema } from "../lib/validation";

describe("provisionStudioSchema", () => {
  it("requires a supported timezone and matching owner provisioning input", () => {
    expect(provisionStudioSchema.safeParse({ name: "Momentum", timezone: "Asia/Kolkata", ownerMode: "create", ownerEmail: "owner@example.com" }).success).toBe(true);
    expect(provisionStudioSchema.safeParse({ name: "Momentum", timezone: "Not/AZone", ownerMode: "create", ownerEmail: "owner@example.com" }).success).toBe(false);
    expect(provisionStudioSchema.safeParse({ name: "Momentum", timezone: "Asia/Kolkata", ownerMode: "assign" }).success).toBe(false);
  });
});
