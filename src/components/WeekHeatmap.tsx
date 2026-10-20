"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { formatHour } from "@/i18n/translate";
import { LEVELS, levelOf } from "@/lib/levels";
import { Glyph } from "@/components/Glyph";

export interface HeatDay {
  date: string;
  /** 줄 이름 (오늘·내일·목) */
  label: string;
  /** 운영 시간의 시간마다 예상 점수 (+ 예상 인원 문장) */
  hours: { hour: number; score: number; people?: string }[];
  /** 정기 휴무 */
  closed?: boolean;
}

/**
 * 언제 가면 한산할까: 날마다 한 줄 색 띠(운영 시간을 시간마다 단계 색으로 이어 붙임) + 오른쪽에 그날 가장 한산한 시각.
 * 띠를 누르거나 손가락으로 밀면 그 시간의 단계·예상 인원. 이번 주에서 가장 한산한 때는 ★
 */
export function WeekHeatmap({ days, nowHour }: { days: HeatDay[]; nowHour: number }) {
  const { t, lang } = useI18n();
  const all = days.flatMap((d) => d.hours.map((h) => h.hour));
  const from = all.length ? Math.min(...all) : 0;
  const to = all.length ? Math.max(...all) + 1 : 1;
  const span = Math.max(1, to - from);
  // 날마다 가장 한산한 시각 (오늘은 지난 시간 빼고)
  const calmOf = days.map((d, di) =>
    d.hours.filter((h) => !(di === 0 && h.hour < Math.floor(nowHour))).reduce<(typeof d.hours)[number] | undefined>((a, b) => (!a || b.score < a.score ? b : a), undefined),
  );
  const bestDay = calmOf.reduce((bi, c, i) => (c && (bi < 0 || c.score < calmOf[bi]!.score) ? i : bi), -1);
  const [sel, setSel] = useState<{ d: number; hour: number } | null>(bestDay >= 0 ? { d: bestDay, hour: calmOf[bestDay]!.hour } : null);
  const dragging = useRef<number | null>(null);
  if (!all.length) return null;

  const pickAt = (di: number, el: HTMLElement, clientX: number) => {
    const r = el.getBoundingClientRect();
    const hour = from + Math.floor(((clientX - r.left) / r.width) * span);
    if (days[di].hours.some((h) => h.hour === hour)) setSel({ d: di, hour });
  };
  const sd = sel ? days[sel.d] : undefined;
  const sh = sd?.hours.find((h) => h.hour === sel!.hour);
  const ticks = Array.from({ length: span + 1 }, (_, i) => from + i).filter((h) => h % 3 === 0 || h === from || h === to);

  return (
    <div>
      {/* 고른 시간 */}
      {sd && sh && (
        <div className="mb-3 rounded-2xl bg-gray-50 px-4 py-3" aria-live="polite">
          <p className="text-sm text-gray-600">
            <b className="text-gray-900">
              {sd.label} {formatHour(sel!.hour, lang)}
            </b>
            {sel!.d === bestDay && sel!.hour === calmOf[bestDay]?.hour && (
              <span className="ml-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">★ {t("이번 주 가장 한산")}</span>
            )}
          </p>
          <p className="mt-0.5 text-xl font-extrabold">
            <span style={{ color: levelOf(sh.score).color }}>{t(levelOf(sh.score).label)}</span>
            {sh.people && <span className="ml-2 text-lg font-bold text-gray-900">{sh.people}</span>}
          </p>
        </div>
      )}

      {/* 시간 눈금 */}
      <div className="relative ml-12 mr-[4.5rem] h-4 text-[11px] text-gray-500">
        {ticks.map((h) => (
          <span key={h} className="absolute -translate-x-1/2" style={{ left: `${((h - from) / span) * 100}%` }}>
            {h}
          </span>
        ))}
      </div>

      <ul className="space-y-2">
        {days.map((d, di) => {
          const calm = calmOf[di];
          return (
            <li key={d.date} className="flex items-center gap-2">
              <span className={`w-10 shrink-0 text-sm ${di === 0 ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>{d.label}</span>
              {d.closed ? (
                <span className="flex h-9 flex-1 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-500">{t("휴무")}</span>
              ) : (
                <div
                  className="relative h-9 flex-1 overflow-hidden rounded-full bg-gray-100"
                  style={{ touchAction: "pan-y" }}
                  role="group"
                  aria-label={d.label}
                  onPointerDown={(e) => {
                    dragging.current = di;
                    if (e.pointerType === "mouse") pickAt(di, e.currentTarget, e.clientX);
                  }}
                  onPointerMove={(e) => (dragging.current === di || e.pointerType === "mouse") && pickAt(di, e.currentTarget, e.clientX)}
                  onPointerUp={(e) => {
                    if (dragging.current === di) pickAt(di, e.currentTarget, e.clientX);
                    dragging.current = null;
                  }}
                  onPointerCancel={() => (dragging.current = null)}
                  onPointerLeave={() => (dragging.current = null)}
                >
                  {d.hours.map((h) => {
                    const l = levelOf(h.score);
                    const past = di === 0 && h.hour < Math.floor(nowHour);
                    const on = sel?.d === di && sel.hour === h.hour;
                    return (
                      <span
                        key={h.hour}
                        className="absolute inset-y-0"
                        style={{
                          left: `${((h.hour - from) / span) * 100}%`,
                          width: `${100 / span}%`,
                          background: l.color,
                          opacity: past ? 0.2 : on ? 1 : 0.85,
                          boxShadow: on ? "inset 0 0 0 2px #111827" : undefined,
                        }}
                      />
                    );
                  })}
                  {/* 지금 */}
                  {di === 0 && nowHour >= from && nowHour <= to && (
                    <span className="absolute inset-y-0 w-0.5 bg-gray-900" style={{ left: `${((nowHour - from) / span) * 100}%` }} />
                  )}
                </div>
              )}
              <span className="w-16 shrink-0 text-right text-xs leading-tight">
                {calm ? (
                  <>
                    <span className="block text-gray-500">{t("한산")}</span>
                    <b className={di === bestDay ? "text-emerald-600" : "text-gray-800"}>
                      {di === bestDay && <Glyph e="★" className="mr-0.5 h-3 w-3 text-amber-400" />}
                      {formatHour(calm.hour, lang)}
                    </b>
                  </>
                ) : (
                  <span className="text-gray-400">–</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {/* 범례 */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
        {LEVELS.map((l) => (
          <span key={l.key} className="flex items-center gap-1">
            <span className="h-2.5 w-4 rounded-full" style={{ background: l.color }} />
            {t(l.label)}
          </span>
        ))}
      </div>
    </div>
  );
}
