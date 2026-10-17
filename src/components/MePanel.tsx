"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { useFavorites, usePreferredTags } from "@/lib/prefs";
import type { CrowdResult, Place } from "@/lib/types";
import { PlaceRow } from "./PlaceRow";

export function MePanel({ places, crowd }: { places: Place[]; crowd: Record<string, CrowdResult> }) {
  const { favorites } = useFavorites();
  const { t } = useI18n();
  const { tags, toggle, setTags } = usePreferredTags();
  const [showAllTags, setShowAllTags] = useState(false);

  // 많이 쓰인 키워드부터. 고른 키워드는 위 '선택한 키워드' 칸에 따로 모은다
  const counts = new Map<string, number>();
  for (const t of places.flatMap((p) => p.tags)) counts.set(t, (counts.get(t) ?? 0) + 1);
  const allTags = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)!);
  const restTags = allTags.filter((t) => !tags.includes(t));
  const shownTags = showAllTags ? restTags : restTags.slice(0, 12);
  const favPlaces = places.filter((p) => favorites.includes(p.id));

  // 개인화 추천: 선호 태그 일치도 ↑, 현재 혼잡도 ↓
  const recommended = tags.length
    ? places
        .map((p) => ({ p, match: p.tags.filter((t) => tags.includes(t)).length }))
        .filter((x) => x.match > 0 && !favorites.includes(x.p.id))
        .sort((a, b) => b.match * 30 - crowd[b.p.id].score - (a.match * 30 - crowd[a.p.id].score))
        .slice(0, 3)
        .map((x) => x.p)
    : [];

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-bold">❤️ {t("즐겨찾기")}</h2>
        {favPlaces.length ? (
          <ul className="mt-1 divide-y divide-gray-100">
            {favPlaces.map((p) => (
              <li key={p.id}>
                <PlaceRow place={p} crowd={crowd[p.id]} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">
            {t("장소 상세 화면 오른쪽 위 🤍 를 누르면 여기에 모여요.")}
          </p>
        )}
      </section>

      <section id="keywords" className="scroll-mt-24">
        <h2 className="text-lg font-bold">{t("관심 키워드")}</h2>
        <p className="mt-0.5 text-xs text-gray-500">{t("고른 키워드로 지금 한산한 곳을 추천해 드려요.")}</p>

        {/* 선택한 키워드 */}
        <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-indigo-700">
              {t("선택한 키워드")} <span className="text-indigo-500">{tags.length}</span>
              <span className="font-normal text-indigo-400"> / {t("{n}개", { n: allTags.length })}</span>
            </p>
            <div className="flex gap-1.5 text-xs">
              <button
                onClick={() => setTags(allTags)}
                disabled={tags.length === allTags.length}
                className="rounded-full bg-white px-2.5 py-1 font-medium text-indigo-600 shadow-sm disabled:opacity-40"
              >
                {t("전체 선택")}
              </button>
              <button
                onClick={() => setTags([])}
                disabled={tags.length === 0}
                className="rounded-full bg-white px-2.5 py-1 font-medium text-gray-600 shadow-sm disabled:opacity-40"
              >
                {t("초기화")}
              </button>
            </div>
          </div>
          {tags.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggle(tag)}
                  aria-label={t("{tag} 선택 해제", { tag: t(tag) })}
                  className="rounded-full bg-indigo-500 py-1.5 pr-2.5 pl-3 text-sm text-white"
                >
                  #{t(tag)} <span className="ml-0.5 opacity-70">✕</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-indigo-400">{t("아래에서 관심 있는 키워드를 눌러 골라 보세요.")}</p>
          )}
        </div>

        {/* 고를 수 있는 키워드 */}
        <div className="mt-3 flex flex-wrap gap-2">
          {shownTags.map((tag) => (
            <button key={tag} onClick={() => toggle(tag)} className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200">
              #{t(tag)}
            </button>
          ))}
          {restTags.length > shownTags.length && (
            <button onClick={() => setShowAllTags(true)} className="rounded-full px-3 py-1.5 text-sm text-gray-500 underline">
              {t("더보기")} +{restTags.length - shownTags.length}
            </button>
          )}
        </div>
        {recommended.length > 0 && (
          <div className="mt-4 rounded-3xl bg-indigo-50/60 p-3">
            <p className="px-1 text-xs font-semibold text-indigo-500">✨ {t("취향 맞춤 추천")}</p>
            <ul className="divide-y divide-indigo-100/70">
              {recommended.map((p) => (
                <li key={p.id}>
                  <PlaceRow place={p} crowd={crowd[p.id]} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
