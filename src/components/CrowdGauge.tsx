"use client";

import { useEffect, useState } from "react";
import { Gauge } from "@/components/charts/gauge";
import { useI18n } from "@/i18n/client";
import { levelOf } from "@/lib/levels";

/**
 * 지금 혼잡을 계기판(Bklit Gauge)으로: 눈금이 혼잡 지수만큼 차고, 초록 → 지금 단계 색으로 물든다.
 * 가운데 숫자는 혼잡 지수(0~100), 아래는 단계 이름
 */
export function CrowdGauge({ score, size = 132, closed = false }: { score: number; size?: number; closed?: boolean }) {
  const { t } = useI18n();
  const level = levelOf(score);
  // 눈금 좌표 계산(삼각함수)이 서버·브라우저에서 소수점 끝자리가 달라 하이드레이션 경고가 나서, 브라우저에서만 그린다
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size * 0.82 }} role="img" aria-label={`${t("혼잡 지수 {n}", { n: score })} · ${t(level.label)}`}>
      {mounted && (
        <Gauge
          value={closed ? 0 : score}
          totalNotches={24}
          useGradient
          activeGradient={["#10b981", level.color]}
          inactiveFill="var(--color-gray-200)"
          notchLengthPercent={38}
          width={size}
          height={size}
        />
      )}
      <div className="pointer-events-none absolute inset-x-0 top-[36%] flex flex-col items-center leading-none">
        <span className="text-[26px] font-extrabold tabular-nums" style={{ color: closed ? "#9ca3af" : level.color }}>
          {closed ? "–" : score}
        </span>
        <span className="mt-1 text-[11px] font-semibold text-gray-500">{t("혼잡 지수")}</span>
      </div>
    </div>
  );
}
