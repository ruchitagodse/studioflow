import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 40, background: "#163C35", color: "#C7D8CE", fontSize: 100, fontFamily: "Georgia", fontStyle: "italic", fontWeight: 700 }}>
      S
    </div>,
    size,
  );
}
