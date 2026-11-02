import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ session: "session-a" as string | undefined, uid: "a", disabled: false, docs: new Map<string, Record<string, unknown>>() }));
const verify = vi.hoisted(() => vi.fn());
vi.mock("react", () => ({ cache: (fn: unknown) => fn })); // Each invocation models a new server request.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => state.session ? { value: state.session } : undefined }) }));
vi.mock("../lib/firebase/admin", () => ({ getAdminAuth: () => ({ verifySessionCookie: verify, getUser: async () => ({ uid: state.uid, email: "test@example.invalid", disabled: state.disabled }) }) }));
vi.mock("../lib/firebase/reads", () => ({ readDocument: async (path: string) => ({ exists: state.docs.has(path), data: () => state.docs.get(path) }) }));
import { getCurrentPrincipal, requireWorkspace } from "../lib/auth/server";

beforeEach(() => {
  state.session = "session-a"; state.uid = "a"; state.disabled = false; state.docs.clear();
  verify.mockReset().mockImplementation(async () => ({ uid: state.uid }));
  state.docs.set("userMemberships/a", { studioId: "alpha", status: "active", roles: ["customer"] });
  state.docs.set("studios/alpha", { status: "active" });
  state.docs.set("studios/alpha/members/a", { status: "active", roles: ["customer"] });
});

describe("fresh trusted session and membership verification", () => {
  it("restores a verified session without trusting browser roles", async () => {
    expect(await requireWorkspace("/customer")).toMatchObject({ uid: "a", studioId: "alpha", roles: ["customer"] });
    expect(verify).toHaveBeenCalledWith("session-a", true);
  });
  it("does not read a membership when there is no session", async () => {
    state.session = undefined;
    expect(await getCurrentPrincipal()).toBeNull(); expect(verify).not.toHaveBeenCalled();
  });
  it("recognizes revoked membership on the next navigation", async () => {
    await requireWorkspace("/customer");
    state.docs.set("studios/alpha/members/a", { status: "inactive", roles: ["customer"] });
    await expect(requireWorkspace("/customer")).rejects.toThrow("FORBIDDEN_WORKSPACE");
  });
  it("recognizes studio deactivation and disabled accounts on the next request", async () => {
    await requireWorkspace("/customer");
    state.docs.set("studios/alpha", { status: "deactivated" });
    expect((await getCurrentPrincipal())?.workspace).toBe("/access-denied");
    state.docs.set("studios/alpha", { status: "active" }); state.disabled = true;
    expect((await getCurrentPrincipal())?.workspace).toBe("/access-denied");
  });
  it("does not reuse the previous user's studio after session changes", async () => {
    await requireWorkspace("/customer");
    state.uid = "b"; state.session = "session-b";
    state.docs.set("userMemberships/b", { studioId: "beta", status: "active", roles: ["trainer"] });
    state.docs.set("studios/beta", { status: "active" });
    state.docs.set("studios/beta/members/b", { status: "active", roles: ["trainer"] });
    expect(await requireWorkspace("/trainer")).toMatchObject({ uid: "b", studioId: "beta" });
    await expect(requireWorkspace("/customer")).rejects.toThrow("FORBIDDEN_WORKSPACE");
  });
  it("rejects revoked session cookies without falling back to cached roles", async () => {
    verify.mockRejectedValueOnce(new Error("auth/session-cookie-revoked"));
    await expect(getCurrentPrincipal()).rejects.toThrow("auth/session-cookie-revoked");
  });
});
