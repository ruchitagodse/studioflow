import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#163C35", color: "#C7D8CE", fontSize: 270, fontFamily: "Georgia", fontStyle: "italic", fontWeight: 700 }}>
      S
    </div>,
    size,
  );
}
