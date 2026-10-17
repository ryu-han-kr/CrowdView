"use client";

import Link from "@/i18n/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import { currentPosition, distanceKm, type LatLng } from "@/lib/geo";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { FilterLayout, PickStar } from "./FilterLayout";

type Row = [id: string, kind: string, name: string, lat: number | null, lng: number | null, gu: string | null];
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
const LEVEL_COLOR: Record<string, string> = { 여유: "#10b981", 보통: "#eab308", "약간 붐빔": "#f97316", 붐빔: "#ef4444" };

/** Visit Seoul 다국어 명소·맛집·쇼핑·자연 + 가까운 서울 실시간 지역의 지금 혼잡도. 검색 + 종류·구·혼잡 거르기(PC는 왼쪽 패널) */
export function GuideList() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [live, setLive] = useState<Record<string, string>>({});
  const [kinds, setKinds] = useState<string[]>(["attraction"]);
  const [gus, setGus] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [me, setMe] = useState<LatLng | null>(null);

  useEffect(() => {
    fetch(`/data/guide-${lang}.json`).then((r) => r.json()).then(setRows).catch(() => setRows([]));
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
    if (me) return out.filter((r) => r[3] !== null).sort((a, b) => distanceKm(me, { lat: a[3]!, lng: a[4]! }) - distanceKm(me, { lat: b[3]!, lng: b[4]! }));
    return out;
  }, [ofKind, gus, levels, live, areaOf, q, me]);

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
          options: KINDS.map((k) => ({ id: k.id, label: t(k.label), emoji: k.emoji, count: (rows ?? []).filter((r) => r[1] === k.id).length })),
          selected: kinds,
          onChange: (next) => (setKinds(next), setGus([])),
        },
        {
          id: "gu",
          title: t("지역(구)"),
          options: guOptions.map((g) => ({ id: g, label: t(g), count: ofKind.filter((r) => r[5] === g).length })),
          selected: gus,
          onChange: setGus,
        },
        {
          id: "level",
          title: t("그 동네 지금 혼잡도"),
          options: Object.keys(LEVEL_COLOR).map((l) => ({ id: l, label: t(l), count: ofKind.filter((r) => levelOf(r) === l).length })),
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
          <p className="mt-4 text-sm text-gray-500 md:mt-0">{t("{n}곳", { n: list.length })}</p>
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
                        style={{ color: LEVEL_COLOR[level], background: `${LEVEL_COLOR[level]}1a` }}
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
    </FilterLayout>
  );
}
