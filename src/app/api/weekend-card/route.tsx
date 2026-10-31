// 주간 '이번 주말 한산한 곳' 카드 (lib/weekend-pick). 인스타 세로 1080×1350 PNG, ?text=1 이면 같이 올릴 글.
// 매주 목요일 새벽 수집기가 이 주소와 글을 경수님 메일로 보낸다 (api/cron/refresh). 한 시간 캐시
import { ImageResponse } from "next/og";
import { levelOf } from "@/lib/levels";
import { loadOgFont } from "@/lib/og-font";
import { md, weekendCaption, weekendPicks, type WeekendPick } from "@/lib/weekend-pick";

export const revalidate = 3600;

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("text")) {
    return new Response(await weekendCaption(), { headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const { sat, sun, calm, busy } = await weekendPicks();
  const names = [...calm, ...busy].map((p) => p.place.name).join("");
  const title = "이번 주말 어디가 한산할까?";
  const sub = `${md(sat)}(토)·${md(sun)}(일) AI 예측`;
  const font = await loadOgFont(`${title}${sub}${names}비교적 한산할 곳붐빌 곳쾌적원활보통혼잡매우실시간 혼잡도는crowdview.appCrowdView0123456789·()/`);
  const row = (p: WeekendPick, i: number) => {
    const lv = levelOf(p.score);
    return (
      <div key={p.place.id} style={{ display: "flex", alignItems: "center", gap: 22, padding: "12px 0", borderTop: i ? "2px solid #eef0f5" : "none" }}>
        <div style={{ display: "flex", width: 22, height: 22, borderRadius: 11, background: lv.color }} />
        <div style={{ display: "flex", flex: 1, fontSize: 44, fontWeight: 700, color: "#111827" }}>{p.place.name}</div>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: lv.color }}>{lv.label}</div>
      </div>
    );
  };
  const box = (label: string, color: string, rows: WeekendPick[]) => (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0, background: "white", borderRadius: 36, padding: "26px 44px", marginTop: 28, boxShadow: "0 4px 18px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color, marginBottom: 6 }}>{label}</div>
      {rows.map(row)}
    </div>
  );
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #eef2ff 0%, #f8fafc 60%)", padding: "64px 64px", fontFamily: font ? "Noto Sans KR" : "sans-serif" }}>
      <div style={{ display: "flex", flexShrink: 0, fontSize: 32, fontWeight: 700, color: "#4f46e5" }}>CrowdView</div>
      <div style={{ display: "flex", flexShrink: 0, fontSize: 76, fontWeight: 700, color: "#111827", marginTop: 14, lineHeight: 1.2 }}>{title}</div>
      <div style={{ display: "flex", flexShrink: 0, fontSize: 36, fontWeight: 700, color: "#6b7280", marginTop: 12 }}>{sub}</div>
      {box("비교적 한산할 곳", "#059669", calm)}
      {box("붐빌 곳", "#dc2626", busy)}
      <div style={{ display: "flex", marginTop: "auto", fontSize: 34, fontWeight: 700, color: "#4f46e5" }}>실시간 혼잡도는 crowdview.app</div>
    </div>,
    { width: 1080, height: 1350, fonts: font ? [{ name: "Noto Sans KR", data: font, weight: 700, style: "normal" }] : undefined },
  );
}
