"use client";

import { useEffect, useMemo, useState } from "react";
import { distanceKm } from "@/lib/geo";
import { useI18n } from "@/i18n/client";
import { LEVELS, levelOf } from "@/lib/levels";
import { MapLegend } from "./MapLegend";
import { SpotMap, type MapSpot } from "./SpotMap";
import { Glyph } from "@/components/Glyph";

/** 지도에 올릴 곳 하나 (서버가 만든다). region: 짧은 시도 이름 (서울·부산·경기 …) */
export interface ExploreSpot extends MapSpot {
  theme: ThemeId;
  region: string;
}
export type ThemeId = "live" | "seoul" | "landmark" | "festival";

const THEMES: { id: ThemeId | "all"; label: string; emoji: string }[] = [
  { id: "all", label: "전체", emoji: "✨" },
  { id: "live", label: "실시간 장소", emoji: "📡" },
  { id: "seoul", label: "서울 실시간", emoji: "📍" },
  { id: "landmark", label: "명소", emoji: "🏛️" },
  { id: "festival", label: "축제", emoji: "🎪" },
];

/**
 * 혼잡도 지도: 테마(실시간 장소·서울 실시간·명소·축제)와 지역(17개 시도)으로 골라 본다.
 * 핀·묶음 색 = 지금(축제는 예상) 혼잡 단계, 회색 = 혼잡 자료 없음. 지역을 고르면 그 지역으로 맞춰 확대
 */
export function MapExplorer({
  spots: base,
  regions,
  subtitle,
}: {
  spots: ExploreSpot[];
  regions: string[];
  subtitle: string;
}) {
  const { t, lang } = useI18n();
  const [theme, setTheme] = useState<ThemeId | "all">("all");
  const [region, setRegion] = useState<string>("all");
  // 전국 명소 디렉터리(관광공사 1,852곳)는 브라우저에서 받는다. 혼잡은 가까운(1km 안) 실시간 장소·서울 지역 값
  const [directory, setDirectory] = useState<ExploreSpot[]>([]);
  useEffect(() => {
    const live = base.filter(
      (s) =>
        (s.theme === "live" || s.theme === "seoul") && s.score !== undefined,
    );
    fetch("/data/spots.json")
      .then((r) => r.json())
      .then(
        (
          rows: [
            string,
            string,
            string,
            string,
            number,
            number,
            string,
            string,
          ][],
        ) =>
          setDirectory(
            rows.map((r) => {
              const near = live.find(
                (l) => distanceKm(l, { lat: r[4], lng: r[5] }) < 1,
              );
              return {
                id: `kt-${r[0]}`,
                theme: "landmark" as const,
                region: r[2],
                name: r[3],
                lat: r[4],
                lng: r[5],
                href:
                  lang === "ko"
                    ? `https://map.kakao.com/link/map/${encodeURIComponent(r[3])},${r[4]},${r[5]}`
                    : `https://www.google.com/maps/search/?api=1&query=${r[4]},${r[5]}`,
                external: true,
                score: near?.score,
                emoji: "🏞️",
                sub: `${t(r[2])} ${r[7] ?? ""}`.trim(),
                img: r[6] || undefined,
              };
            }),
          ),
      )
      .catch(() => {});
  }, [base, lang, t]);
  const spots = useMemo(() => [...base, ...directory], [base, directory]);

  const ofTheme = useMemo(
    () => spots.filter((s) => theme === "all" || s.theme === theme),
    [spots, theme],
  );
  const shown = useMemo(
    () => ofTheme.filter((s) => region === "all" || s.region === region),
    [ofTheme, region],
  );
  // 혼잡을 아는 곳을 먼저 (핀 수 제한에 걸릴 때 색 있는 핀이 남게)
  const ordered = useMemo(
    () =>
      [...shown].sort(
        (a, b) => Number(b.score !== undefined) - Number(a.score !== undefined),
      ),
    [shown],
  );
  const counts = LEVELS.map(
    (l) =>
      shown.filter(
        (s) => s.score !== undefined && levelOf(s.score).key === l.key,
      ).length,
  );
  const regionCount = (r: string) =>
    ofTheme.filter((s) => s.region === r).length;
  const chip = (on: boolean) =>
    `flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold md:text-sm ${on ? "bg-gray-900 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200"}`;

  return (
    <div>
      <div className="flex flex-col gap-2 px-5 md:flex-row md:items-end md:justify-between md:gap-6 md:px-0">
        <p className="text-sm text-gray-500">{subtitle}</p>
        <MapLegend className="w-full shrink-0 md:w-[420px]" counts={counts} />
      </div>

      {/* 테마 */}
      <div className="mt-4 flex gap-2 overflow-x-auto px-5 pb-1 md:px-0">
        {THEMES.map((th) => (
          <button
            key={th.id}
            onClick={() => setTheme(th.id)}
            aria-pressed={theme === th.id}
            className={chip(theme === th.id)}
          >
            <Glyph e={th.emoji} /> {t(th.label)}
            <span className="opacity-80">
              {th.id === "all"
                ? spots.length
                : spots.filter((s) => s.theme === th.id).length}
            </span>
          </button>
        ))}
      </div>
      {/* 지역 */}
      <div className="mt-2 flex gap-1.5 overflow-x-auto px-5 pb-1 md:flex-wrap md:px-0">
        <button
          onClick={() => setRegion("all")}
          aria-pressed={region === "all"}
          className={chip(region === "all")}
        >
          {t("전국")}
        </button>
        {regions
          .filter((r) => regionCount(r) > 0)
          .map((r) => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              aria-pressed={region === r}
              className={chip(region === r)}
            >
              {t(r)} <span className="opacity-80">{regionCount(r)}</span>
            </button>
          ))}
      </div>

      <SpotMap
        className="mt-3 md:mt-4"
        spots={ordered}
        max={2500}
        legend={false}
        heightClass="h-[calc(100dvh-18rem)] min-h-[420px]"
        preview
      />
    </div>
  );
}
