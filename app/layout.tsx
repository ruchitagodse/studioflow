import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { getCurrentPrincipal } from "@/lib/auth/server";
import { getActiveStudioAppearance } from "@/lib/studio-theme";
import { resolveTheme } from "@/lib/theme";
import { themePreferenceCookieName } from "@/lib/theme-preference";
import { PwaSupport } from "@/app/components/pwa-support";
import { getApprovedBrandPalette, paletteVariables } from "@/lib/brand-palettes";

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
  let variables: Record<string, string> = {};
  let principal = null;
  try { principal = await getCurrentPrincipal(); } catch { /* Public and loading routes use the safe default. */ }
  if (principal?.studioId) {
    try { const appearance = await getActiveStudioAppearance(principal); theme = appearance.theme; variables = appearance.variables; } catch { /* Preserve a usable visual fallback when theme loading is unavailable. */ }
  } else {
    const preference = (await cookies()).get(themePreferenceCookieName)?.value;
    const [kind, paletteId] = String(preference ?? "").split(":", 2);
    if (kind === "custom-brand" && paletteId) {
      const palette = await getApprovedBrandPalette(paletteId);
      if (palette) { theme = "custom-brand"; variables = paletteVariables(palette); }
    } else theme = resolveTheme(preference);
  }
  return (
    <html lang="en" data-theme={theme} style={variables}>
      <body className="min-h-full flex flex-col" suppressHydrationWarning><PwaSupport persistTheme={Boolean(principal?.studioId)} />{children}</body>
    </html>
  );
}
