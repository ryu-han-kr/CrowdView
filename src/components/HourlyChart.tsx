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

// 왼쪽 단계 이름 칸은 없앴다 (지인 QA 10/30: 글씨가 작고 답답, 선 색이 이미 단계) — 첫 시간 눈금 글자만큼만 띄운다
const MARGIN = { top: 8, right: 12, bottom: 34, left: 12 };

const PEOPLE_NOTE: Record<NonNullable<HourPoint["peopleKind"]>, string> = {
  real: "실측·공식 예보",
  pattern: "생활인구 패턴 기반",
  est: "추정",
  area: "주변 실측 인구로 계산한 명소 기준 추정",
};

/** 시간 → 차트 x값 (Bklit 차트는 시간축이라 날짜로 바꿔 넣는다) */
const hourDate = (h: number) => new Date(Date.UTC(2000, 0, 1, h));

/** 글자 폭 어림 (12px 기준): 한글·한자·가나는 한 글자가 거의 정사각형, 그 밖은 절반쯤 */
const textWidth = (s: string) =>
  [...s].reduce((w, c) => w + (/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af\u3040-\u30ff\u4e00-\u9fff]/.test(c) ? 12 : 6.6), 0);

/**
 * 고른 점 위 말풍선 (사용자 10/26: 올린 자리에서 바로 읽히게). 위가 모자라면 아래로, 양 끝에선 안쪽으로 밀어 넣는다.
 * 차트 안(useChart)에서만 쓴다. 색은 차트 토큰이라 다크 모드에서도 뒤집힌다
 */
export function ChartBubble({ x, y, lines }: { x: number; y: number; lines: string[] }) {
  const { innerWidth } = useChart();
  const pad = 9;
  const w = Math.max(...lines.map(textWidth)) + pad * 2;
  const h = lines.length * 15 + pad * 2 - 4;
  const left = Math.max(-4, Math.min(innerWidth - w + 4, x - w / 2));
  const above = y - 16 - h >= -4;
  const top = above ? y - 16 - h : y + 16;
  return (
    <g pointerEvents="none" transform={`translate(${left}, ${top})`} style={{ transition: "transform 0.12s ease" }}>
      <rect width={w} height={h} rx="9" fill="var(--chart-foreground)" />
      {lines.map((s, i) => (
        <text key={i} x={pad} y={pad + 11 + i * 15} fontSize={i === 0 ? 12.5 : 11.5} fontWeight={i === 0 ? 700 : 500} fill="var(--chart-background)">
          {s}
        </text>
      ))}
    </g>
  );
}

