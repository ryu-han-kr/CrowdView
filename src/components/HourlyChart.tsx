"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmtMinutes, fmtPeople } from "@/i18n/patterns";
import { formatHour } from "@/i18n/translate";
import { SHOW_DATA_LABELS } from "@/lib/format";
import { LEVELS, levelOf } from "@/lib/levels";
import type { HourPoint } from "@/lib/types";

const W = 360;
const H = 170;
const PAD = { l: 8, r: 8, t: 12, b: 26 };
const MEASURED = "#4f46e5";
const FORECAST = "#a78bfa";

const PEOPLE_NOTE: Record<NonNullable<HourPoint["peopleKind"]>, string> = {
  real: "실측·공식 예보",
  pattern: "생활인구 패턴 기반",
  est: "추정",
};

/**
 * 시간대별 혼잡도. 실측은 실선+진한 영역, AI 예측은 점선+옅은 영역.
 * 시간을 누르면(또는 올리면) 단계·인원·이전 시간 대비 증감을 보여준다.
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
  if (points.length === 0) return null;

  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, points.length - 1);
  const y = (score: number) => PAD.t + (1 - Math.min(100, score) / 100) * (H - PAD.t - PAD.b);
  const baseY = y(0);

  // 실측 구간(예측 아님)과 예측 구간. 예측선은 마지막 실측점에서 이어진다
  const lastMeasured = points.reduce((m, p, i) => (!p.forecast ? i : m), -1);
  const measured = points.slice(0, lastMeasured + 1).map((p, i) => [x(i), y(p.score)] as const);
  const fStart = Math.max(0, lastMeasured);
  const forecast = points.slice(fStart).map((p, i) => [x(fStart + i), y(p.score)] as const);

  const line = (pts: readonly (readonly [number, number])[]) => pts.map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`).join(" ");
  const area = (pts: readonly (readonly [number, number])[]) =>
    pts.length > 1 ? `${line(pts)} L${pts.at(-1)![0]},${baseY} L${pts[0][0]},${baseY} Z` : "";

  const p = points[sel];
  const prev = points[sel - 1];
  const level = levelOf(p.score);
  const isMeasured = !p.forecast && !estimated;
  const delta =
    // 인원 증감은 같은 종류의 수치끼리만 (실측과 추정을 섞으면 엉뚱한 차이가 난다)
    prev && p.people !== undefined && prev.people !== undefined && (p.peopleKind === "est") === (prev.peopleKind === "est")
      ? { text: `${p.people >= prev.people ? "+" : "−"}${val(Math.abs(p.people - prev.people))}`, up: p.people > prev.people }
      : prev
        ? { text: `${p.score >= prev.score ? "+" : "−"}${t("{n}점", { n: Math.abs(p.score - prev.score) })}`, up: p.score > prev.score }
        : null;

  return (
    <div>
      {/* 고른 시간 상세 */}
      <div className="mb-3 flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500">
            {formatHour(p.hour, lang)} {sel === nowIdx ? `· ${t("지금")}` : ""} · {isMeasured ? t("실측") : t("AI 예측")}
          </p>
          <p className="mt-0.5 text-lg font-bold" style={{ color: level.color }}>
            {t(level.label)}
            {p.people !== undefined && (
              <span className="ml-2 text-base font-semibold text-gray-900">
                {p.peopleKind === "est" ? t("약 {v}", { v: val(p.people) }) : val(p.people)}
              </span>
            )}
          </p>
          {p.peopleKind && SHOW_DATA_LABELS && (
            <p className={`text-[11px] ${p.peopleKind === "est" ? "text-amber-600" : "text-gray-400"}`}>
              {t("인원")}: {t(PEOPLE_NOTE[p.peopleKind])}
            </p>
          )}
        </div>
        {delta && (
          <div className="shrink-0 text-right">
            <p className="text-[11px] text-gray-500">{t("{h} 대비", { h: formatHour(prev!.hour, lang) })}</p>
            <p className={`text-sm font-bold ${delta.up ? "text-red-500" : "text-emerald-600"}`}>
              {delta.up ? "↑" : "↓"} {delta.text}
            </p>
          </div>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full touch-none select-none" role="img" aria-label={t("시간대별 혼잡도 그래프")}>
        <defs>
          <linearGradient id="hc-measured" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={MEASURED} stopOpacity="0.32" />
            <stop offset="100%" stopColor={MEASURED} stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="hc-forecast" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={FORECAST} stopOpacity="0.22" />
            <stop offset="100%" stopColor={FORECAST} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* 단계 경계선 (보통·혼잡·매우 혼잡) */}
        {LEVELS.slice(2).map((l) => (
          <g key={l.key}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(l.min)} y2={y(l.min)} stroke={l.color} strokeOpacity="0.25" strokeDasharray="2 4" />
            <text x={W - PAD.r} y={y(l.min) - 3} textAnchor="end" fontSize="8" fill={l.color} fillOpacity="0.8">
              {t(l.label)}
            </text>
          </g>
        ))}

        <path d={area(forecast)} fill="url(#hc-forecast)" />
        <path d={area(measured)} fill={estimated ? "url(#hc-forecast)" : "url(#hc-measured)"} />
        <path d={line(forecast)} fill="none" stroke={FORECAST} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />
        <path
          d={line(measured)}
          fill="none"
          stroke={estimated ? FORECAST : MEASURED}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={estimated ? "5 4" : undefined}
        />

        {/* 지금: 세로 점선 */}
        {nowIdx >= 0 && <line x1={x(nowIdx)} x2={x(nowIdx)} y1={PAD.t} y2={baseY} stroke="#111827" strokeDasharray="3 3" strokeOpacity="0.5" />}

        {/* 점 */}
        {points.map((pt, i) => (
          <circle
            key={pt.hour}
            cx={x(i)}
            cy={y(pt.score)}
            r={i === sel ? 5 : 2.5}
            fill={i === sel ? levelOf(pt.score).color : "#fff"}
            stroke={levelOf(pt.score).color}
            strokeWidth={i === sel ? 2.5 : 1.5}
          />
        ))}

        {/* 시간 눈금 */}
        {points.map((pt, i) =>
          pt.hour % 3 === 0 ? (
            <text key={`t${pt.hour}`} x={x(i)} y={H - 12} textAnchor="middle" fontSize="9" fill="#9ca3af">
              {pt.hour}
            </text>
          ) : null,
        )}

        {/* 지금 라벨: 그래프 아래, 시간 눈금 자리에 진하게 */}
        {nowIdx >= 0 && (
          <g>
            <rect x={x(nowIdx) - 17} y={H - 24} width="34" height="16" rx="8" fill="#111827" />
            <text x={x(nowIdx)} y={H - 12.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">
              {t("지금")}
            </text>
          </g>
        )}

        {/* 누르기 영역 */}
        {points.map((pt, i) => (
          <rect
            key={`hit${pt.hour}`}
            x={x(i) - (W - PAD.l - PAD.r) / (points.length - 1) / 2}
            y={0}
            width={(W - PAD.l - PAD.r) / (points.length - 1)}
            height={H}
            fill="transparent"
            className="cursor-pointer"
            onPointerEnter={(e) => e.pointerType === "mouse" && setSel(i)}
            onPointerDown={() => setSel(i)}
          >
            <title>{`${formatHour(pt.hour, lang)} ${t(levelOf(pt.score).label)}`}</title>
          </rect>
        ))}
      </svg>

      <div className="mt-1 flex gap-4 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <svg width="18" height="6">
            <line x1="0" x2="18" y1="3" y2="3" stroke={estimated ? FORECAST : MEASURED} strokeWidth="2.5" strokeDasharray={estimated ? "5 4" : undefined} />
          </svg>
          {estimated ? t("지난 시간 (추정)") : t("실측")}
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="18" height="6">
            <line x1="0" x2="18" y1="3" y2="3" stroke={FORECAST} strokeWidth="2" strokeDasharray="5 4" />
          </svg>
          {t("AI 예측")}
        </span>
        <span className="ml-auto text-gray-400">{t("시간을 눌러 자세히")}</span>
      </div>
    </div>
  );
}
