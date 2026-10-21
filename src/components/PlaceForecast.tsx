"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { levelOf, inkOf } from "@/lib/levels";
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
  /** 가장 붐빌 때 예상 인원(또는 대기) 문장, 막대 위 짧은 숫자 (기준이 없는 곳은 없음) */
  people?: string;
  peopleShort?: string;
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
  people?: string;
}
export interface YearBar {
  label: string;
  avg: number;
  /** 운영 시간 평균 예상 인원 문장 · 막대 위 짧은 숫자 */
  people?: string;
  peopleShort?: string;
}

interface BarItem {
  key: string;
  label: string;
  /** 막대 높이용 0~100 */
  height: number;
  score: number;
  /** 막대 위 (인원 짧게, 없으면 단계) */
  top: string;
  calm?: boolean;
}

/**
 * 막대 묶음: 주식 그래프처럼 손가락(또는 마우스)으로 막대 위를 지나가면 그 막대가 골라지고 위 칸에 인원이 나온다.
 * 세로로 밀면 화면 스크롤 (touch-action: pan-y)
 */
function ScrubBars({ items, sel, onSel, tall = false }: { items: BarItem[]; sel: number; onSel: (i: number) => void; tall?: boolean }) {
  // 막대가 많으면(12개월) 글자를 줄이고, 막대 위 숫자는 고른 막대만
  const many = items.length > 8;
  const { t } = useI18n();
  const box = useRef<HTMLUListElement>(null);
  const dragging = useRef(false);
  const pick = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || !items.length) return;
    onSel(Math.max(0, Math.min(items.length - 1, Math.floor(((clientX - r.left) / r.width) * items.length))));
  };
  return (
    <ul
      ref={box}
      className={`mt-4 flex select-none items-end ${many ? "gap-1" : "gap-1.5"} ${tall ? "h-44" : "h-40"}`}
      style={{ touchAction: "pan-y" }}
      onPointerDown={(e) => {
        dragging.current = true;
        if (e.pointerType === "mouse") pick(e.clientX);
      }}
      onPointerMove={(e) => (dragging.current || e.pointerType === "mouse") && pick(e.clientX)}
      onPointerUp={(e) => {
        if (dragging.current) pick(e.clientX);
        dragging.current = false;
      }}
      onPointerCancel={() => (dragging.current = false)}
      onPointerLeave={() => (dragging.current = false)}
    >
      {items.map((it, i) => {
        const l = levelOf(it.score);
        const on = i === sel;
        return (
          <li key={it.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            <span className={`mb-1 text-[11px] whitespace-nowrap tabular-nums ${on ? "font-bold text-gray-900" : "text-gray-500"} ${many && !on ? "invisible" : ""}`}>
              {it.top}
            </span>
            <span
              className={`block w-full rounded-lg transition-all ${on ? "ring-2 ring-gray-900 ring-offset-1" : "opacity-75"}`}
              style={{ height: `${Math.max(6, it.height)}%`, background: l.color }}
            />
            <span
              className={`mt-1.5 whitespace-nowrap ${many ? "text-[11px] tracking-tight" : "text-sm"} ${on ? "font-bold text-gray-900" : it.calm ? "font-bold text-emerald-600" : "font-medium text-gray-600"}`}
            >
              {it.label}
            </span>
            <span className="sr-only">{t(l.label)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** 막대 위 짧은 글: 인원이 있으면 인원, 없으면 단계 */
const topText = (peopleShort: string | undefined, score: number, t: (k: string) => string) => peopleShort ?? t(levelOf(score).label);

/** 차이가 작아도 보이도록 가장 낮은 막대 30%, 가장 높은 막대 100% */
const relative = (xs: number[]) => {
  const valid = xs.filter((x) => x > 0);
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  return (v: number) => (v <= 0 ? 0 : max === min ? 70 : 30 + ((v - min) / (max - min)) * 70);
};

/**
 * 이번 주 막대 (손가락으로 훑으면 그날 예상 인원) + 더보기(앞으로 30일 달력 · 요일별).
 * 레퍼런스: Queue-Times(요일 평균 + 결론 문장), Undercover Tourist(달력 칸의 '그날 이유'), TouringPlans(날짜 저장 알림)
 */
export function WeekForecast({
  week,
  month,
  weekdays,
  weekdaysReal,
  calmestDate,
  placeId,
  tripEnabled,
}: {
  week: DayBar[];
  month: MonthCell[];
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
  const [more, setMore] = useState<null | "month" | "weekday">(null);
  const [day, setDay] = useState(0);
  const [wd, setWd] = useState(0);
  const d = week[sel];
  const lv = levelOf(d.peakScore);
  const dows = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    new Intl.DateTimeFormat(lang, { weekday: "narrow", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 4 + i))),
  );
  const m = month[Math.min(day, month.length - 1)];
  const mCalm = month.reduce((a, b) => (b.peakScore < a.peakScore ? b : a), month[0]);
  const mBusy = month.reduce((a, b) => (b.peakScore > a.peakScore ? b : a), month[0]);
  const wdH = relative(weekdays.map((x) => x.avg));
  const wdValid = weekdays.filter((x) => x.avg > 0);
  const wdCalm = wdValid.reduce((a, b) => (b.avg < a.avg ? b : a), wdValid[0]);
  const wdBusy = wdValid.reduce((a, b) => (b.avg > a.avg ? b : a), wdValid[0]);
  const w = weekdays[wd];

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{t("이번 주")}</h2>
          <p className="mt-0.5 text-sm text-gray-500">{t("하루 중 가장 붐빌 때 · 막대를 누르거나 밀어 보세요")}</p>
        </div>
        <button
          onClick={() => setMore(more ? null : "month")}
          aria-expanded={!!more}
          className="shrink-0 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700"
        >
          {more ? t("접기") : `${t("더보기")} ›`}
        </button>
      </div>

      {/* 고른 날: 인원이 먼저, 크게 */}
      <div className="mt-3 rounded-2xl bg-gray-50 px-4 py-3" aria-live="polite">
        <p className="text-sm text-gray-600">
          <b className="text-gray-900">{d.long}</b> · {t("가장 붐빌 때 {hour}", { hour: d.peakLabel })}
          {d.date === calmestDate && (
            <span className="ml-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{t("이번 주 가장 한산")}</span>
          )}
        </p>
        <p className="mt-0.5 text-xl font-extrabold">
          <span style={{ color: inkOf(lv.color) }}>{t(lv.label)}</span>
          {d.people && <span className="ml-2 text-lg font-bold text-gray-900">{d.people}</span>}
        </p>
        {d.reasons.length > 0 && <p className="mt-1 text-sm text-gray-600">{d.reasons.join(" · ")}</p>}
        <TripWatchButton placeId={placeId} date={d.date} enabled={tripEnabled} />
      </div>

      <ScrubBars
        sel={sel}
        onSel={setSel}
        items={week.map((x) => ({
          key: x.date,
          label: x.short,
          height: x.peakScore,
          score: x.peakScore,
          top: topText(x.peopleShort, x.peakScore, t),
          calm: x.date === calmestDate,
        }))}
      />

      {more && (
        <div className="mt-4 rounded-2xl border border-gray-100 p-4">
          <div className="flex gap-1 rounded-full bg-gray-100 p-0.5 text-xs font-semibold">
            {(["month", "weekday"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setMore(k)}
                aria-pressed={more === k}
                className={`min-h-8 flex-1 rounded-full px-2 py-1.5 ${more === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"}`}
              >
                {k === "month" ? t("앞으로 30일") : t("요일별")}
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
                    <b style={{ color: inkOf(levelOf(m.peakScore).color) }}>{t(levelOf(m.peakScore).label)}</b>
                    {m.people && <b className="ml-1.5 text-gray-900">{m.people}</b>}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">{m.reasons.length ? m.reasons.join(" · ") : t("평소 요일·계절 패턴 그대로예요")}</p>
                  <TripWatchButton placeId={placeId} date={m.date} enabled={tripEnabled} />
                </div>
              )}
            </div>
          )}
          {more === "weekday" && wdValid.length > 0 && (
            <div className="mt-3">
              <p className="text-[15px] leading-relaxed">
                {t("{calm}요일이 가장 한산하고, {busy}요일이 가장 붐벼요.", { calm: wdCalm.label, busy: wdBusy.label })}
              </p>
              <div className="mt-3 rounded-2xl bg-gray-50 px-4 py-2.5 text-[15px]" aria-live="polite">
                <b>{w.label}</b> · <b style={{ color: inkOf(levelOf(w.avg).color) }}>{t(levelOf(w.avg).label)}</b>
                {w.people && <b className="ml-1.5 text-gray-900">{w.people}</b>}
                <span className="ml-1 text-sm text-gray-500">({t("운영 시간 평균")})</span>
              </div>
              <ScrubBars
                sel={wd}
                onSel={setWd}
                items={weekdays.map((x) => ({
                  key: x.label,
                  label: x.label,
                  height: wdH(x.avg),
                  score: x.avg,
                  top: topText(x.peopleShort, x.avg, t),
                  calm: x === wdCalm,
                }))}
              />
            </div>
          )}
          <p className="mt-3 text-[11px] text-gray-500">
            {more === "month"
              ? t("요일·공휴일·계절 패턴으로 본 CrowdView 추정이에요 (가장 붐빌 때 기준).")
              : weekdaysReal
                ? t("지금까지 쌓인 실측 기록의 하루 평균이에요.")
                : t("운영 시간 평균 혼잡으로 본 CrowdView 추정이에요 (요일·공휴일·계절 패턴).")}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * 월별 (앞으로 12개월): 달력처럼 12칸, 칸은 그 달 운영 시간 평균 단계의 색과 이름만.
 * 레퍼런스: Queue-Times "9월이 가장 한산(27%)"처럼 결론 한 줄
 */
export function MonthCalendar({ year }: { year: YearBar[] }) {
  const { t } = useI18n();
  const valid = year.filter((m) => m.avg > 0);
  if (!valid.length) return null;
  const calm = valid.reduce((a, b) => (b.avg < a.avg ? b : a), valid[0]);
  const busy = valid.reduce((a, b) => (b.avg > a.avg ? b : a), valid[0]);
  return (
    <div>
      <h2 className="text-lg font-bold">{t("월별 혼잡도")}</h2>
      <p className="mt-0.5 text-[15px] leading-relaxed text-gray-700">
        {t("가장 한산한 달은 {calm}, 가장 붐비는 달은 {busy}이에요.", { calm: calm.label, busy: busy.label })}
      </p>
      {/* 달마다 차이가 작아 모두 같은 단계일 때가 많아서, 단계 색을 바탕으로 다른 달보다 붐빌수록 진하게 */}
      <ul className="mt-3 grid grid-cols-4 gap-2">
        {year.map((m) => {
          const l = levelOf(m.avg);
          const rel = busy.avg === calm.avg ? 0.6 : (m.avg - calm.avg) / (busy.avg - calm.avg);
          const alpha = Math.round((0.25 + rel * 0.75) * 255)
            .toString(16)
            .padStart(2, "0");
          return (
            <li key={m.label} className="overflow-hidden rounded-xl border border-gray-100 text-center" title={m.people}>
              <p className="bg-gray-50 py-1 text-xs font-semibold text-gray-600">{m.label}</p>
              <p className="py-2.5 text-[13px] font-bold text-gray-900" style={{ background: m.avg ? `${l.color}${alpha}` : "#e5e7eb" }}>
                {m === calm ? t("가장 한산") : m === busy ? t("가장 붐빔") : m.avg ? t(l.label) : "–"}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-gray-500">{t("운영 시간 평균 혼잡으로 본 CrowdView 추정이에요 (요일·공휴일·계절 패턴).")}</p>
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
            <span className="text-[13px] font-bold" style={{ color: inkOf(l.color) }}>
              {best ? <Glyph e="★" className="mr-0.5 h-3 w-3 text-amber-400" /> : null}
              {t(l.label)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
