"use client";

import { useRef, useState, type PointerEvent } from "react";
import { useI18n } from "@/i18n/client";
import { LEVELS, levelOf, tintInkOf } from "@/lib/levels";

export interface HeatDay {
  date: string;
  /** 줄 이름 (오늘·내일·목) */
  label: string;
  /** 운영 시간의 시간마다 예상 점수 (+ 예상 인원 문장) */
  hours: { hour: number; score: number; people?: string }[];
  /** 정기 휴무 */
  closed?: boolean;
}

interface Hot {
  key: string;
  x: number;
  y: number;
  /** 말풍선 기준점: 왼쪽 끝 칸은 왼쪽 맞춤, 오른쪽 끝 칸은 오른쪽 맞춤 (가로 스크롤 상자 밖으로 잘리지 않게) */
  align: "left" | "center" | "right";
  title: string;
  sub: string;
}

/**
 * 언제 가면 한산할까: 날(줄) × 2시간(칸) 표. 칸은 그 시간대 평균 단계의 색과 이름만 — 보자마자 초록 칸을 고르면 된다.
 * 사용자 10/26: 칸에 마우스를 올리거나 누르면 그 칸이 커지고 위에 날·시간·단계·인원 말풍선이 뜬다
 */
export function WeekHeatmap({ days, nowHour }: { days: HeatDay[]; nowHour: number }) {
  const { t } = useI18n();
  const wrap = useRef<HTMLDivElement>(null);
  const outer = useRef<HTMLDivElement>(null);
  const [hot, setHot] = useState<Hot | null>(null);
  const all = days.flatMap((d) => d.hours.map((h) => h.hour));
  if (!all.length) return null;
  const from = Math.min(...all);
  const to = Math.max(...all) + 1;
  // 2시간씩 묶은 칸. 운영 시간이 길면(12시간 넘게) 3시간씩 — 휴대폰 한 화면에 들어가게
  const BLOCK = to - from > 12 ? 3 : 2;
  const blocks = Array.from({ length: Math.ceil((to - from) / BLOCK) }, (_, i) => from + i * BLOCK);

  // 칸의 화면 위치 → 말풍선 자리. 말풍선은 가로 스크롤 상자 밖(바깥 상자)에 두어 상자 가장자리에 잘리지 않는다
  const show = (e: PointerEvent<HTMLTableCellElement>, key: string, title: string, sub: string, toggle = false) => {
    const o = outer.current;
    if (!o) return;
    if (toggle && hot?.key === key) return setHot(null);
    const r = e.currentTarget.getBoundingClientRect();
    const or = o.getBoundingClientRect();
    const cx = r.left - or.left + r.width / 2;
    const f = cx / or.width;
    setHot({ key, x: f < 0.3 ? r.left - or.left : f > 0.7 ? r.right - or.left : cx, y: r.top - or.top, align: f < 0.3 ? "left" : f > 0.7 ? "right" : "center", title, sub });
  };

  return (
    <div ref={outer} className="relative">
      {hot && (
        <div
          className="pointer-events-none absolute z-20 max-w-full rounded-xl px-3 py-1.5 text-xs leading-snug whitespace-nowrap shadow-lg"
          style={{
            left: hot.x,
            top: hot.y,
            transform: `translate(${hot.align === "left" ? "0" : hot.align === "right" ? "-100%" : "-50%"}, calc(-100% - 8px))`,
            background: "var(--chart-foreground)",
            color: "var(--chart-background)",
          }}
          role="status"
        >
          <b className="block text-[13px]">{hot.title}</b>
          {hot.sub}
        </div>
      )}
      <div ref={wrap} className="overflow-x-auto" onPointerLeave={() => setHot(null)}>
        <table className="w-full border-separate text-center" style={{ borderSpacing: 3 }}>
          <thead>
            <tr>
              <th />
              {blocks.map((b) => (
                <th key={b} className="px-0.5 pb-1 text-xs font-semibold whitespace-nowrap text-gray-500">
                  {b}~{Math.min(b + BLOCK, to)}
                  {t("시")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d, di) => (
              <tr key={d.date}>
                <th scope="row" className="pr-1.5 text-left text-sm font-semibold whitespace-nowrap text-gray-800">
                  {d.label}
                </th>
                {d.closed ? (
                  <td colSpan={blocks.length} className="rounded-lg bg-gray-100 py-2 text-xs text-gray-500">
                    {t("휴무")}
                  </td>
                ) : (
                  blocks.map((b) => {
                    const hs = d.hours.filter((h) => h.hour >= b && h.hour < b + BLOCK);
                    // 오늘 이미 지난 시간대는 흐리게
                    const past = di === 0 && b + BLOCK <= Math.floor(nowHour);
                    if (!hs.length) return <td key={b} className="rounded-lg bg-gray-50" />;
                    const l = levelOf(Math.round(hs.reduce((a, h) => a + h.score, 0) / hs.length));
                    const key = `${d.date}:${b}`;
                    const title = `${d.label} ${b}~${Math.min(b + BLOCK, to)}${t("시")} · ${t(l.label)}`;
                    const people = hs[Math.floor(hs.length / 2)].people;
                    const sub = past ? t("지난 시간") : people ? `${people} · ${t(l.desc)}` : t(l.desc);
                    const on = hot?.key === key;
                    return (
                      <td
                        key={b}
                        className={`cursor-pointer rounded-lg py-2 text-[11px] font-bold whitespace-nowrap transition-transform duration-150 ${on ? "relative z-10 scale-[1.28] shadow-md" : ""}`}
                        // 진한 단계 색을 칸마다 꽉 채우면 표가 무거워 보인다 (UI QA 10차) → 옅은 바탕 + 진한 글씨 (목록의 단계 알약과 같은 방식)
                        style={past ? { background: "#f3f4f6", color: "#4b5563" } : { background: `${l.color}${on ? "55" : "2b"}`, color: tintInkOf(l.color) }}
                        onPointerEnter={(e) => e.pointerType === "mouse" && show(e, key, title, sub)}
                        onPointerDown={(e) => show(e, key, title, sub, true)}
                      >
                        {t(l.label)}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
        {LEVELS.map((l) => (
          <span key={l.key} className="flex items-center gap-1">
            <span className="h-3 w-3 rounded" style={{ background: `${l.color}2b`, boxShadow: `inset 0 0 0 1.5px ${l.color}` }} />
            {t(l.label)}
          </span>
        ))}
        <span className="ml-auto text-gray-500">{t("칸을 눌러 자세히")}</span>
      </div>
    </div>
  );
}
