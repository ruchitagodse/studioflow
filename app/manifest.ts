import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Studio Calendar by PROSPERA",
    short_name: "Studio Calendar",
    description: "Thoughtful class booking for modern Pilates studios.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FAF7F2",
    theme_color: "#121617",
    icons: [
      { src: "/icons/studio-calendar-v2-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/studio-calendar-v2-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/studio-calendar-v2-1024.png", sizes: "1024x1024", type: "image/png", purpose: "any" },
      { src: "/brand/studio-calendar-monogram.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/studio-calendar-maskable-v2.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
