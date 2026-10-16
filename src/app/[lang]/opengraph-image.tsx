import { ImageResponse } from "next/og";

// 공유 미리보기 기본 이미지 (페이지에 따로 이미지가 없을 때). 글꼴 파일 없이 그리려고 영어만 쓴다
export const alt = "CrowdView - Live crowd levels in Korea";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #4f46e5 0%, #2563eb 55%, #0ea5e9 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 44, opacity: 0.85, display: "flex" }}>CrowdView</div>
        <div style={{ fontSize: 76, fontWeight: 800, marginTop: 16, lineHeight: 1.1, display: "flex" }}>
          Where is it quiet right now?
        </div>
        <div style={{ fontSize: 36, marginTop: 28, opacity: 0.9, display: "flex" }}>
          Live crowd levels &amp; forecasts · Airports · Theme parks · Festivals · Seoul
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 48 }}>
          {["#10b981", "#84cc16", "#eab308", "#f97316", "#ef4444"].map((c) => (
            <div key={c} style={{ width: 120, height: 18, borderRadius: 9, background: c, display: "flex" }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
