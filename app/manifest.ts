import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StudioFlow",
    short_name: "StudioFlow",
    description: "Thoughtful class booking for modern Pilates studios.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F7F3EA",
    theme_color: "#163C35",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