/** 고른 시간: 세로선 + 단계 색 점 + 말풍선 */
function Selected({ hour, score, lines }: { hour: number; score: number; lines: string[] }) {
  const { xScale, yScale, innerHeight } = useChart();
  const x = xScale(hourDate(hour));
  const color = levelOf(score).color;
  return (
    <g pointerEvents="none">
      {/* 커서를 올리면 점이 커지고 고리가 퍼진다 (경수님 QA #6 10/27: 확대 효과). 위치 전환은 0.15초 */}
      <line x1={x} x2={x} y1={0} y2={innerHeight} stroke={color} strokeOpacity="0.5" strokeWidth="2" style={{ transition: "x1 0.15s, x2 0.15s" }} />
      <circle cx={x} cy={yScale(score)} r="16" fill={color} fillOpacity="0.14" className="chart-pulse" style={{ transformOrigin: `${x}px ${yScale(score)}px`, transition: "cx 0.15s, cy 0.15s" }} />
      <circle cx={x} cy={yScale(score)} r="8" fill={color} stroke="#fff" strokeWidth="3" style={{ transition: "cx 0.15s, cy 0.15s" }} />
      <ChartBubble x={x} y={yScale(score)} lines={lines} />
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

/** 단계 경계 옅은 가로줄 (단계 이름은 위 칸·말풍선이 보여 준다) */
function LevelLines() {
  const { yScale, innerWidth } = useChart();
  return (
    <g pointerEvents="none">
      {LEVELS.slice(1).map((l) => (
        <line key={l.key} x1={0} x2={innerWidth} y1={yScale(l.min)} y2={yScale(l.min)} stroke="var(--color-gray-100)" strokeWidth="1" />
      ))}
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
          {/* 차트 색 변수라 다크 모드에서 밝은 알약 + 어두운 글씨로 뒤집힌다 */}
          <rect x={nowX - 22} y={y - 15} width="44" height="21" rx="10.5" fill="var(--chart-foreground)" />
          <text x={nowX} y={y} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--chart-background)">
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
 * 시간대별 혼잡도 (Bklit UI 영역 차트). '지금'까지 지난 시간은 실선, 앞으로는 점선 (지인 QA 10/30: 실측·추정 구분보다 지난·앞으로가 한눈에).
 * 휴대폰: 그래프를 누르거나 옆으로 밀면 그 시간의 단계·인원이 위 칸에 나온다 (세로로 밀면 화면 스크롤)
 * estimated: 지난 시간도 실측이 아니라 예측 모델 값일 때
 * forecastLabel: 예측 구간 이름 (공항은 AI가 아니라 공항공사 예고치라 '공항공사 예고', QA #15 10/27)
 */
export function HourlyChart({
  points,
  highlightHour,
  estimated = false,
  unit = "명",
  forecastLabel = "AI 예측",
  aspect = "2 / 1",
}: {
  points: HourPoint[];
  highlightHour?: number;
  estimated?: boolean;
  unit?: "명" | "분";
  forecastLabel?: string;
  /** 그래프 가로:세로 (장소 페이지는 낮게, 경수님 10/28) */
  aspect?: string;
}) {
  const { t, lang } = useI18n();
  const val = (n: number) => (unit === "분" ? fmtMinutes(n, t) : fmtPeople(n, t, lang));
  const nowIdx = points.findIndex((p) => p.hour === highlightHour);
  const [sel, setSel] = useState(nowIdx >= 0 ? nowIdx : points.reduce((m, p, i) => (p.score > points[m].score ? i : m), 0));
  const data = useMemo(() => points.map((p) => ({ date: hourDate(p.hour), score: p.score })), [points]);
  const margin = MARGIN;
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

  // 오늘 그래프는 '지금'부터 점선, 다른 날은 실측 구간(예측 아님) 다음부터
  const lastMeasured = nowIdx >= 0 ? nowIdx : estimated ? 0 : Math.max(0, points.reduce((m, p, i) => (!p.forecast ? i : m), -1));
  const p = points[Math.min(sel, points.length - 1)];
  const prev = points[sel - 1];
  const level = levelOf(p.score);
  const isMeasured = !p.forecast && !estimated;
  const delta =
    // 인원 증감은 같은 종류의 수치끼리만 (실측과 추정을 섞으면 엉뚱한 차이가 난다)
    prev && p.people !== undefined && prev.people !== undefined && (p.peopleKind === "est") === (prev.peopleKind === "est")
      ? { text: `${p.people >= prev.people ? "+" : "−"}${val(Math.abs(p.people - prev.people))}`, diff: p.people - prev.people }
      : null;

  return (
    <div>
      {/* 고른 시간 상세 */}
      {/* 높이를 고정해 셋째 줄이 있고 없고에 따라 그래프가 위아래로 밀리지 않게 (QA #19) */}
      <div className="mb-2 flex min-h-[92px] items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3" aria-live="polite">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-600">
            <b className="text-gray-900">{formatHour(p.hour, lang)}</b> {sel === nowIdx ? `· ${t("지금")}` : ""} ·{" "}
            {isMeasured ? t("실측") : t(forecastLabel)}
          </p>
          <p className="mt-0.5 text-xl font-extrabold" style={{ color: inkOf(level.color) }}>
            {t(level.label)}
            {p.people !== undefined && (
              <span className="ml-2 text-lg font-bold text-gray-900">
                {p.peopleKind === "est" ? t("약 {v}", { v: val(p.people) }) : val(p.people)}
                {p.peopleKind === "est" && <span className="ml-1 text-[13px] font-medium text-gray-500">({t("추정")})</span>}
              </span>
            )}
          </p>
          {/* 인원의 출처. 인원 기준이 없는 곳도 점수는 보이지 않는다 (경수님 10/29: 단위는 모두 사람) */}
          <p className="min-h-4 text-xs text-gray-500">
            {p.peopleKind && p.peopleKind !== "est" && SHOW_DATA_LABELS && (
              <span>
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

      {/* 선 모양 범례를 그래프 위에 크게 (지인 QA 10/30: 아래 작은 범례로는 실선·점선 구분이 안 보였다) */}
      <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-gray-700">
        {lastMeasured > 0 && (
          <span className="flex items-center gap-1.5">
            <svg width="24" height="8" aria-hidden>
              <line x1="2" x2="22" y1="4" y2="4" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
            {t("지난 시간")}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <svg width="24" height="8" aria-hidden>
            <line x1="1" x2="23" y1="4" y2="4" stroke="currentColor" strokeWidth="3.5" strokeDasharray="6 5" />
          </svg>
          {t(forecastLabel)}
        </span>
      </div>

      <div role="img" aria-label={t("시간대별 혼잡도 그래프")} className="relative select-none">
        <AreaChart data={data} yMax={100} margin={margin} aspectRatio={aspect} animationDuration={700}>
          <LevelGradients id={gid} />
          <LevelLines />
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
          <Selected
            hour={p.hour}
            score={p.score}
            lines={[
              `${formatHour(p.hour, lang)} · ${t(level.label)}`,
              ...(p.people !== undefined ? [p.peopleKind === "est" ? t("약 {v}", { v: val(p.people) }) : val(p.people)] : []),
            ]}
          />
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

      <div className="mt-1 flex justify-end text-xs text-gray-500">
        <span>{t("시간을 눌러 자세히")}</span>
      </div>
    </div>
  );
}
