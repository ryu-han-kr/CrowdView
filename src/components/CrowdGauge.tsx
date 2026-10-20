"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { LEVELS, levelOf } from "@/lib/levels";

// 좌표는 소수 둘째 자리까지 (서버·브라우저 삼각함수 끝자리 차이로 하이드레이션 경고가 나지 않게)
const r2 = (n: number) => Math.round(n * 100) / 100;
/** 반원 위의 점: 0점 = 왼쪽 끝, 100점 = 오른쪽 끝 */
const at = (cx: number, cy: number, r: number, score: number) => {
  const a = Math.PI * (1 - score / 100);
  return { x: r2(cx + r * Math.cos(a)), y: r2(cy - r * Math.sin(a)) };
};
const arc = (cx: number, cy: number, r: number, from: number, to: number) => {
  const p = at(cx, cy, r, from);
  const q = at(cx, cy, r, to);
  return `M ${p.x} ${p.y} A ${r} ${r} 0 0 1 ${q.x} ${q.y}`;
};

/**
 * 반원 계기판: 단계 다섯 칸(쾌적~매우 혼잡)을 색으로 깔고, 지금 혼잡 지수까지 진하게 채운 뒤 바늘로 가리킨다.
 * 처음 열 때 바늘이 0에서 지금 값까지 움직인다
 */
export function CrowdGauge({ score, size = 132, closed = false }: { score: number; size?: number; closed?: boolean }) {
  const { t } = useI18n();
  const level = levelOf(score);
  const value = closed ? 0 : Math.max(0, Math.min(100, score));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);

  const stroke = Math.round(size * 0.12);
  const r = size / 2 - stroke / 2 - 2;
  const cx = size / 2;
  const cy = r + stroke / 2 + 2;
  const height = cy + Math.round(size * 0.34);
  const gap = 1.2; // 칸 사이 틈 (점수 단위)

  return (
    <div className="relative shrink-0" style={{ width: size, height }} role="img" aria-label={`${t("혼잡 지수 {n}", { n: score })} · ${t(level.label)}`}>
      <svg width={size} height={height} viewBox={`0 0 ${size} ${height}`} aria-hidden>
        {LEVELS.map((l, i) => {
          const from = l.min + (i ? gap : 0);
          const to = (LEVELS[i + 1]?.min ?? 100) - (i < LEVELS.length - 1 ? gap : 0);
          const filledTo = Math.min(to, value);
          return (
            <g key={l.key}>
              {/* 바탕 칸: 단계 색 옅게 */}
              <path d={arc(cx, cy, r, from, to)} stroke={l.color} strokeOpacity={0.18} strokeWidth={stroke} fill="none" strokeLinecap="butt" />
              {/* 지금 값까지 진하게 */}
              {!closed && filledTo > from && (
                <path d={arc(cx, cy, r, from, filledTo)} stroke={l.color} strokeWidth={stroke} fill="none" strokeLinecap="butt" />
              )}
            </g>
          );
        })}
        {/* 바늘: 가운데에서 지금 값 쪽으로 (CSS 회전으로 부드럽게) */}
        {!closed && (
          <g style={{ transform: `rotate(${r2(-90 + shown * 1.8)}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: "transform 900ms cubic-bezier(.22,1,.36,1)" }}>
            <path d={`M ${r2(cx - 3)} ${cy} L ${cx} ${r2(cy - r + stroke * 0.2)} L ${r2(cx + 3)} ${cy} Z`} fill="#111827" />
          </g>
        )}
        <circle cx={cx} cy={cy} r={Math.round(size * 0.05)} fill={closed ? "#9ca3af" : "#111827"} />
        <circle cx={cx} cy={cy} r={Math.round(size * 0.022)} fill="#fff" />
      </svg>
      {/* 가운데 아래: 숫자 대신 단계 이름 (점수보다 단계로 읽게) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center leading-none">
        <span className="text-base font-extrabold whitespace-nowrap" style={{ color: closed ? "#9ca3af" : level.color }}>
          {closed ? t("운영 종료") : t(level.label)}
        </span>
      </div>
    </div>
  );
}
