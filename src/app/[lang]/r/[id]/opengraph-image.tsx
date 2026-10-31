import { ImageResponse } from "next/og";
import { getT } from "@/i18n/server";
import { levelOf } from "@/lib/levels";
import { loadOgFont as loadFont } from "@/lib/og-font";
import { getSharedRoute } from "@/lib/route-share";

// 공유 코스 미리보기 (카톡·SNS에 링크를 붙였을 때): 출발지와 들르는 곳·도착 시각·혼잡 색
export const alt = "CrowdView route";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const clock = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export default async function OgImage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  const t = getT(lang);
  const r = await getSharedRoute(id);
  const stops = (r?.plan.stops ?? []).filter((s) => !s.meal).slice(0, 5);
  const title = t("한산한 코스");
  const sub = r ? t("{name}에서 출발", { name: r.start.name }) : t("붐비는 시간을 피해 도는 코스");
  const lines = stops.map((s) => ({
    name: s.name.length > 18 ? `${s.name.slice(0, 17)}…` : s.name,
    time: clock(s.arrive),
    color: levelOf(s.score).color,
  }));
  const font = await loadFont(`CrowdView${title}${sub}${lines.map((l) => l.name).join("")}…0123456789:`);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "64px 80px",
        background: "linear-gradient(135deg, #4f46e5 0%, #2563eb 55%, #0ea5e9 100%)",
        color: "white",
        fontFamily: font ? "Noto Sans KR" : "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 32, opacity: 0.85 }}>CrowdView</div>
      <div style={{ display: "flex", fontSize: 64, fontWeight: 700, marginTop: 8 }}>{title}</div>
      <div style={{ display: "flex", fontSize: 30, opacity: 0.9, marginTop: 8 }}>{sub}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 36 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 34 }}>
            <div style={{ display: "flex", width: 110, opacity: 0.85 }}>{l.time}</div>
            <div style={{ display: "flex", width: 26, height: 26, borderRadius: 13, background: l.color, border: "3px solid white" }} />
            <div style={{ display: "flex" }}>{l.name}</div>
          </div>
        ))}
      </div>
    </div>,
    { ...size, fonts: font ? [{ name: "Noto Sans KR", data: font, weight: 700, style: "normal" }] : undefined },
  );
}
