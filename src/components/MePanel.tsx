"use client";

import { useFavorites, usePreferredTags } from "@/lib/prefs";
import type { CrowdResult, Place } from "@/lib/types";
import { PlaceRow } from "./PlaceRow";

export function MePanel({ places, crowd }: { places: Place[]; crowd: Record<string, CrowdResult> }) {
  const { favorites } = useFavorites();
  const { tags, toggle } = usePreferredTags();

  const allTags = [...new Set(places.flatMap((p) => p.tags))];
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
        <h2 className="text-lg font-bold">❤️ 즐겨찾기</h2>
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
            상세 페이지에서 🤍 를 눌러 자주 가는 곳을 추가하세요.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold">관심 키워드</h2>
        <p className="mt-0.5 text-xs text-gray-500">선택한 키워드로 지금 한산한 곳을 추천해 드려요.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => toggle(t)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                tags.includes(t) ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              #{t}
            </button>
          ))}
        </div>
        {recommended.length > 0 && (
          <div className="mt-4 rounded-3xl bg-indigo-50/60 p-3">
            <p className="px-1 text-xs font-semibold text-indigo-500">✨ 취향 맞춤 추천</p>
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
