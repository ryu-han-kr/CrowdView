"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { levelOf } from "@/lib/levels";

export interface DayBar {
  date: string;
  /** 막대 아래 짧은 이름 (오늘·내일·수) */
  short: string;
  /** 고른 날 설명용 긴 이름 (10/19 (일)) */
  long: string;
  peakScore: number;
  /** 가장 붐비는 시각 (예: 14시) */
  peakLabel: string;
  reasons: string[];
}
export interface MonthCell {
  date: string;
  day: number;
  /** 0=일 */
  dow: number;
  peakScore: number;
}
export interface YearBar {
  label: string;
  avg: number;
}

/**
 * 이번 주 막대 (누르거나 올리면 그날 정보) + 더보기(앞으로 30일 달력 · 12개월 평균).
 * 모두 CrowdView 추정 (요일·시간·공휴일·날씨·계절 패턴)
 */
export function WeekForecast({ week, month, year, calmestDate }: { week: DayBar[]; month: MonthCell[]; year: YearBar[]; calmestDate: string }) {
  const { t, lang } = useI18n();
  const [sel, setSel] = useState(0);
  const [more, setMore] = useState<null | "month" | "year">(null);
  const d = week[sel];
  const lv = levelOf(d.peakScore);
  const dows = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    new Intl.DateTimeFormat(lang, { weekday: "narrow", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 4 + i))),
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{t("이번 주")}</h2>
          <p className="mt-0.5 text-xs text-gray-500">{t("하루 중 가장 붐빌 때 기준 · 공휴일·날씨·관광공사 예측 반영")}</p>
        </div>
        <button
          onClick={() => setMore(more ? null : "month")}
          aria-expanded={!!more}
          className="shrink-0 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700"
        >
          {more ? t("접기") : `${t("더보기")} ›`}
        </button>
      </div>

      <ul className="mt-4 grid grid-cols-7 gap-1.5">
        {week.map((w, i) => {
          const l = levelOf(w.peakScore);
          const on = i === sel;
          return (
            <li key={w.date}>
              <button
                onClick={() => setSel(i)}
                onMouseEnter={() => setSel(i)}
                onFocus={() => setSel(i)}
                aria-pressed={on}
                className="flex w-full flex-col items-center"
              >
                <span className={`flex h-20 w-full items-end rounded-lg ${on ? "bg-indigo-50" : "bg-gray-50"}`}>
                  <span
                    className={`block w-full rounded-lg transition-opacity ${on ? "ring-2 ring-gray-900 ring-offset-1" : "opacity-80"}`}
                    style={{ height: `${Math.max(8, w.peakScore)}%`, background: l.color }}
                  />
                </span>
                <span
                  className={`mt-1.5 text-xs ${on ? "font-bold text-gray-900" : w.date === calmestDate ? "font-bold text-emerald-600" : "font-medium"}`}
                >
                  {w.short}
                </span>
                <span className="text-[10px] leading-tight" style={{ color: l.color }}>
                  {t(l.label)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* 고른 날 */}
      <div className="mt-3 rounded-2xl bg-gray-50 px-4 py-3 text-sm">
        <p>
          <b>{d.long}</b> · {t("가장 붐빌 때 {hour}", { hour: d.peakLabel })} · <b style={{ color: lv.color }}>{t(lv.label)}</b>
          {d.date === calmestDate && (
            <span className="ml-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{t("이번 주 가장 한산")}</span>
          )}
        </p>
        {d.reasons.length > 0 && <p className="mt-1 text-xs text-gray-600">{d.reasons.join(" · ")}</p>}
      </div>

      {more && (
        <div className="mt-4 rounded-2xl border border-gray-100 p-4">
          <div className="flex gap-1 rounded-full bg-gray-100 p-0.5 text-xs font-semibold">
            {(["month", "year"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMore(m)}
                aria-pressed={more === m}
                className={`min-h-8 flex-1 rounded-full px-3 py-1.5 ${more === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
              >
                {m === "month" ? t("앞으로 30일") : t("월별 (12개월)")}
              </button>
            ))}
          </div>

          {more === "month" ? (
            <div className="mx-auto mt-3 max-w-sm">
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-gray-400">
                {dows.map((x, i) => (
                  <span key={i}>{x}</span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {Array.from({ length: month[0]?.dow ?? 0 }, (_, i) => (
                  <span key={`b${i}`} />
                ))}
                {month.map((c) => {
                  const l = levelOf(c.peakScore);
                  return (
                    <span
                      key={c.date}
                      title={`${c.date} · ${t(l.label)}`}
                      className="flex aspect-square flex-col items-center justify-center rounded-lg text-[11px] font-semibold"
                      style={{ background: `${l.color}26`, color: "#111827" }}
                    >
                      {c.day}
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full" style={{ background: l.color }} />
                    </span>
                  );
                })}
              </div>
            </div>
          ) : (
            <YearView year={year} />
          )}
          <p className="mt-3 text-[11px] text-gray-400">
            {more === "month"
              ? t("요일·공휴일·계절 패턴으로 본 CrowdView 추정이에요 (가장 붐빌 때 기준).")
              : t("운영 시간 평균 혼잡으로 본 CrowdView 추정이에요 (요일·공휴일·계절 패턴).")}
          </p>
        </div>
      )}
    </div>
  );
}

/** 지금부터 문 닫을 때까지 시간마다 예상 혼잡 (가장 한산한 시간 ★) */
export function UpcomingHours({ hours, bestHour }: { hours: { hour: number; label: string; score: number }[]; bestHour?: number }) {
  const { t } = useI18n();
  return (
    <ul className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
      {hours.map((h) => {
        const l = levelOf(h.score);
        const best = h.hour === bestHour;
        return (
          <li
            key={h.hour}
            className={`flex shrink-0 flex-col items-center rounded-xl px-2.5 py-1.5 ${best ? "ring-2 ring-emerald-500" : ""}`}
            style={{ background: `${l.color}1f` }}
            title={t(l.label)}
          >
            <span className="text-[11px] font-semibold text-gray-700">{h.label}</span>
            <span className="text-[11px] font-bold" style={{ color: l.color }}>
              {best ? "★ " : ""}
              {t(l.label)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** 12개월: 운영 시간 평균 혼잡. 달마다 차이가 작아 가장 한산한 달·붐비는 달을 글로도 알려 준다 */
function YearView({ year }: { year: YearBar[] }) {
  const { t } = useI18n();
  if (!year.length) return null;
  const min = Math.min(...year.map((m) => m.avg));
  const max = Math.max(...year.map((m) => m.avg));
  const calm = year.find((m) => m.avg === min)!;
  const busy = year.find((m) => m.avg === max)!;
  // 차이가 보이도록 가장 낮은 달을 30%, 가장 높은 달을 100% 높이로
  const h = (v: number) => (max === min ? 70 : 30 + ((v - min) / (max - min)) * 70);
  return (
    <div className="mt-3">
      <ul className="flex h-36 items-end gap-1.5">
        {year.map((m) => {
          const l = levelOf(m.avg);
          return (
            <li key={m.label} className="flex h-full flex-1 flex-col items-center justify-end" title={`${m.label} · ${t(l.label)}`}>
              <span className="mb-0.5 text-[9px] text-gray-400">{m.avg}</span>
              <span
                className={`block w-full rounded-md ${m === calm ? "ring-2 ring-emerald-500 ring-offset-1" : ""}`}
                style={{ height: `${h(m.avg)}%`, background: l.color }}
              />
              <span className="mt-1 text-[10px] text-gray-500">{m.label}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-sm">{t("가장 한산한 달은 {calm}, 가장 붐비는 달은 {busy}이에요.", { calm: calm.label, busy: busy.label })}</p>
    </div>
  );
}
