"use client";

import { ListCard } from "@/components/ListCard";
import Link from "@/i18n/link";
import Image from "next/image";
import { canOptimize } from "@/lib/img";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import { currentPosition, distanceKm, type LatLng } from "@/lib/geo";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { FilterLayout, PickStar } from "./FilterLayout";
import { SpotMap, ViewToggle } from "./map/SpotMap";
import { useUrlQuery } from "./useUrlQuery";
import { useBackRestore, usePaged } from "@/lib/back-restore";
import { Glyph } from "@/components/Glyph";

export type Row = [id: string, kind: string, name: string, lat: number | null, lng: number | null, gu: string | null, img?: string | null];
interface Live {
  url: string;
  level: string;
}

const KINDS = [
  { id: "attraction", label: "명소", emoji: "🏛️" },
  { id: "food", label: "맛집", emoji: "🍽️" },
  { id: "shopping", label: "쇼핑", emoji: "🛍️" },
  { id: "nature", label: "자연", emoji: "🌳" },
  { id: "fun", label: "놀이·체험", emoji: "🎢" },
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
  // 불러오기 실패를 '0곳'으로 보이지 않게 따로 둔다 (QA 10/21 EXP-S02: 명소가 없는 지역으로 오해)
  const [failed, setFailed] = useState(false);
  const [live, setLive] = useState<Record<string, string>>({});
  const [kinds, setKinds] = useState<string[]>(["attraction"]);
  const [gus, setGus] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [q, setQ] = useUrlQuery();
  const [me, setMe] = useState<LatLng | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  // 한산한 순: 그 동네(1km 안 서울 실시간 지역) 지금 단계가 낮은 곳부터. 맛집이면 '지금 덜 붐비는 맛집'
  const [calmFirst, setCalmFirst] = useState(false);
  // 명소 100곳 넘게 한 번에 깔면 휴대폰 19화면 분량 (사용자 10/26) → 24곳씩, 조건을 바꾸면 처음부터
  const PAGE = 24;
  const paged = usePaged(PAGE, JSON.stringify([kinds, gus, levels, calmFirst]));
  const shown = paged.shown;
  useBackRestore("guide", { kinds, gus, levels, me, view, calmFirst, paged: paged.state }, (s) => {
    setKinds(s.kinds);
    setGus(s.gus);
    setLevels(s.levels);
    setMe(s.me);
    setView(s.view);
    setCalmFirst(s.calmFirst);
    paged.restore(s.paged);
  });

  useEffect(() => {
    fetch(`/data/guide-${lang}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((rows: Row[]) => {
        setFailed(false);
        setRows(rows);
      })
      .catch(() => setFailed(true));
    // 서울 121곳 지금 단계 (CDN 5분 캐시)
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
          <Glyph e="📍" /> {t("내 주변")}
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
      {failed && (!rows || list.length === 0) ? (
        <p className="mt-6 text-sm font-semibold text-red-600">{t("데이터를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.")}</p>
      ) : !rows ? (
        <p className="mt-6 text-sm text-gray-500">{t("불러오는 중…")}</p>
      ) : (
        <>
          {failed && <p className="mt-4 text-xs font-semibold text-red-600 md:mt-0">{t("데이터를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.")}</p>}
          <p className="mt-4 text-sm text-gray-500 md:mt-0">{t("{n}곳", { n: list.length })}</p>
          {/* 11/1 지인 QA: 정렬은 왼쪽, 목록·지도는 오른쪽 끝 (같은 크기) */}
          <div className="mt-2 flex items-center justify-between gap-2">
              {view === "list" && !me ? (
                <div className="flex rounded-full bg-gray-100 p-0.5 text-xs font-semibold">
                  {[false, true].map((c) => (
                    <button
                      key={String(c)}
                      onClick={() => setCalmFirst(c)}
                      className={`min-h-8 rounded-full px-3 py-1.5 ${calmFirst === c ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"}`}
                    >
                      {c ? t("한산한 순") : t("기본순")}
                    </button>
                  ))}
                </div>
              ) : (
                <span />
              )}
              <ViewToggle view={view} onChange={setView} />
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
              {/* 사진 카드 (관광공사 사진이 있는 곳 — 없으면 종류 그림). 글만 늘어선 목록이 데이터베이스 같다는 QA 반영 */}
              <ul className="sector mt-3 grid grid-cols-[minmax(0,1fr)] gap-2.5 p-3 md:grid-cols-2">
                {list.slice(0, shown).map((r, i) => {
                  const level = levelOf(r);
                  const kind = KINDS.find((k) => k.id === r[1]);
                  return (
                    <li key={r[0]}>
                      <ListCard
                        item={{
                          href: `/guide/${r[0]}`,
                          img: r[6] ?? undefined,
                          emoji: kind?.emoji,
                          eager: i < 4,
                          title: r[2],
                          tag: kind ? { label: t(kind.label), color: "#4338ca", emoji: kind.emoji } : undefined,
                          sub: [r[5] ? t(r[5]) : "", me && r[3] !== null ? `${distanceKm(me, { lat: r[3], lng: r[4]! }).toFixed(1)}km` : ""]
                            .filter(Boolean)
                            .join(" · "),
                          level: level ? { label: t(level), color: LEVEL_COLOR[level] } : undefined,
                          action: <PickStar pick={{ id: r[0], label: r[2], href: `/guide/${r[0]}` }} />,
                        }}
                      />
                    </li>
                  );
                })}
              </ul>
              {list.length > shown && (
                <button
                  type="button"
                  onClick={paged.more}
                  className="mt-3 w-full rounded-2xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-800"
                >
                  {t("더 보기 ({n}곳 더)", { n: list.length - shown })}
                </button>
              )}
              {list.length > 120 && <p className="mt-3 text-center text-xs text-gray-500">{t("이름이나 구로 더 좁혀 보세요")}</p>}
            </>
          )}
        </>
      )}
    </FilterLayout>
  );
}
