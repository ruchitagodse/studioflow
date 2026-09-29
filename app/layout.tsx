import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { getCurrentPrincipal } from "@/lib/auth/server";
import { getActiveStudioTheme } from "@/lib/studio-theme";
import { resolveTheme } from "@/lib/theme";
import { themePreferenceCookieName } from "@/lib/theme-preference";
import { PwaSupport } from "@/app/components/pwa-support";

export const metadata: Metadata = {
  title: "StudioFlow — Pilates made simple",
  description: "Thoughtful class booking for modern Pilates studios.",
  applicationName: "StudioFlow",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "StudioFlow",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#163C35",
  colorScheme: "light dark",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  let theme = "nature-minimal";
  let principal = null;
  try { principal = await getCurrentPrincipal(); } catch { /* Public and loading routes use the safe default. */ }
  if (principal?.studioId) {
    try { theme = await getActiveStudioTheme(principal); } catch { /* Preserve a usable visual fallback when theme loading is unavailable. */ }
  } else {
    theme = resolveTheme((await cookies()).get(themePreferenceCookieName)?.value);
  }
  return (
    <html lang="en" data-theme={theme}>
      <body className="min-h-full flex flex-col" suppressHydrationWarning><PwaSupport persistTheme={Boolean(principal?.studioId)} />{children}</body>
    </html>
  );
}
