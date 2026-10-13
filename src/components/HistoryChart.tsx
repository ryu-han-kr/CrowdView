"use client";

import { useState } from "react";
import type { HistoryPoint } from "@/lib/crowd/history";
import { levelOf } from "@/lib/levels";

const KST = 9 * 3_600_000;
const hhmm = (iso: string) => new Date(Date.parse(iso) + KST).toISOString().slice(11, 16);

/** 어제 0시부터 지금까지 실측 혼잡도 추이. 구역(출국장·보안검색 구간)을 골라 볼 수 있다 */
export function HistoryChart({
  days,
  zoneLabels,
  now,
}: {
  days: { date: string; points: HistoryPoint[] }[];
  zoneLabels: Record<string, string>;
  /** 서버 렌더 시각 (hydration 불일치 방지) */
  now: number;
}) {
  const [zone, setZone] = useState("전체");
  const points = days.flatMap((d) => d.points);
  if (points.length === 0) {
    return (
      <p className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">
        아직 쌓인 기록이 없어요. 실시간 데이터를 받을 때마다 기록이 쌓이고, 어제부터 지금까지의 추이를 여기서 볼 수 있어요.
      </p>
    );
  }

  const start = Date.parse(`${days[0].date}T00:00:00+09:00`);
  const end = now;
  const span = Math.max(1, end - start);
  const pick = (p: HistoryPoint) => {
    if (zone === "전체") return { score: p.score, wait: null as number | null, people: p.headcount };
    const z = p.zones?.find((x) => x[0] === zone);
    return z ? { score: z[1], wait: z[2], people: z[3] } : null;
  };
  const series = points.map((p) => ({ t: Date.parse(p.t), iso: p.t, v: pick(p) })).filter((p) => p.v);
  const last = series.at(-1);
  const peak = series.reduce((a, b) => (b.v!.score > a.v!.score ? b : a), series[0]);

  return (
    <div>
      {Object.keys(zoneLabels).length > 0 && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {["전체", ...Object.keys(zoneLabels)].map((z) => (
            <button
              key={z}
              onClick={() => setZone(z)}
              className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs ${
                z === zone ? "border-gray-900 font-semibold text-gray-900" : "border-gray-200 text-gray-500"
              }`}
            >
              {z === "전체" ? "전체" : zoneLabels[z]}
            </button>
          ))}
        </div>
      )}

      {last && peak && (
        <p className="mt-3 text-sm">
          마지막 기록 <b>{hhmm(last.iso)}</b> {levelOf(last.v!.score).label}
          {last.v!.wait !== null && ` · 대기 ${last.v!.wait}분`} · 최고 <b>{hhmm(peak.iso)}</b>{" "}
          {levelOf(peak.v!.score).label}
        </p>
      )}

      <div className="relative mt-4 h-28 rounded-xl bg-gray-50">
        {days.slice(1).map((d) => (
          <div
            key={d.date}
            className="absolute inset-y-0 border-l border-dashed border-gray-300"
            style={{ left: `${((Date.parse(`${d.date}T00:00:00+09:00`) - start) / span) * 100}%` }}
          >
            <span className="absolute -top-4 -translate-x-1/2 text-[10px] text-gray-400">{d.date.slice(5).replace("-", "/")}</span>
          </div>
        ))}
        {series.map((p) => (
          <div
            key={p.iso}
            title={`${hhmm(p.iso)} · ${levelOf(p.v!.score).label}${p.v!.wait !== null ? ` · 대기 ${p.v!.wait}분` : ""}`}
            className="absolute bottom-0 w-[3px] -translate-x-1/2 rounded-t-sm"
            style={{
              left: `${((p.t - start) / span) * 100}%`,
              height: `${Math.max(4, p.v!.score)}%`,
              background: levelOf(p.v!.score).color,
            }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-gray-400">
        <span>{days[0].date.slice(5).replace("-", "/")} 0시</span>
        <span>지금</span>
      </div>
      <p className="mt-2 text-[11px] text-gray-400">실시간 데이터를 받은 시각마다 기록 · 총 {series.length}건</p>
    </div>
  );
}
