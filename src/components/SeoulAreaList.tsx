"use client";

import Link from "@/i18n/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import { compactNumber } from "@/lib/format";
import { SEOUL_GROUPS, type SeoulGroup } from "@/lib/seoul-live";
import { LevelBadge } from "./Level";

export interface SeoulAreaRow {
  code: string;
  name: string;
  group: SeoulGroup;
  score?: number;
  min?: number;
  max?: number;
}

/** 서울 실시간 지역 목록: 묶음 칩 + 붐비는/한산한 순 + 이름 검색 */
export function SeoulAreaList({ rows, names = {} }: { rows: SeoulAreaRow[]; names?: Record<string, string> }) {
  const { t, lang } = useI18n();
  const [group, setGroup] = useState<SeoulGroup | "all">("all");
  const [sort, setSort] = useState<"busy" | "calm">("busy");
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const tr = (ko: string) => names[ko] ?? ko;
    return rows
      .filter((r) => group === "all" || r.group === group)
      .filter((r) => !needle || r.name.toLowerCase().includes(needle) || tr(r.name).toLowerCase().includes(needle))
      .sort((a, b) => (sort === "busy" ? 1 : -1) * ((b.score ?? -1) - (a.score ?? -1)) || a.name.localeCompare(b.name));
  }, [rows, names, group, sort, q]);

  return (
    <>
      <label className="mt-4 flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-2.5">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="m21 21-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("지역 이름 검색 (예: 성수, 한강)")}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
        {[{ id: "all" as const, label: "전체", emoji: "" }, ...SEOUL_GROUPS].map((g) => (
          <button
            key={g.id}
            onClick={() => setGroup(g.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
              g.id === group ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {g.emoji && <span className="mr-1">{g.emoji}</span>}
            {t(g.label)}
            <span className="ml-1 text-xs opacity-60">{g.id === "all" ? rows.length : rows.filter((r) => r.group === g.id).length}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">{t("{n}곳", { n: list.length })}</p>
        <div className="flex rounded-full bg-gray-100 p-0.5 text-xs font-semibold">
          {(["busy", "calm"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`rounded-full px-3 py-1 ${sort === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
            >
              {s === "busy" ? t("붐비는 순") : t("한산한 순")}
            </button>
          ))}
        </div>
      </div>
      <ul className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {list.map((r) => (
          <li key={r.code}>
            <Link href={`/seoul/${r.code}`} className="flex items-center gap-3 rounded-2xl border border-gray-100 px-4 py-3">
              <span className="text-xl">{SEOUL_GROUPS.find((g) => g.id === r.group)?.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{names[r.name] ?? r.name}</span>
                <span className="block text-xs text-gray-500">
                  {r.min !== undefined
                    ? t("{min}~{max}명", { min: compactNumber(r.min, lang), max: compactNumber(r.max ?? r.min, lang) })
                    : t("정보 없음")}
                </span>
              </span>
              {r.score !== undefined && <LevelBadge score={r.score} />}
            </Link>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="mt-8 text-center text-sm text-gray-500">{t("찾는 지역이 없어요.")}</p>}
    </>
  );
}
