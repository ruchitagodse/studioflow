import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F3EA" }}>
      <div style={{ position: "relative", width: 408, height: 408, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 136, background: "#163C35" }}>
        <div style={{ position: "absolute", top: 64, right: -42, width: 274, height: 274, border: "25px solid #BFD8CB", borderRadius: "50%" }} />
        <div style={{ position: "absolute", bottom: 61, left: 63, width: 105, height: 105, borderRadius: "50%", background: "#DDE8DF" }} />
        <div style={{ position: "relative", marginTop: -5, color: "#F7F3EA", fontFamily: "Georgia", fontSize: 252, fontStyle: "italic", fontWeight: 700, lineHeight: 1, letterSpacing: -28 }}>S</div>
      </div>
    </div>,
    size,
  );
}
