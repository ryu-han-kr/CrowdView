"use client";

import Link from "@/i18n/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import { currentPosition, distanceKm, type LatLng } from "@/lib/geo";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { FilterLayout, PickStar } from "./FilterLayout";
import { SpotMap, ViewToggle } from "./map/SpotMap";

export type Row = [id: string, kind: string, name: string, lat: number | null, lng: number | null, gu: string | null];
interface Live {
  url: string;
  level: string;
}

const KINDS = [
  { id: "attraction", label: "명소", emoji: "🏛️" },
  { id: "food", label: "맛집", emoji: "🍽️" },
  { id: "shopping", label: "쇼핑", emoji: "🛍️" },
  { id: "nature", label: "자연", emoji: "🌳" },
];
const LEVEL_COLOR: Record<string, string> = {
  여유: "#10b981",
  보통: "#eab308",
  "약간 붐빔": "#f97316",
  붐빔: "#ef4444",
};
// 서울시 단계 → 지도 핀 색 점수 (lib/seoul-live SEOUL_LEVEL_SCORE 와 같은 값)
const LEVEL_SCORE: Record<string, number> = {
  여유: 25,
  보통: 48,
  "약간 붐빔": 68,
  붐빔: 88,
};

/** Visit Seoul 다국어 명소·맛집·쇼핑·자연 + 가까운 서울 실시간 지역의 지금 혼잡도. 검색 + 종류·구·혼잡 거르기(PC는 왼쪽 패널) */
/**
 * initial: 서버가 미리 그려 주는 첫 목록(명소)과 종류별 건수 — 검색로봇·자바스크립트 없이도 목록과 링크가 보이게.
 * 브라우저에서는 전체 목록(/data/guide-{lang}.json)을 받아 바꿔 끼운다
 */
