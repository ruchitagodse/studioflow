import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F3EA" }}>
      <div style={{ position: "relative", width: 144, height: 144, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 48, background: "#163C35" }}>
        <div style={{ position: "absolute", top: 22, right: -15, width: 98, height: 98, border: "9px solid #BFD8CB", borderRadius: "50%" }} />
        <div style={{ position: "absolute", bottom: 22, left: 22, width: 37, height: 37, borderRadius: "50%", background: "#DDE8DF" }} />
        <div style={{ position: "relative", marginTop: -2, color: "#F7F3EA", fontFamily: "Georgia", fontSize: 88, fontStyle: "italic", fontWeight: 700, lineHeight: 1, letterSpacing: -10 }}>S</div>
      </div>
    </div>,
    size,
  );
}
