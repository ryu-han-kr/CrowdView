"use client";

import { useId, useMemo, useRef, useState } from "react";
import { AreaChart } from "@/components/charts/area-chart";
import { Area } from "@/components/charts/area";
import { useChart } from "@/components/charts/chart-context";
import { useI18n } from "@/i18n/client";
import { levelOf, inkOf } from "@/lib/levels";
import { LevelGradients } from "@/components/HourlyChart";

const MARGIN = { top: 12, right: 12, bottom: 30, left: 12 };
const day = (date: string) => new Date(`${date}T00:00:00Z`);

/** 고른 날: 세로선 + 단계 색 점 */
function Selected({ date, value }: { date: string; value: number }) {
  const { xScale, yScale, innerHeight } = useChart();
  const x = xScale(day(date));
  const color = levelOf(value).color;
  return (
    <g pointerEvents="none">
      <line x1={x} x2={x} y1={0} y2={innerHeight} stroke={color} strokeOpacity="0.5" strokeWidth="2" />
      <circle cx={x} cy={yScale(value)} r="6" fill={color} stroke="#fff" strokeWidth="2.5" />
    </g>
  );
}
Selected.__isPostOverlay = true;

/** 아래 날짜 눈금 (일주일마다, 월/일) */
function DayAxis({ dates }: { dates: string[] }) {
  const { xScale, innerHeight } = useChart();
  return (
    <g pointerEvents="none">
      {dates.map((d, i) =>
        i % 7 === 0 ? (
          <text key={d} x={xScale(day(d))} y={innerHeight + 21} textAnchor={i === 0 ? "start" : "middle"} fontSize="13" fill="#6b7280">
            {`${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`}
          </text>
        ) : null,
      )}
    </g>
  );
}
DayAxis.__isPostOverlay = true;

/**
 * 앞으로 30일 날마다 붐빔 예측 (한국관광공사 관광지 집중률 0~100%). 누르거나 옆으로 밀면 그날 값.
 * days: 날짜순 [{ date: YYYY-MM-DD, value: 집중률 }]
 */
export function DailyForecastChart({ days, weekdays }: { days: { date: string; value: number }[]; weekdays: string[] }) {
  const { t } = useI18n();
  const top = days.reduce((m, d, i) => (d.value > days[m].value ? i : m), 0);
  const calm = days.reduce((m, d, i) => (d.value < days[m].value ? i : m), 0);
  const [sel, setSel] = useState(0);
  const gid = `dfc${useId().replace(/:/g, "")}`;
  const touch = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const data = useMemo(() => days.map((d) => ({ date: day(d.date), value: d.value })), [days]);
  if (days.length < 2) return null;

  const pick = (clientX: number) => {
    const el = touch.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const k = el.offsetWidth ? r.width / el.offsetWidth : 1;
    const f = (clientX - r.left - MARGIN.left * k) / (r.width - (MARGIN.left + MARGIN.right) * k);
    setSel(Math.max(0, Math.min(days.length - 1, Math.round(f * (days.length - 1)))));
  };
  const d = days[sel];
  const lv = levelOf(d.value);
  const label = (i: number) => `${Number(days[i].date.slice(5, 7))}/${Number(days[i].date.slice(8, 10))} (${weekdays[i]})`;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3" aria-live="polite">
        <div>
          <p className="text-sm text-gray-600">
            <b className="text-gray-900">{label(sel)}</b> · {t("관광공사 예측")}
          </p>
          <p className="mt-0.5 text-xl font-extrabold" style={{ color: inkOf(lv.color) }}>
            {t(lv.label)} <span className="text-lg font-bold text-gray-900">{Math.round(d.value)}%</span>
          </p>
        </div>
        <div className="shrink-0 text-right text-sm">
          <p className="text-emerald-600">
            {t("가장 한산")} <b>{label(calm)}</b>
          </p>
          <p className="text-red-600">
            {t("가장 붐빔")} <b>{label(top)}</b>
          </p>
        </div>
      </div>
      <div role="img" aria-label={t("앞으로 30일 붐빔 예측 그래프")} className="relative select-none">
        <AreaChart data={data} xDataKey="date" yMax={100} margin={MARGIN} aspectRatio="16 / 9" animationDuration={700}>
          <LevelGradients id={gid} />
          <Area dataKey="value" fill={`url(#${gid}-fill)`} stroke={`url(#${gid}-stroke)`} strokeWidth={3} />
          <DayAxis dates={days.map((x) => x.date)} />
          <Selected date={d.date} value={d.value} />
        </AreaChart>
        <div
          ref={touch}
          className="absolute inset-0 z-10 cursor-pointer"
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
        />
      </div>
    </div>
  );
}
