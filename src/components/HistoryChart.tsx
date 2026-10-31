"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { HistoryPoint } from "@/lib/crowd/history";
import { useI18n } from "@/i18n/client";
import { fmtMinutes, trZone } from "@/i18n/patterns";
import { LEVELS, levelOf } from "@/lib/levels";
import { textWidth } from "@/components/HourlyChart";

const KST = 9 * 3_600_000;
const HOUR = 3_600_000;
const hhmm = (ms: number) => new Date(ms + KST).toISOString().slice(11, 16);
const kstDate = (ms: number) => new Date(ms + KST).toISOString().slice(0, 10);
const md = (ms: number) => {
  const d = new Date(ms + KST);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};

/** 막대 하나가 묶는 시간 (24시간을 나눠떨어지게). 막대가 32개를 넘지 않게 고른다 */
const BUCKET_HOURS = [1, 2, 3, 4, 6, 8, 12, 24];
const MAX_BARS = 32;
/** '혼잡' 단계 시작 점수: 이 위로 올라간 막대만 단계 색으로 칠한다 (나머지는 차분한 한 가지 색) */
const BUSY = LEVELS[3].min;
/** 막대 색: 위는 진하게, 바닥 쪽은 옅게 (같은 색 계열 세로 그라데이션). 다크 모드에서도 그대로 읽힌다 */
const BAR_FILLS = [
  { key: "calm", top: "#6366f1", bottom: "#a5b4fc" },
  { key: "busy", top: LEVELS[3].color, bottom: "#fdba74" },
  { key: "very", top: LEVELS[4].color, bottom: "#fca5a5" },
] as const;
const fillKey = (score: number) => (score >= LEVELS[4].min ? "very" : score >= BUSY ? "busy" : "calm");

// 그래프 크기: 위는 말풍선 자리, 오른쪽은 '혼잡' 기준선 이름, 아래는 시간 눈금
const H = 188;
const M = { top: 30, right: 34, bottom: 28, left: 2 };
const PLOT_H = H - M.top - M.bottom;
const BASE = M.top + PLOT_H;

type Val = { score: number; wait: number | null };
type Bucket = { t0: number; t1: number; peak: (Val & { t: number }) | null };

/** 위쪽만 둥근 막대 (아래는 바닥선에 붙는다) */
const barPath = (x: number, w: number, h: number, r: number) => {
  const rr = Math.min(r, h, w / 2);
  const top = BASE - h;
  return `M${x},${BASE}V${top + rr}A${rr},${rr} 0 0 1 ${x + rr},${top}H${x + w - rr}A${rr},${rr} 0 0 1 ${x + w},${top + rr}V${BASE}Z`;
};

/**
 * 어제 0시부터 지금까지 실측 혼잡도 추이. 구역(출국장·보안검색 구간)을 골라 볼 수 있다.
 * 지인 QA 11/1('막대가 135개라 눈 아프다'): 받은 기록을 한 시간(길면 2시간…) 막대로 묶어 그 사이 가장 붐빈 값을 보여 준다.
 * 막대는 차분한 한 가지 색, '혼잡' 이상만 단계 색 (iOS 건강 앱 소음 그래프처럼 기준선 위만 강조).
 * 휴대폰: 누르거나 옆으로 밀면 그 시간 말풍선이 뜬다 (세로로 밀면 화면 스크롤, HourlyChart와 같은 방식)
 */