export function GuideList({ initial, counts }: { initial?: Row[]; counts?: Record<string, number> }) {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<Row[] | null>(initial ?? null);
  const [live, setLive] = useState<Record<string, string>>({});
  const [kinds, setKinds] = useState<string[]>(["attraction"]);
  const [gus, setGus] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [me, setMe] = useState<LatLng | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  // 한산한 순: 그 동네(1km 안 서울 실시간 지역) 지금 단계가 낮은 곳부터. 맛집이면 '지금 덜 붐비는 맛집'
  const [calmFirst, setCalmFirst] = useState(false);

  useEffect(() => {
    fetch(`/data/guide-${lang}.json`)
      .then((r) => r.json())
      .then(setRows)
      .catch(() => setRows([]));
    // 서울 119곳 지금 단계 (CDN 5분 캐시)
    fetch("/api/public/crowd")
      .then((r) => r.json())
      .then((j: { seoul: Live[] }) => setLive(Object.fromEntries(j.seoul.map((s) => [s.url.split("/").pop()!, s.level]))))
      .catch(() => {});
  }, [lang]);

  // 장소마다 가장 가까운 실시간 지역 (1km 안)
  const areaOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows ?? []) {
      if (r[3] === null || r[4] === null) continue;
      let best: { code: string; km: number } | undefined;
      for (const a of SEOUL_AREAS) {
        const km = distanceKm({ lat: r[3], lng: r[4] }, a);
        if (km <= 1 && (!best || km < best.km)) best = { code: a.code, km };
      }
      if (best) m.set(r[0], best.code);
    }
    return m;
  }, [rows]);

  const ofKind = useMemo(() => (rows ?? []).filter((r) => !kinds.length || kinds.includes(r[1])), [rows, kinds]);
  const guOptions = useMemo(() => [...new Set(ofKind.filter((r) => r[5]).map((r) => r[5]!))].sort(), [ofKind]);
  const levelOf = (r: Row) => {
    const area = areaOf.get(r[0]);
    return area ? live[area] : undefined;
  };
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = ofKind.filter(
      (r) =>
        (!gus.length || (r[5] && gus.includes(r[5]))) &&
        (!levels.length || levels.includes(live[areaOf.get(r[0]) ?? ""] ?? "")) &&
        (!needle || r[2].toLowerCase().includes(needle)),
    );
    if (me)
      return out.filter((r) => r[3] !== null).sort((a, b) => distanceKm(me, { lat: a[3]!, lng: a[4]! }) - distanceKm(me, { lat: b[3]!, lng: b[4]! }));
    if (calmFirst) {
      // 단계를 모르는 곳은 뒤로
      const rank = (r: Row) => LEVEL_SCORE[live[areaOf.get(r[0]) ?? ""] ?? ""] ?? 999;
      return [...out].sort((a, b) => rank(a) - rank(b));
    }
    return out;
  }, [ofKind, gus, levels, live, areaOf, q, me, calmFirst]);

  return (
    <FilterLayout
      query={q}
      onQuery={setQ}
      placeholder={t("이름으로 찾기")}
      resultCount={list.length}
      extra={
        <button
          onClick={async () => setMe(me ? null : await currentPosition().catch(() => null))}
          className={`shrink-0 rounded-2xl px-3 py-2.5 md:w-full text-sm font-semibold ${me ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700"}`}
        >
          📍 {t("내 주변")}
        </button>
      }
      groups={[
        {
          id: "kind",
          title: t("종류"),
          options: KINDS.map((k) => ({
            id: k.id,
            label: t(k.label),
            emoji: k.emoji,
            count: counts?.[k.id] ?? (rows ?? []).filter((r) => r[1] === k.id).length,
          })),
          selected: kinds,
          onChange: (next) => (setKinds(next), setGus([])),
        },
        {
          id: "gu",
          title: t("지역(구)"),
          options: guOptions.map((g) => ({
            id: g,
            label: t(g),
            count: ofKind.filter((r) => r[5] === g).length,
          })),
          selected: gus,
          onChange: setGus,
        },
        {
          id: "level",
          title: t("그 동네 지금 혼잡도"),
          options: Object.keys(LEVEL_COLOR).map((l) => ({
            id: l,
            label: t(l),
            count: ofKind.filter((r) => levelOf(r) === l).length,
          })),
          selected: levels,
          onChange: setLevels,
          mobile: false,
        },
      ]}
    >
      {!rows ? (
        <p className="mt-6 text-sm text-gray-500">{t("불러오는 중…")}</p>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between md:mt-0">
            <p className="text-sm text-gray-500">{t("{n}곳", { n: list.length })}</p>
            <div className="flex items-center gap-2">
              {view === "list" && !me && (
                <div className="flex rounded-full bg-gray-100 p-0.5 text-xs font-semibold">
                  {[false, true].map((c) => (
                    <button
                      key={String(c)}
                      onClick={() => setCalmFirst(c)}
                      className={`rounded-full px-3 py-1 ${calmFirst === c ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
                    >
                      {c ? t("한산한 순") : t("기본순")}
                    </button>
                  ))}
                </div>
              )}
              <ViewToggle view={view} onChange={setView} />
            </div>
          </div>
          {view === "map" ? (
            <SpotMap
              className="mt-3"
              spots={list
                .filter((r) => r[3] !== null && r[4] !== null)
                .map((r) => {
                  const level = levelOf(r);
                  return {
                    id: r[0],
                    name: r[2],
                    lat: r[3]!,
                    lng: r[4]!,
                    href: `/guide/${r[0]}`,
                    score: level ? LEVEL_SCORE[level] : undefined,
                    emoji: KINDS.find((k) => k.id === r[1])?.emoji,
                    sub: r[5] ? t(r[5]) : undefined,
                  };
                })}
            />
          ) : (
            <>
              <ul className="mt-2 grid gap-2 lg:grid-cols-2">
                {list.slice(0, 120).map((r) => {
                  const level = levelOf(r);
                  return (
                    <li key={r[0]} className="flex items-center rounded-2xl border border-gray-100 pr-2">
                      <Link href={`/guide/${r[0]}`} className="flex h-full min-w-0 flex-1 items-center gap-3 py-3 pl-4">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{r[2]}</span>
                          <span className="block text-xs text-gray-500">
                            {r[5] ? t(r[5]) : ""}
                            {me && r[3] !== null && ` · ${distanceKm(me, { lat: r[3], lng: r[4]! }).toFixed(1)}km`}
                          </span>
                        </span>
                        {level && (
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                            style={{
                              color: LEVEL_COLOR[level],
                              background: `${LEVEL_COLOR[level]}1a`,
                            }}
                            title={t("이 동네 지금 혼잡도")}
                          >
                            {t(level)}
                          </span>
                        )}
                      </Link>
                      <PickStar pick={{ id: r[0], label: r[2], href: `/guide/${r[0]}` }} />
                    </li>
                  );
                })}
              </ul>
              {list.length > 120 && <p className="mt-3 text-center text-xs text-gray-400">{t("이름이나 구로 더 좁혀 보세요")}</p>}
            </>
          )}
        </>
      )}
    </FilterLayout>
  );
}
