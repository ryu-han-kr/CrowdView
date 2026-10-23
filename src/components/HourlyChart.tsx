"use client";

import { useId, useMemo, useRef, useState } from "react";
import { AreaChart } from "@/components/charts/area-chart";
import { Area } from "@/components/charts/area";
import { useChart } from "@/components/charts/chart-context";
import { useI18n } from "@/i18n/client";
import { fmtMinutes, fmtPeople } from "@/i18n/patterns";
import { formatHour } from "@/i18n/translate";
import { SHOW_DATA_LABELS } from "@/lib/format";
import { LEVELS, levelOf, inkOf } from "@/lib/levels";
import type { HourPoint } from "@/lib/types";

// 왼쪽 58px는 단계 이름 칸 (그래프 선과 글씨가 겹치지 않게 그림 밖에 둔다)
const MARGIN = { top: 8, right: 10, bottom: 34, left: 66 };
// 영어처럼 단계 이름이 긴 언어 ('Very crowded'): 왼쪽 칸을 넓히고 글자를 줄인다 (UI QA 12차: 이름이 그래프 안으로 넘쳤다)
const WIDE_MARGIN = { ...MARGIN, left: 96 };
const isWide = (labels: Record<number, string>) => Object.values(labels).some((x) => x.length > 6 && /[a-z]/i.test(x));

const PEOPLE_NOTE: Record<NonNullable<HourPoint["peopleKind"]>, string> = {
  real: "실측·공식 예보",
  pattern: "생활인구 패턴 기반",
  est: "추정",
  area: "주변 실측 인구로 계산한 명소 기준 추정",
};

/** 시간 → 차트 x값 (Bklit 차트는 시간축이라 날짜로 바꿔 넣는다) */
const hourDate = (h: number) => new Date(Date.UTC(2000, 0, 1, h));

/** 고른 시간: 세로선 + 단계 색 점 */
function Selected({ hour, score }: { hour: number; score: number }) {
  const { xScale, yScale, innerHeight } = useChart();
  const x = xScale(hourDate(hour));
  const color = levelOf(score).color;
  return (
    <g pointerEvents="none">
      <line x1={x} x2={x} y1={0} y2={innerHeight} stroke={color} strokeOpacity="0.5" strokeWidth="2" />
      <circle cx={x} cy={yScale(score)} r="11" fill={color} fillOpacity="0.18" />
      <circle cx={x} cy={yScale(score)} r="6" fill={color} stroke="#fff" strokeWidth="2.5" />
    </g>
  );
}
Selected.__isPostOverlay = true;

/**
 * 혼잡 단계 색 그라데이션: 선과 아래 면이 높이(혼잡 지수)에 따라 초록 → 노랑 → 주황 → 빨강으로 물든다.
 * 높이 기준(userSpaceOnUse)이라 같은 높이는 어느 시간이든 같은 색
 */
