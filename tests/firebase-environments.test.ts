import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const directories: string[] = [];
const nextEnvPath = createRequire(import.meta.url).resolve("@next/env");
afterEach(() => {
  for (const directory of directories.splice(0)) {
    if (!resolve(directory).startsWith(resolve(join(tmpdir(), "studio-firebase-env-")))) throw new Error("Unexpected fixture cleanup path");
    rmSync(directory, { recursive: true, force: true });
  }
});

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "studio-firebase-env-"));
  directories.push(directory);
  writeFileSync(join(directory, ".env.local"), "NEXT_PUBLIC_FIREBASE_PROJECT_ID=bookingsystem-27cdc\nFIREBASE_PROJECT_ID=bookingsystem-27cdc\nFIREBASE_CLIENT_EMAIL=testing-only@example.invalid\nFIREBASE_PRIVATE_KEY=testing-fixture-not-a-real-key\n");
  writeFileSync(join(directory, ".env.development.local"), "NEXT_PUBLIC_FIREBASE_PROJECT_ID=bookingsystem-27cdc\nFIREBASE_PROJECT_ID=bookingsystem-27cdc\n");
  writeFileSync(join(directory, ".env.production.local"), "NEXT_PUBLIC_FIREBASE_PROJECT_ID=studiocalendar-91fb0\nFIREBASE_PROJECT_ID=studiocalendar-91fb0\nFIREBASE_CLIENT_EMAIL=\"\"\nFIREBASE_PRIVATE_KEY=\"\"\n");
  return directory;
}

function load(directory: string, mode: "development" | "production", overrides: Record<string, string> = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("FIREBASE_") && !key.startsWith("NEXT_PUBLIC_FIREBASE_") && !["__NEXT_PROCESSED_ENV", "NODE_ENV"].includes(key)));
  const script = `const {loadEnvConfig}=require(${JSON.stringify(nextEnvPath)}); const {combinedEnv:e}=loadEnvConfig(process.argv[1],process.argv[2]==="development",{info(){},error(){}}); console.log(JSON.stringify({webProject:e.NEXT_PUBLIC_FIREBASE_PROJECT_ID,serverProject:e.FIREBASE_PROJECT_ID,adminConfigured:Boolean(e.FIREBASE_CLIENT_EMAIL&&e.FIREBASE_PRIVATE_KEY)}));`;
  return JSON.parse(execFileSync(process.execPath, ["-e", script, directory, mode], { env: { ...env, NODE_ENV: mode, ...overrides }, encoding: "utf8" }));
}

describe("automatic Next.js Firebase environment selection", () => {
  it("uses testing keys in development", () => {
    expect(load(fixture(), "development")).toEqual({ webProject: "bookingsystem-27cdc", serverProject: "bookingsystem-27cdc", adminConfigured: true });
  });
  it("uses production keys and never falls back to testing Admin credentials", () => {
    expect(load(fixture(), "production")).toEqual({ webProject: "studiocalendar-91fb0", serverProject: "studiocalendar-91fb0", adminConfigured: false });
  });
  it("respects explicit hosting variables for a testing preview build", () => {
    expect(load(fixture(), "production", { NEXT_PUBLIC_FIREBASE_PROJECT_ID: "bookingsystem-27cdc", FIREBASE_PROJECT_ID: "bookingsystem-27cdc", FIREBASE_CLIENT_EMAIL: "preview@example.invalid", FIREBASE_PRIVATE_KEY: "preview-fixture-not-a-real-key" })).toEqual({ webProject: "bookingsystem-27cdc", serverProject: "bookingsystem-27cdc", adminConfigured: true });
  });
});
