"use client";

import { ListCard } from "@/components/ListCard";
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
import { useUrlQuery } from "./useUrlQuery";
import { useBackRestore, usePaged } from "@/lib/back-restore";
import { Glyph } from "@/components/Glyph";
import { EmptyState } from "@/components/EmptyState";

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
  const [q, setQ] = useUrlQuery();
  const [view, setView] = useState<"list" | "map">("list");
  // 121곳을 한 번에 깔면 휴대폰 19화면 분량 (사용자 10/26) → 20곳씩, 조건을 바꾸면 처음부터
  const PAGE = 20;
  const paged = usePaged(PAGE, JSON.stringify([groups, levels, sort, q]));
  const shown = paged.shown;
  useBackRestore("seoul", { groups, levels, sort, me, view, paged: paged.state }, (s) => {
    setGroups(s.groups);
    setLevels(s.levels);
    setSort(s.sort);
    setMe(s.me);
    setView(s.view);
    paged.restore(s.paged);
  });
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
      <p className="mt-4 text-sm text-gray-500 md:mt-0">{t("{n}곳", { n: list.length })}</p>
      {/* 11/1 지인 QA: 정렬은 왼쪽, 목록·지도는 오른쪽 끝 (같은 크기) */}
      <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex rounded-full bg-gray-100 p-0.5 text-xs font-semibold">
            {(["busy", "calm", "near"] as const).map((s) => (
              <button
                key={s}
                onClick={() => (s === "near" && !me ? useNearby() : setSort(s))}
                className={`min-h-8 rounded-full px-3 py-1.5 ${sort === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"}`}
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
          <ViewToggle view={view} onChange={setView} />
      </div>
      {geoError && <p className="mt-2 text-xs font-semibold text-red-600">{geoError}</p>}
      {/* 서울시 단계는 장소별 평소 대비라 인원 수와 단계가 엇갈려 보일 수 있다 */}
      <p className="mt-2 text-xs text-gray-500">{t("단계는 인원 수가 아니라 평소보다 얼마나 많은지예요")}</p>
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
        // 사진 왼쪽 · 글 오른쪽 가로 카드를 회색 구역 안에 (사용자 QA 10/22, 홈 '전체 장소'와 같은 모양)
        <ul className="sector mt-3 grid grid-cols-[minmax(0,1fr)] gap-2.5 p-3 md:grid-cols-2">
          {list.slice(0, shown).map((r, i) => {
            const g = SEOUL_GROUPS.find((x) => x.id === r.group);
            const lv = r.score !== undefined ? levelOf(r.score) : undefined;
            return (
              <li key={r.code}>
                <ListCard
                  item={{
                    href: `/seoul/${r.code}`,
                    img: r.img,
                    emoji: g?.emoji,
                    eager: i < 4,
                    title: names[r.name] ?? r.name,
                    tag: g ? { label: t(g.label), color: "#4338ca", emoji: g.emoji } : undefined,
                    sub: me && sort === "near" ? `${distanceKm(me, r).toFixed(1)}km` : undefined,
                    level: lv ? { label: t(lv.label), color: lv.color } : undefined,
                    people:
                      r.min !== undefined
                        ? t("{min}~{max}명", { min: compactNumber(r.min, lang), max: compactNumber(r.max ?? r.min, lang) })
                        : t("정보 없음"),
                    data: { "place-id": `seoul-${r.code}`, level: lv ? lv.key : "none" },
                    action: (
                      <PickStar
                        pick={{
                          id: `seoul-${r.code}`,
                          label: names[r.name] ?? r.name,
                          href: `/seoul/${r.code}`,
                        }}
                      />
                    ),
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
      {view === "list" && list.length > shown && (
        <button
          type="button"
          onClick={paged.more}
          className="mt-3 w-full rounded-2xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-800"
        >
          {t("더 보기 ({n}곳 더)", { n: list.length - shown })}
        </button>
      )}
      {list.length === 0 && <EmptyState name="otter" className="mt-8">{t("찾는 지역이 없어요.")}</EmptyState>}
    </FilterLayout>
  );
}