export function HistoryChart({
  days,
  zoneLabels,
  now,
}: {
  days: { date: string; points: HistoryPoint[] }[];
  zoneLabels: Record<string, string>;
  /** 서버 렌더 시각 (hydration 불일치 방지) */
  now: number;
}) {
  const { t } = useI18n();
  const [zone, setZone] = useState("전체");
  const [sel, setSel] = useState<number | null>(null);
  const [width, setWidth] = useState(340);
  const box = useRef<HTMLDivElement>(null);
  const touch = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const gid = `hist${useId().replace(/:/g, "")}`;
  const points = days.flatMap((d) => d.points);
  const hasPoints = points.length > 0;

  // 그래프 폭은 화면에 맞춰 잰다 (글자가 늘어나지 않게 viewBox로 늘리지 않는다)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasPoints]);

  const start = days.length ? Date.parse(`${days[0].date}T00:00:00+09:00`) : now;
  const series = useMemo(() => {
    const pick = (p: HistoryPoint): Val | null => {
      if (zone === "전체") return { score: p.score, wait: null };
      const z = p.zones?.find((x) => x[0] === zone);
      return z ? { score: z[1], wait: z[2] } : null;
    };
    return points.flatMap((p) => {
      const v = pick(p);
      return v ? [{ t: Date.parse(p.t), ...v }] : [];
    });
    // points는 days에서 매번 새로 만들어지므로 days로 묶는다
  }, [days, zone]);

  const spanH = Math.max(1, Math.ceil((now - start) / HOUR));
  const bucketH = BUCKET_HOURS.find((b) => spanH / b <= MAX_BARS) ?? 24;
  const n = Math.max(1, Math.ceil(spanH / bucketH));
  const buckets = useMemo(() => {
    const out: Bucket[] = Array.from({ length: n }, (_, i) => ({
      t0: start + i * bucketH * HOUR,
      t1: start + (i + 1) * bucketH * HOUR,
      peak: null,
    }));
    for (const p of series) {
      const i = Math.min(n - 1, Math.max(0, Math.floor((p.t - start) / (bucketH * HOUR))));
      const b = out[i];
      if (!b.peak || p.score >= b.peak.score) b.peak = p;
    }
    return out;
  }, [series, n, start, bucketH]);

  if (!hasPoints) {
    return (
      <p className="empty-note">
        {t("아직 쌓인 기록이 없어요. 실시간 데이터를 받을 때마다 기록이 쌓이고, 어제부터 지금까지의 추이를 여기서 볼 수 있어요.")}
      </p>
    );
  }

  const last = series.at(-1);
  const peak = series.reduce<(typeof series)[number] | undefined>((a, b) => (!a || b.score > a.score ? b : a), undefined);
  const today = kstDate(now);
  const when = (ms: number) => (kstDate(ms) === today ? hhmm(ms) : `${md(ms)} ${hhmm(ms)}`);

  const plotW = width - M.left - M.right;
  const pitch = plotW / n;
  const bw = Math.max(3, Math.min(16, pitch * 0.64));
  const radius = Math.min(bw / 2, 4);
  const xOf = (i: number) => M.left + i * pitch + pitch / 2;
  const yOf = (score: number) => BASE - (Math.max(0, Math.min(100, score)) / 100) * PLOT_H;
  const hOf = (score: number) => Math.max(4, BASE - yOf(score));
  const peakIdx = peak ? buckets.findIndex((b) => b.peak === peak) : -1;

  // 손가락·마우스 위치 → 가장 가까운 기록 있는 막대
  const pickAt = (clientX: number) => {
    const el = touch.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // 글자 크기 설정(zoom)으로 화면 좌표와 CSS 크기가 다를 수 있어 여백도 같은 비율로
    const k = el.offsetWidth ? r.width / el.offsetWidth : 1;
    const f = (clientX - r.left - M.left * k) / (plotW * k);
    const want = Math.max(0, Math.min(n - 1, Math.floor(f * n)));
    let best = -1;
    buckets.forEach((b, i) => {
      if (b.peak && (best < 0 || Math.abs(i - want) < Math.abs(best - want))) best = i;
    });
    if (best >= 0) setSel(best);
  };

  // 시간 눈금: 6시간마다 (막대가 굵어지면 12·24시간), 자정은 날짜. '지금' 알약과 겹치는 눈금은 뺀다
  const tickStep = bucketH <= 2 ? 6 : bucketH <= 4 ? 12 : 24;
  const nowW = Math.max(36, textWidth(t("지금")) + 14);
  const nowX = Math.max(M.left + nowW / 2, Math.min(width - nowW / 2, xOf(n - 1)));
  const ticks = Array.from({ length: Math.floor((n * bucketH) / tickStep) + 1 }, (_, k) => k * tickStep)
    .map((h) => ({ h, x: M.left + (h / (n * bucketH)) * plotW, ms: start + h * HOUR }))
    .filter((tk) => Math.abs(tk.x - nowX) > nowW / 2 + 12 && tk.x < width - M.right + 2);

  const selB = sel !== null ? buckets[sel] : null;
  const tip = (() => {
    if (!selB?.peak || sel === null) return null;
    const lv = levelOf(selB.peak.score);
    // 막대가 덮는 시간 (마지막 막대는 지금까지). 자정에 끝나면 24:00
    const end = Math.min(selB.t1, now);
    const endText = end < selB.t1 ? t("지금") : hhmm(end) === "00:00" ? "24:00" : hhmm(end);
    const time = `${kstDate(selB.t0) === today ? "" : `${md(selB.t0)} `}${hhmm(selB.t0)}–${endText}`;
    const rest = `${t(lv.label)}${selB.peak.wait !== null ? ` · ${t("대기")} ${fmtMinutes(selB.peak.wait, t)}` : ""}`;
    const tw = textWidth(time);
    const rw = textWidth(rest);
    const pad = 11;
    const w = pad + tw + 7 + 8 + 5 + rw + pad;
    const x = xOf(sel);
    const left = Math.max(0, Math.min(width - w, x - w / 2));
    return { lv, time, rest, tw, w, left, x, pad };
  })();

  const label = (z: string) => (z === "전체" ? t("전체") : trZone(zoneLabels[z], t));

  return (
    <div>
      {Object.keys(zoneLabels).length > 0 && (
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {["전체", ...Object.keys(zoneLabels)].map((z) => (
            <button
              key={z}
              onClick={() => {
                setZone(z);
                setSel(null);
              }}
              aria-pressed={z === zone}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${
                z === zone ? "bg-gray-900 font-semibold text-white" : "bg-gray-100 font-medium text-gray-600"
              }`}
            >
              {label(z)}
            </button>
          ))}
        </div>
      )}

      {/* 요약 두 칸: 마지막 기록 · 가장 붐빌 때 (긴 문장 대신 iOS 건강 앱처럼 이름·값·시각) */}
      {last && peak && (
        <div className="mt-4 grid grid-cols-2 gap-2.5 tabular-nums">
          {[
            { k: "마지막 기록", v: last, sub: `${when(last.t)}${last.wait !== null ? ` · ${t("대기")} ${fmtMinutes(last.wait, t)}` : ""}` },
            { k: "최고", v: peak, sub: `${when(peak.t)}${peak.wait !== null ? ` · ${t("대기")} ${fmtMinutes(peak.wait, t)}` : ""}` },
          ].map(({ k, v, sub }) => {
            const lv = levelOf(v.score);
            return (
              <div key={k} className="rounded-2xl bg-gray-50 px-3.5 py-3">
                <p className="text-xs font-medium text-gray-500">{t(k)}</p>
                <p className="mt-1 flex items-center gap-1.5 text-lg leading-tight font-bold text-gray-900">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: lv.color }} aria-hidden />
                  {t(lv.label)}
                </p>
                <p className="mt-0.5 truncate text-xs text-gray-500">{sub}</p>
              </div>
            );
          })}
        </div>
      )}

      <div ref={box} role="img" aria-label={t("혼잡도 기록 그래프")} className="relative mt-4 select-none">
        <svg width={width} height={H} className="block overflow-visible tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
          <defs>
            {BAR_FILLS.map((f) => (
              <linearGradient key={f.key} id={`${gid}-${f.key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={f.top} />
                <stop offset="1" stopColor={f.bottom} />
              </linearGradient>
            ))}
          </defs>
          {/* 가로 기준선: 단계 경계마다 아주 옅게, '혼잡' 경계만 점선 + 이름 */}
          {[20, 40, 80].map((s) => (
            <line key={s} x1={M.left} x2={width - M.right + 4} y1={yOf(s)} y2={yOf(s)} className="stroke-gray-100" strokeWidth="1" />
          ))}
          <line x1={M.left} x2={width - M.right + 4} y1={yOf(BUSY)} y2={yOf(BUSY)} stroke={LEVELS[3].color} strokeOpacity="0.55" strokeDasharray="3 3" strokeWidth="1" />
          <text x={width - M.right + 8} y={yOf(BUSY) + 4} fontSize="11" fontWeight="600" className="fill-orange-700">
            {t(LEVELS[3].label)}
          </text>

          {/* 날짜가 바뀌는 자정: 옅은 세로선 */}
          {ticks
            .filter((tk) => tk.h > 0 && tk.h % 24 === 0)
            .map((tk) => (
              <line key={`d${tk.h}`} x1={tk.x} x2={tk.x} y1={yOf(90)} y2={BASE} className="stroke-gray-200" strokeDasharray="2 3" strokeWidth="1" />
            ))}

          {/* 막대 */}
          <g>
            {buckets.map((b, i) =>
              b.peak ? (
                <path
                  key={`${zone}-${i}`}
                  d={barPath(xOf(i) - bw / 2, bw, hOf(b.peak.score), radius)}
                  className="hist-bar"
                  fill={`url(#${gid}-${fillKey(b.peak.score)})`}
                  opacity={sel === null || sel === i ? 1 : 0.32}
                  style={{ animationDelay: `${Math.min(i, 40) * 12}ms` }}
                />
              ) : null,
            )}
          </g>
          <line x1={M.left} x2={width - M.right + 4} y1={BASE + 0.5} y2={BASE + 0.5} className="stroke-gray-200" strokeWidth="1" />

          {/* 가장 붐빈 막대 위 작은 이름 (말풍선이 뜨면 숨긴다) */}
          {sel === null && peakIdx >= 0 && peak && (
            <text x={xOf(peakIdx)} y={BASE - hOf(peak.score) - 7} textAnchor="middle" fontSize="11" fontWeight="600" className="fill-gray-500">
              {t("최고")}
            </text>
          )}

          {/* 시간 눈금 */}
          {ticks.map((tk) => {
            const isDay = tk.h % 24 === 0;
            const anchor = tk.x < M.left + 14 ? "start" : "middle";
            return (
              <text
                key={tk.h}
                x={tk.x}
                y={BASE + 19}
                textAnchor={anchor}
                fontSize="12"
                fontWeight={isDay ? 600 : 500}
                className={isDay ? "fill-gray-700" : "fill-gray-400"}
              >
                {isDay ? md(tk.ms) : String((tk.h % 24) as number)}
              </text>
            );
          })}

          {/* '지금' 알약 (차트 색 변수라 다크 모드에서 밝은 알약 + 어두운 글씨로 뒤집힌다) */}
          <g>
            <rect x={nowX - nowW / 2} y={BASE + 6} width={nowW} height="19" rx="9.5" fill="var(--chart-foreground)" />
            <text x={nowX} y={BASE + 19.5} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="var(--chart-background)">
              {t("지금")}
            </text>
          </g>

          {/* 고른 막대: 가는 세로선 + 위 말풍선 (시각 · 단계 · 대기) */}
          {tip && selB?.peak && (
            <g pointerEvents="none">
              <line x1={tip.x} x2={tip.x} y1={28} y2={Math.max(28, BASE - hOf(selB.peak.score) - 3)} className="stroke-gray-300" strokeWidth="1.5" />
              <g transform={`translate(${tip.left}, 2)`} className="hist-tip">
                <rect width={tip.w} height="26" rx="13" fill="var(--chart-foreground)" />
                <text x={tip.pad} y="17.5" fontSize="12" fontWeight="700" fill="var(--chart-background)">
                  {tip.time}
                </text>
                <circle cx={tip.pad + tip.tw + 7 + 4} cy="13" r="4" fill={tip.lv.color} stroke="var(--chart-foreground)" strokeWidth="1" />
                <text x={tip.pad + tip.tw + 7 + 8 + 5} y="17.5" fontSize="12" fontWeight="500" fill="var(--chart-background)">
                  {tip.rest}
                </text>
              </g>
            </g>
          )}
        </svg>

        {/* 누르기·밀기 영역: 가로로 밀면 시간이 바뀌고, 세로로 밀면 화면이 스크롤된다 */}
        <div
          ref={touch}
          data-hist-touch=""
          className="absolute inset-0 z-10 cursor-pointer"
          style={{ touchAction: "pan-y" }}
          // 누르는 순간엔 고르지 않는다: 세로로 밀어 스크롤하면 브라우저가 pointercancel을 보내 그대로 둔다
          onPointerDown={(e) => {
            dragging.current = true;
            if (e.pointerType === "mouse") pickAt(e.clientX);
          }}
          onPointerMove={(e) => (dragging.current || e.pointerType === "mouse") && pickAt(e.clientX)}
          onPointerUp={(e) => {
            if (dragging.current) pickAt(e.clientX);
            dragging.current = false;
          }}
          onPointerCancel={() => (dragging.current = false)}
          onPointerLeave={(e) => {
            dragging.current = false;
            if (e.pointerType === "mouse") setSel(null);
          }}
        />
      </div>

      <div className="mt-2 flex justify-between text-xs text-gray-500 tabular-nums">
        <span>{t("기록 {n}건", { n: series.length })}</span>
        <span>{t("시간을 눌러 자세히")}</span>
      </div>
    </div>
  );
}