export function LevelGradients({ id }: { id: string }) {
  const { yScale } = useChart();
  const stops = LEVELS.map((l) => ({ off: l.min === 0 ? 0 : (l.min + 10) / 100, color: l.color }));
  return (
    <defs>
      <linearGradient id={`${id}-stroke`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={yScale(0)} y2={yScale(100)}>
        {stops.map((s) => (
          <stop key={s.off} offset={s.off} stopColor={s.color} />
        ))}
      </linearGradient>
      <linearGradient id={`${id}-fill`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={yScale(0)} y2={yScale(100)}>
        {stops.map((s) => (
          <stop key={s.off} offset={s.off} stopColor={s.color} stopOpacity={0.06 + s.off * 0.34} />
        ))}
      </linearGradient>
    </defs>
  );
}

/**
 * 단계 이름: 그래프 왼쪽 바깥 칸에, 각 단계 띠의 가운데 높이로 (선과 겹치지 않게).
 * 띠 경계는 옅은 가로줄, 이름 옆 작은 색 막대로 어느 높이가 어느 단계인지 보이게
 */
function LevelLines({ labels }: { labels: Record<number, string> }) {
  const { yScale, innerWidth } = useChart();
  const M = isWide(labels) ? WIDE_MARGIN : MARGIN;
  const fs = isWide(labels) ? 11 : 12.5;
  return (
    <g pointerEvents="none">
      {LEVELS.map((l, i) => {
        const top = LEVELS[i + 1]?.min ?? 100;
        return (
          <g key={l.key}>
            {i > 0 && <line x1={0} x2={innerWidth} y1={yScale(l.min)} y2={yScale(l.min)} stroke="#eef0f3" strokeWidth="1" />}
            <rect x={-5} y={yScale(top) + 1} width={3} height={Math.max(1, yScale(l.min) - yScale(top) - 2)} rx={1.5} fill={l.color} />
            {/* 단계 이름: 왼쪽 칸 가운데에 옅은 색 알약 + 진한 글씨 (사용자 QA 10/22: 너무 왼쪽에 붙어 보였다) */}
            <rect x={-M.left + 6} y={yScale((l.min + top) / 2) - 10} width={M.left - 16} height={20} rx={10} fill={l.color} fillOpacity={0.14} />
            <text x={-M.left / 2 - 4} y={yScale((l.min + top) / 2) + 4.5} textAnchor="middle" fontSize={fs} fontWeight="800" fill={inkOf(l.color)}>
              {labels[l.key]}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** 아래 시간 눈금(3시간마다) + '지금' 표시 */
function HourAxis({ hours, nowIdx, nowLabel }: { hours: number[]; nowIdx: number; nowLabel: string }) {
  const { xScale, innerHeight } = useChart();
  const y = innerHeight + 22;
  const nowX = nowIdx >= 0 ? xScale(hourDate(hours[nowIdx])) : null;
  return (
    <g pointerEvents="none">
      {nowX !== null && <line x1={nowX} x2={nowX} y1={0} y2={innerHeight} stroke="#111827" strokeDasharray="3 3" strokeOpacity="0.45" />}
      {hours.map((h, i) =>
        h % 3 === 0 && (nowIdx < 0 || Math.abs(i - nowIdx) > 1) ? (
          <text key={h} x={xScale(hourDate(h))} y={y} textAnchor="middle" fontSize="13" fill="#6b7280">
            {h}
          </text>
        ) : null,
      )}
      {nowX !== null && (
        <g>
          <rect x={nowX - 22} y={y - 15} width="44" height="21" rx="10.5" fill="#111827" />
          <text x={nowX} y={y} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">
            {nowLabel}
          </text>
        </g>
      )}
    </g>
  );
}
HourAxis.__isPostOverlay = true;
LevelLines.__isPostOverlay = true;

/**
 * 시간대별 혼잡도 (Bklit UI 영역 차트). 실측은 실선, AI 예측은 점선.
 * 휴대폰: 그래프를 누르거나 옆으로 밀면 그 시간의 단계·인원이 위 칸에 나온다 (세로로 밀면 화면 스크롤)
 * estimated: 지난 시간도 실측이 아니라 예측 모델 값일 때
 */
export function HourlyChart({
  points,
  highlightHour,
  estimated = false,
  unit = "명",
}: {
  points: HourPoint[];
  highlightHour?: number;
  estimated?: boolean;
  unit?: "명" | "분";
}) {
  const { t, lang } = useI18n();
  const val = (n: number) => (unit === "분" ? fmtMinutes(n, t) : fmtPeople(n, t, lang));
  const nowIdx = points.findIndex((p) => p.hour === highlightHour);
  const [sel, setSel] = useState(nowIdx >= 0 ? nowIdx : points.reduce((m, p, i) => (p.score > points[m].score ? i : m), 0));
  const data = useMemo(() => points.map((p) => ({ date: hourDate(p.hour), score: p.score })), [points]);
  const levelLabels = useMemo(() => Object.fromEntries(LEVELS.map((l) => [l.key, t(l.label)])), [t]);
  const margin = isWide(levelLabels) ? WIDE_MARGIN : MARGIN;
  const gid = `hc${useId().replace(/:/g, "")}`;
  const touch = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  // 손가락·마우스 위치 → 가장 가까운 시간 (차트 여백 제외)
  const pick = (clientX: number) => {
    const el = touch.current;
    if (!el || points.length < 2) return;
    const r = el.getBoundingClientRect();
    // 글자 크기 설정(zoom)으로 화면 좌표와 CSS 크기가 다를 수 있어 여백도 같은 비율로
    const k = el.offsetWidth ? r.width / el.offsetWidth : 1;
    const f = (clientX - r.left - margin.left * k) / (r.width - (margin.left + margin.right) * k);
    setSel(Math.max(0, Math.min(points.length - 1, Math.round(f * (points.length - 1)))));
  };
  if (points.length === 0) return null;

  // 실측 구간(예측 아님) 다음부터 점선
  const lastMeasured = estimated ? 0 : Math.max(0, points.reduce((m, p, i) => (!p.forecast ? i : m), -1));
  const p = points[Math.min(sel, points.length - 1)];
  const prev = points[sel - 1];
  const level = levelOf(p.score);
  const isMeasured = !p.forecast && !estimated;
  const delta =
    // 인원 증감은 같은 종류의 수치끼리만 (실측과 추정을 섞으면 엉뚱한 차이가 난다)
    prev && p.people !== undefined && prev.people !== undefined && (p.peopleKind === "est") === (prev.peopleKind === "est")
      ? { text: `${p.people >= prev.people ? "+" : "−"}${val(Math.abs(p.people - prev.people))}`, diff: p.people - prev.people }
      : prev
        ? { text: `${p.score >= prev.score ? "+" : "−"}${t("{n}점", { n: Math.abs(p.score - prev.score) })}`, diff: p.score - prev.score }
        : null;

  return (
    <div>
      {/* 고른 시간 상세 */}
      <div className="mb-2 flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3" aria-live="polite">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-600">
            <b className="text-gray-900">{formatHour(p.hour, lang)}</b> {sel === nowIdx ? `· ${t("지금")}` : ""} ·{" "}
            {isMeasured ? t("실측") : t("AI 예측")}
          </p>
          <p className="mt-0.5 text-xl font-extrabold" style={{ color: inkOf(level.color) }}>
            {t(level.label)}
            {p.people !== undefined && (
              <span className="ml-2 text-lg font-bold text-gray-900">
                {p.peopleKind === "est" ? t("약 {v}", { v: val(p.people) }) : val(p.people)}
              </span>
            )}
          </p>
          {/* 인원이 있으면 인원의 출처를, 없을 때만 혼잡 지수를 (점수로 판단하지 않게) */}
          <p className="text-xs text-gray-500">
            {p.people === undefined && t("혼잡 지수 {n}", { n: p.score })}
            {p.peopleKind && SHOW_DATA_LABELS && (
              <span className={p.peopleKind === "est" ? "text-amber-700" : undefined}>
                {t("인원")}: {t(PEOPLE_NOTE[p.peopleKind])}
              </span>
            )}
          </p>
        </div>
        {delta && (
          <div className="shrink-0 text-right">
            <p className="text-xs text-gray-500">{t("{h} 대비", { h: formatHour(prev!.hour, lang) })}</p>
            <p className={`text-base font-bold ${delta.diff > 0 ? "text-red-600" : delta.diff < 0 ? "text-emerald-700" : "text-gray-500"}`}>
              {delta.diff > 0 ? "↑" : delta.diff < 0 ? "↓" : "→"} {delta.text}
            </p>
          </div>
        )}
      </div>

      <div role="img" aria-label={t("시간대별 혼잡도 그래프")} className="relative select-none">
        <AreaChart data={data} yMax={100} margin={margin} aspectRatio="2 / 1" animationDuration={700}>
          <LevelGradients id={gid} />
          <LevelLines labels={levelLabels} />
          <Area
            dataKey="score"
            fill={`url(#${gid}-fill)`}
            stroke={`url(#${gid}-stroke)`}
            strokeWidth={3}
            fillOpacity={0.28}
            dashFromIndex={lastMeasured}
            dashArray="6,5"
          />
          <HourAxis hours={points.map((x) => x.hour)} nowIdx={nowIdx} nowLabel={t("지금")} />
          <Selected hour={p.hour} score={p.score} />
        </AreaChart>
        {/* 누르기·밀기 영역: 가로로 밀면 시간이 바뀌고, 세로로 밀면 화면이 스크롤된다 */}
        <div
          ref={touch}
          className="absolute inset-0 z-10 cursor-pointer"
          style={{ touchAction: "pan-y" }}
          // 누르는 순간엔 고르지 않는다: 세로로 밀어 스크롤하면 브라우저가 pointercancel을 보내 그대로 둔다
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
        />
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <svg width="20" height="6" aria-hidden>
            <line x1="0" x2="20" y1="3" y2="3" stroke="#6b7280" strokeWidth="3" strokeDasharray={estimated ? "5 4" : undefined} />
          </svg>
          {estimated ? t("지난 시간 (추정)") : t("실측")}
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="20" height="6" aria-hidden>
            <line x1="0" x2="20" y1="3" y2="3" stroke="#6b7280" strokeWidth="3" strokeDasharray="5 4" />
          </svg>
          {t("AI 예측")}
        </span>
        <span className="ml-auto text-gray-500">{t("시간을 눌러 자세히")}</span>
      </div>
    </div>
  );
}
