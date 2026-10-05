import { describe, expect, it } from "vitest";
import { displayCustomerDate } from "../lib/customer-display";

describe("customer date display", () => {
  it("shows stored studio-local dates as dd MMM yy without a timezone shift", () => {
    expect(displayCustomerDate("2026-10-05")).toBe("05 Oct 26");
    expect(displayCustomerDate("2026-01-09")).toBe("09 Jan 26");
  });
});
