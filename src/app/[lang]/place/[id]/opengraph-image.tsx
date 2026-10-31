import { ImageResponse } from "next/og";
import { isLang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { getAllCrowd } from "@/lib/crowd/service";
import { headcountInfo } from "@/lib/format";
import { inkOf, levelOf } from "@/lib/levels";
import { loadOgFont } from "@/lib/og-font";
import { heroImage } from "@/lib/place-photos";
import { PLACES } from "@/lib/places";
import { SITE } from "@/lib/seo";
import { kst } from "@/lib/time";

// 장소 공유 미리보기 (경수님 10/31 '알리기' 1번: 카톡 단톡방에 링크 하나로 "지금 가도 돼?"에 답하게).
// 대표 사진 위에 그 순간 혼잡도·인원. 카카오는 미리보기를 오래 기억하므로 '몇 시 기준'을 꼭 함께 적는다 (옛 '원활'이 지금처럼 보이지 않게)
export const alt = "CrowdView";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 300;

export default async function OgImage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  const t = getT(lang);
  const place = PLACES.find((p) => p.id === id);
  const crowd = place ? (await getAllCrowd().catch(() => ({}) as Awaited<ReturnType<typeof getAllCrowd>>))[id] : undefined;
  const name = place ? t(place.name) : "CrowdView";
  const open = !!crowd?.open;
  const level = crowd ? levelOf(crowd.score) : undefined;
  const status = !crowd ? t("실시간 혼잡도") : open ? t(level!.label) : t("운영 시간 아님");
  const people = crowd && open ? (crowd.avgWaitMin !== undefined ? t("놀이기구 평균 대기 {n}분", { n: crowd.avgWaitMin }) : headcountInfo(crowd, { t, lang: isLang(lang) ? lang : "ko" })?.text) : undefined;
  const now = kst();
  const at = t("{m}/{d} {hh}:{mm} 기준", { m: Number(now.date.slice(5, 7)), d: Number(now.date.slice(8, 10)), hh: String(Math.floor(now.hour)).padStart(2, "0"), mm: String(Math.floor((now.hour % 1) * 60)).padStart(2, "0") });
  const src = place ? heroImage(place) : undefined;
  const img = src ? (src.startsWith("/") ? `${SITE}${src}` : src) : undefined;
  const font = await loadOgFont(`CrowdView${name}${status}${people ?? ""}${at}${t("지금 {level}", { level: status })}${t("실시간 혼잡도 · AI 예측")}0123456789:/`);
  const color = open && level ? level.color : "#9ca3af";

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#1f2937", fontFamily: font ? "Noto Sans KR" : "sans-serif" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse 안 */}
      {img && <img src={img} alt="" width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }} />}
      {/* 글자 쪽(왼쪽·아래)을 어둡게 — 밝은 사진 위에서도 읽히게 (satori는 inset을 몰라 top/left/width/height로) */}
      <div style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, display: "flex", backgroundImage: "linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.15) 100%)" }} />
      <div style={{ position: "absolute", top: 280, left: 0, width: 1200, height: 350, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 100%)" }} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "56px 72px", width: "100%", color: "white" }}>
        <div style={{ display: "flex", fontSize: 30, opacity: 0.85 }}>CrowdView · {t("실시간 혼잡도 · AI 예측")}</div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700, marginTop: 10, lineHeight: 1.15, maxWidth: 1000 }}>{name.length > 16 ? `${name.slice(0, 15)}…` : name}</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14, marginTop: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, background: "white", color: open ? inkOf(color) : "#374151", borderRadius: 999, padding: "10px 30px", fontSize: 48, fontWeight: 700 }}>
            <div style={{ display: "flex", width: 26, height: 26, borderRadius: 13, background: color }} />
            {crowd && open ? t("지금 {level}", { level: status }) : status}
          </div>
          {people && <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>{people}</div>}
        </div>
        <div style={{ display: "flex", fontSize: 28, opacity: 0.85, marginTop: 20 }}>{at}</div>
      </div>
    </div>,
    { ...size, fonts: font ? [{ name: "Noto Sans KR", data: font, weight: 700, style: "normal" }] : undefined },
  );
}
