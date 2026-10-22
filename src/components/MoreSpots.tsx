"use client";

// 지역 여행의 '더 많은 명소': 한국관광공사 등록 관광지·문화시설·레포츠 (src/data/korea/spots.json → /data/spots.json, CDN).
// 서울은 1km 안 서울 실시간 지역의 지금 혼잡도를 붙인다 (/api/public/crowd, 5분 캐시)
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { distanceKm } from "@/lib/geo";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { PhotoCard, type PhotoCardItem } from "./home/PhotoRail";
import { Glyph } from "@/components/Glyph";

/** [contentid, 종류, 지역, 이름, 위도, 경도, 작은 사진, 시군구] */
export type SpotRow = [string, "attraction" | "culture" | "leisure", string, string, number, number, string, string];

const SPOT_KINDS = [
  { id: "attraction", label: "관광지", emoji: "🏞️" },
  { id: "culture", label: "문화시설", emoji: "🏛️" },
  { id: "leisure", label: "레포츠", emoji: "🚴" },
] as const;
// 서울시 단계 → 점수 (lib/seoul-live SEOUL_LEVEL_SCORE 와 같은 값)
const LEVEL_SCORE: Record<string, number> = { 여유: 25, 보통: 48, "약간 붐빔": 68, 붐빔: 88 };
const PAGE = 20;

const spotsPromise: Record<string, Promise<SpotRow[]>> = {};
let seoulPromise: Promise<Record<string, string>> | undefined;

/** 전국 명소 목록 (언어별로 한 번만 받는다. 외국어는 이름이 번역된 목록) */
export function useSpots(): SpotRow[] | null {
  const { lang } = useI18n();
  const [rows, setRows] = useState<SpotRow[] | null>(null);
  useEffect(() => {
    spotsPromise[lang] ??= fetch(`/data/spots-${lang}.json`)
      .then((r) => r.json())
      .catch(() => []);
    spotsPromise[lang].then(setRows);
  }, [lang]);
  return rows;
}

function useSeoulLevels(on: boolean): Record<string, string> {
  const [live, setLive] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!on) return;
    seoulPromise ??= fetch("/api/public/crowd")
      .then((r) => r.json())
      .then((j: { seoul: { url: string; level: string }[] }) => Object.fromEntries(j.seoul.map((s) => [s.url.split("/").pop()!, s.level])))
      .catch(() => ({}));
    seoulPromise.then(setLive);
  }, [on]);
  return live;
}

/** 명소 한 곳 → 사진 카드 (누르면 지도: 한국어는 카카오맵, 외국어는 구글 지도) */
export function spotCard(s: SpotRow, lang: string, t: (k: string) => string, score?: number): PhotoCardItem & { lat: number; lng: number } {
  const kind = SPOT_KINDS.find((k) => k.id === s[1])!;
  return {
    id: `spot-${s[0]}`,
    href:
      lang === "ko"
        ? `https://map.kakao.com/link/map/${encodeURIComponent(s[3])},${s[4]},${s[5]}`
        : `https://www.google.com/maps/search/?api=1&query=${s[4]},${s[5]}`,
    external: true,
    img: s[6],
    title: s[3],
    sub: `${s[7] ? `${t(s[7])} · ` : ""}${t(kind.label)}`,
    score,
    lat: s[4],
    lng: s[5],
  };
}

/** initial: 서버가 미리 그려 주는 첫 지역의 명소 (검색로봇·자바스크립트 없이도 보이게), counts: 지역별 건수 */
export function MoreSpots({ region, initial, counts }: { region: string; initial?: SpotRow[]; counts?: Record<string, number> }) {
  const { t, lang } = useI18n();
  const loaded = useSpots();
  const rows = loaded ?? (initial?.length && initial[0][2] === region ? initial : null);
  const live = useSeoulLevels(region === "서울");
  const [kind, setKind] = useState<string>("all");
  const [shown, setShown] = useState(PAGE);
  useEffect(() => {
    setKind("all");
    setShown(PAGE);
  }, [region]);

  const inRegion = (rows ?? []).filter((s) => s[2] === region);
  const list = inRegion.filter((s) => kind === "all" || s[1] === kind);
  // 서울: 가장 가까운 실시간 지역(1km 안)의 지금 단계
  const scoreOf = (s: SpotRow) => {
    if (region !== "서울") return undefined;
    let best: { code: string; km: number } | undefined;
    for (const a of SEOUL_AREAS) {
      const km = distanceKm({ lat: s[4], lng: s[5] }, a);
      if (km <= 1 && (!best || km < best.km)) best = { code: a.code, km };
    }
    const level = best && live[best.code];
    return level ? LEVEL_SCORE[level] : undefined;
  };
  if (rows && !inRegion.length && !counts?.[region]) return null;
  const chip = (on: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${on ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold md:text-xl">
        {t("{region} 더 많은 명소", { region: t(region) })}
        <span className="ml-2 text-sm font-normal text-gray-500">{t("한국관광공사 등록 {n}곳", { n: counts?.[region] ?? inRegion.length })}</span>
      </h2>
      {lang !== "ko" && <p className="mt-0.5 text-xs text-gray-500">{t("이 목록의 이름은 한국어로 보여요. 누르면 지도에서 위치를 볼 수 있어요.")}</p>}
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
        <button onClick={() => (setKind("all"), setShown(PAGE))} className={chip(kind === "all")}>
          {t("전체")}
        </button>
        {SPOT_KINDS.filter((k) => inRegion.some((s) => s[1] === k.id)).map((k) => (
          <button key={k.id} onClick={() => (setKind(k.id), setShown(PAGE))} className={chip(kind === k.id)}>
            <Glyph e={k.emoji} /> {t(k.label)}
          </button>
        ))}
      </div>
      {!rows ? (
        <p className="mt-4 text-sm text-gray-500">{t("불러오는 중…")}</p>
      ) : (
        <>
          <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-5 md:gap-x-4">
            {list.slice(0, shown).map((s) => (
              <li key={s[0]}>
                <PhotoCard item={spotCard(s, lang, t, scoreOf(s))} />
              </li>
            ))}
          </ul>
          {list.length > shown && (
            <button
              onClick={() => setShown((n) => n + PAGE)}
              className="mx-auto mt-5 block rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700"
            >
              {t("더 보기")} ({list.length - shown})
            </button>
          )}
        </>
      )}
      <p className="mt-3 text-[11px] text-gray-500">{t("사진·정보: 한국관광공사 TourAPI (사진 있는 곳, 최근 갱신 순)")}</p>
    </section>
  );
}
