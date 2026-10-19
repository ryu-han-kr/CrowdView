"use client";

import Link from "@/i18n/link";
import Image from "next/image";
import { canOptimize } from "@/lib/img";
import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import { compactNumber } from "@/lib/format";
import { currentPosition, distanceKm, type LatLng } from "@/lib/geo";
import { LEVELS, levelOf } from "@/lib/levels";
import { SEOUL_GROUPS, type SeoulGroup } from "@/lib/seoul-live";
import { FilterLayout, PickStar } from "./FilterLayout";
import { LevelBadge } from "./Level";
import { SpotMap, ViewToggle } from "./map/SpotMap";
import { Glyph } from "@/components/Glyph";

export interface SeoulAreaRow {
  code: string;
  name: string;
  group: SeoulGroup;
  lat: number;
  lng: number;
  score?: number;
  min?: number;
  max?: number;
  /** 근처 관광공사 사진 */
  img?: string;
}

/** 서울 실시간 지역 목록: 이름 검색 + 묶음·혼잡 단계 거르기(PC는 왼쪽 패널) + 붐비는/한산한/내 주변 순 */
export function SeoulAreaList({ rows, names = {} }: { rows: SeoulAreaRow[]; names?: Record<string, string> }) {
  const { t, lang } = useI18n();
  const [groups, setGroups] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [sort, setSort] = useState<"busy" | "calm" | "near">("busy");
  const [me, setMe] = useState<LatLng | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const useNearby = async () => {
    setGeoError(null);
    try {
      setMe(await currentPosition());
      setSort("near");
    } catch {
      setGeoError(t("위치를 쓸 수 없어요. 브라우저에서 위치 권한을 허용해 주세요."));
    }
  };
  const [q, setQ] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const tr = (ko: string) => names[ko] ?? ko;
    return rows
      .filter((r) => !groups.length || groups.includes(r.group))
      .filter((r) => !levels.length || (r.score !== undefined && levels.includes(String(levelOf(r.score).key))))
      .filter((r) => !needle || r.name.toLowerCase().includes(needle) || tr(r.name).toLowerCase().includes(needle))
      .sort((a, b) =>
        sort === "near" && me
          ? distanceKm(me, a) - distanceKm(me, b)
          : (sort === "busy" ? 1 : -1) * ((b.score ?? -1) - (a.score ?? -1)) || a.name.localeCompare(b.name, "ko"),
      );
  }, [rows, names, groups, levels, sort, q, me]);

  return (
    <FilterLayout
      query={q}
      onQuery={setQ}
      placeholder={t("지역 이름 검색 (예: 성수, 한강)")}
      resultCount={list.length}
      groups={[
        {
          id: "group",
          title: t("종류"),
          options: SEOUL_GROUPS.map((g) => ({
            id: g.id,
            label: t(g.label),
            emoji: g.emoji,
            count: rows.filter((r) => r.group === g.id).length,
          })),
          selected: groups,
          onChange: setGroups,
        },
        {
          id: "level",
          title: t("지금 혼잡도"),
          options: LEVELS.map((l) => ({
            id: String(l.key),
            label: t(l.label),
            count: rows.filter((r) => r.score !== undefined && levelOf(r.score).key === l.key).length,
          })),
          selected: levels,
          onChange: setLevels,
          mobile: false,
        },
      ]}
    >
      <div className="mt-4 flex items-center justify-between md:mt-0">
        <p className="text-sm text-gray-500">{t("{n}곳", { n: list.length })}</p>
        <div className="flex items-center gap-2">
          <ViewToggle view={view} onChange={setView} />
          <div className="flex rounded-full bg-gray-100 p-0.5 text-xs font-semibold">
            {(["busy", "calm", "near"] as const).map((s) => (
              <button
                key={s}
                onClick={() => (s === "near" && !me ? useNearby() : setSort(s))}
                className={`min-h-8 rounded-full px-3 py-1.5 ${sort === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
              >
                {s === "busy" ? (
                  t("붐비는 순")
                ) : s === "calm" ? (
                  t("한산한 순")
                ) : (
                  <>
                    <Glyph e="📍" /> {t("내 주변")}
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      {geoError && <p className="mt-2 text-xs font-semibold text-red-600">{geoError}</p>}
      {view === "map" ? (
        <SpotMap
          className="mt-3"
          spots={list.map((r) => ({
            id: r.code,
            name: names[r.name] ?? r.name,
            lat: r.lat,
            lng: r.lng,
            href: `/seoul/${r.code}`,
            score: r.score,
            emoji: SEOUL_GROUPS.find((g) => g.id === r.group)?.emoji,
            sub:
              r.min !== undefined
                ? t("{min}~{max}명", {
                    min: compactNumber(r.min, lang),
                    max: compactNumber(r.max ?? r.min, lang),
                  })
                : undefined,
          }))}
        />
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {list.map((r) => {
            const g = SEOUL_GROUPS.find((x) => x.id === r.group);
            return (
              <li key={r.code} className="relative">
                <Link href={`/seoul/${r.code}`} className="group block">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gray-100">
                    {r.img ? (
                      <Image
                        src={r.img}
                        alt=""
                        fill
                        sizes="(min-width: 1280px) 20vw, (min-width: 768px) 28vw, 45vw"
                        unoptimized={!canOptimize(r.img)}
                        className="object-cover transition-transform duration-300 md:group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-teal-50 to-sky-100 text-4xl">{g?.emoji}</div>
                    )}
                    {r.score !== undefined && (
                      <span className="absolute top-2 left-2 rounded-full bg-white/95 shadow-sm">
                        <LevelBadge score={r.score} />
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 truncate text-sm font-semibold">{names[r.name] ?? r.name}</p>
                  <p className="truncate text-xs text-gray-500">
                    {g && `${g.emoji} `}
                    {r.min !== undefined
                      ? t("{min}~{max}명", {
                          min: compactNumber(r.min, lang),
                          max: compactNumber(r.max ?? r.min, lang),
                        })
                      : t("정보 없음")}
                    {me && sort === "near" && ` · ${distanceKm(me, r).toFixed(1)}km`}
                  </p>
                </Link>
                <div className="absolute top-1 right-1 rounded-full bg-white/90">
                  <PickStar
                    pick={{
                      id: `seoul-${r.code}`,
                      label: names[r.name] ?? r.name,
                      href: `/seoul/${r.code}`,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {list.length === 0 && <p className="mt-8 text-center text-sm text-gray-500">{t("찾는 지역이 없어요.")}</p>}
    </FilterLayout>
  );
}
