"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { levelOf } from "@/lib/levels";
import { Glyph } from "@/components/Glyph";
import { TripWatchButton } from "@/components/TripWatchButton";

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
  peakLabel: string;
  /** 고른 날 설명용 (10/25 (토)) */
  long: string;
  reasons: string[];
  /** 공휴일이면 날짜를 빨갛게 */
  holiday: boolean;
}
export interface YearBar {
  label: string;
  avg: number;
}

type More = "month" | "weekday" | "year";

/**
 * 이번 주 막대 (누르거나 올리면 그날 정보) + 더보기(앞으로 30일 달력 · 요일별 · 12개월 평균).
 * 레퍼런스: Queue-Times(요일·월 평균 + 결론 문장), Undercover Tourist(달력 칸의 '그날 이유'), TouringPlans(날짜 저장 알림)
 */
export function WeekForecast({
  week,
  month,
  year,
  weekdays,
  weekdaysReal,
  calmestDate,
  placeId,
  tripEnabled,
}: {
  week: DayBar[];
  month: MonthCell[];
  year: YearBar[];
  /** 일~토 평균 혼잡 */
  weekdays: YearBar[];
  /** 요일별이 실측 하루 요약인지 (아니면 예측) */
  weekdaysReal: boolean;
  calmestDate: string;
  placeId: string;
  tripEnabled: boolean;
}) {
  const { t, lang } = useI18n();
  const [sel, setSel] = useState(0);
  const [more, setMore] = useState<null | More>(null);
  const [day, setDay] = useState(0);
  const d = week[sel];
  const lv = levelOf(d.peakScore);
  const dows = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    new Intl.DateTimeFormat(lang, { weekday: "narrow", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 4 + i))),
  );
  const m = month[Math.min(day, month.length - 1)];
  const mCalm = month.reduce((a, b) => (b.peakScore < a.peakScore ? b : a), month[0]);
  const mBusy = month.reduce((a, b) => (b.peakScore > a.peakScore ? b : a), month[0]);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{t("이번 주")}</h2>
          <p className="mt-0.5 text-sm text-gray-500">{t("하루 중 가장 붐빌 때 기준 · 공휴일·날씨·관광공사 예측 반영")}</p>
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
                <span className={`flex h-24 w-full items-end rounded-lg ${on ? "bg-indigo-50" : "bg-gray-50"}`}>
                  <span
                    className={`block w-full rounded-lg transition-opacity ${on ? "ring-2 ring-gray-900 ring-offset-1" : "opacity-80"}`}
                    style={{ height: `${Math.max(8, w.peakScore)}%`, background: l.color }}
                  />
                </span>
                <span
                  className={`mt-1.5 text-sm ${on ? "font-bold text-gray-900" : w.date === calmestDate ? "font-bold text-emerald-600" : "font-medium"}`}
                >
                  {w.short}
                </span>
                <span className="text-xs leading-tight font-semibold" style={{ color: l.color }}>
                  {t(l.label)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* 고른 날 */}
      <div className="mt-3 rounded-2xl bg-gray-50 px-4 py-3 text-[15px] leading-relaxed">
        <p>
          <b>{d.long}</b> · {t("가장 붐빌 때 {hour}", { hour: d.peakLabel })} · <b style={{ color: lv.color }}>{t(lv.label)}</b>{" "}
          <span className="text-sm whitespace-nowrap text-gray-500">{t("혼잡 지수 {n}", { n: d.peakScore })}</span>
          {d.date === calmestDate && (
            <span className="ml-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{t("이번 주 가장 한산")}</span>
          )}
        </p>
        {d.reasons.length > 0 && <p className="mt-1 text-sm text-gray-600">{d.reasons.join(" · ")}</p>}
        <TripWatchButton placeId={placeId} date={d.date} enabled={tripEnabled} />
      </div>

      {more && (
        <div className="mt-4 rounded-2xl border border-gray-100 p-4">
          <div className="flex gap-1 rounded-full bg-gray-100 p-0.5 text-xs font-semibold">
            {(["month", "weekday", "year"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setMore(k)}
                aria-pressed={more === k}
                className={`min-h-8 flex-1 rounded-full px-2 py-1.5 ${more === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
              >
                {k === "month" ? t("앞으로 30일") : k === "weekday" ? t("요일별") : t("월별 (12개월)")}
              </button>
            ))}
          </div>

          {more === "month" && (
            <div className="mx-auto mt-3 max-w-sm">
              <p className="text-[15px] leading-relaxed">
                {t("앞으로 30일 중 가장 한산한 날은 {calm}, 가장 붐비는 날은 {busy}예요.", { calm: mCalm.long, busy: mBusy.long })}
              </p>
              <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-gray-500">
                {dows.map((x, i) => (
                  <span key={i}>{x}</span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {Array.from({ length: month[0]?.dow ?? 0 }, (_, i) => (
                  <span key={`b${i}`} />
                ))}
                {month.map((c, i) => {
                  const l = levelOf(c.peakScore);
                  const on = i === day;
                  return (
                    <button
                      key={c.date}
                      onClick={() => setDay(i)}
                      aria-pressed={on}
                      aria-label={`${c.long} ${t(l.label)}`}
                      className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm font-semibold ${
                        on ? "ring-2 ring-gray-900" : ""
                      } ${c.holiday ? "text-red-600" : "text-gray-900"}`}
                      style={{ background: `${l.color}26` }}
                    >
                      {c.day}
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full" style={{ background: l.color }} />
                      {/* 이유가 있는 날(공휴일·비·관광공사 예측 등)은 오른쪽 위에 작은 점 */}
                      {c.reasons.length > 0 && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-gray-700" aria-hidden />}
                    </button>
                  );
                })}
              </div>
              {m && (
                <div className="mt-3 rounded-2xl bg-gray-50 px-4 py-3 text-[15px] leading-relaxed">
                  <p>
                    <b>{m.long}</b> · {t("가장 붐빌 때 {hour}", { hour: m.peakLabel })} ·{" "}
                    <b style={{ color: levelOf(m.peakScore).color }}>{t(levelOf(m.peakScore).label)}</b>{" "}
                    <span className="text-sm whitespace-nowrap text-gray-500">{t("혼잡 지수 {n}", { n: m.peakScore })}</span>
                  </p>
                  <p className="mt-1 text-sm text-gray-600">{m.reasons.length ? m.reasons.join(" · ") : t("평소 요일·계절 패턴 그대로예요")}</p>
                  <TripWatchButton placeId={placeId} date={m.date} enabled={tripEnabled} />
                </div>
              )}
            </div>
          )}
          {more === "weekday" && <BarsView bars={weekdays} kind="weekday" />}
          {more === "year" && <BarsView bars={year} kind="month" />}
          <p className="mt-3 text-[11px] text-gray-400">
            {more === "month"
              ? t("요일·공휴일·계절 패턴으로 본 CrowdView 추정이에요 (가장 붐빌 때 기준).")
              : more === "weekday" && weekdaysReal
                ? t("지금까지 쌓인 실측 기록의 하루 평균이에요.")
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
            className={`flex shrink-0 flex-col items-center rounded-xl px-3 py-2 ${best ? "ring-2 ring-emerald-500" : ""}`}
            style={{ background: `${l.color}1f` }}
            title={t(l.label)}
          >
            <span className="text-sm font-semibold text-gray-800">{h.label}</span>
            <span className="text-[13px] font-bold" style={{ color: l.color }}>
              {best ? <Glyph e="★" className="mr-0.5 h-3 w-3 text-amber-400" /> : null}
              {t(l.label)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 12개월·요일별 평균 혼잡 막대 + 결론 한 줄 (레퍼런스: Queue-Times "9월이 가장 한산(27%)").
 * 차이가 작아도 보이도록 가장 낮은 막대를 30%, 가장 높은 막대를 100% 높이로
 */
function BarsView({ bars, kind }: { bars: YearBar[]; kind: "month" | "weekday" }) {
  const { t } = useI18n();
  const valid = bars.filter((m) => m.avg > 0);
  if (!valid.length) return null;
  const min = Math.min(...valid.map((m) => m.avg));
  const max = Math.max(...valid.map((m) => m.avg));
  const calm = valid.find((m) => m.avg === min)!;
  const busy = valid.find((m) => m.avg === max)!;
  const h = (v: number) => (max === min ? 70 : 30 + ((v - min) / (max - min)) * 70);
  return (
    <div className="mt-3">
      <p className="text-[15px] leading-relaxed">
        {kind === "month"
          ? t("가장 한산한 달은 {calm}, 가장 붐비는 달은 {busy}이에요.", { calm: calm.label, busy: busy.label })
          : t("{calm}요일이 가장 한산하고(평균 {calmN}), {busy}요일이 가장 붐벼요(평균 {busyN}).", {
              calm: calm.label,
              busy: busy.label,
              calmN: calm.avg,
              busyN: busy.avg,
            })}
      </p>
      <ul className="mt-3 flex h-36 items-end gap-1.5">
        {bars.map((m) => {
          const l = levelOf(m.avg);
          return (
            <li key={m.label} className="flex h-full flex-1 flex-col items-center justify-end" title={`${m.label} · ${t(l.label)}`}>
              <span className="mb-0.5 text-[11px] text-gray-500">{m.avg}</span>
              <span
                className={`block w-full rounded-md ${m === calm ? "ring-2 ring-emerald-500 ring-offset-1" : ""}`}
                style={{ height: `${h(m.avg)}%`, background: l.color }}
              />
              <span className="mt-1 text-xs text-gray-600">{m.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
