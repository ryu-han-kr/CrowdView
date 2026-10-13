"use client";

import { useState } from "react";
import { CATEGORY_LABEL, type Category, type CrowdResult, type Place } from "@/lib/types";
import { PlaceRow } from "./PlaceRow";

type Filter = "all" | Category;
type Sort = "calm" | "busy";

export function HomeList({ places, crowd }: { places: Place[]; crowd: Record<string, CrowdResult> }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("calm");

  const list = places
    .filter((p) => filter === "all" || p.category === filter)
    .sort(
      (a, b) =>
        Number(crowd[b.id].open) - Number(crowd[a.id].open) ||
        (sort === "calm" ? 1 : -1) * (crowd[a.id].score - crowd[b.id].score),
    );

  const filters: Filter[] = ["all", "themepark", "tourist", "airport", "event"];

  return (
    <section>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              filter === f ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {f === "all" ? "전체" : CATEGORY_LABEL[f]}
          </button>
        ))}
        <button
          onClick={() => setSort(sort === "calm" ? "busy" : "calm")}
          className="ml-auto shrink-0 px-1 text-xs text-gray-500"
        >
          {sort === "calm" ? "한산한 순 ⇅" : "붐비는 순 ⇅"}
        </button>
      </div>
      <ul className="mt-2 divide-y divide-gray-100">
        {list.map((p) => (
          <li key={p.id}>
            <PlaceRow place={p} crowd={crowd[p.id]} />
          </li>
        ))}
      </ul>
    </section>
  );
}
