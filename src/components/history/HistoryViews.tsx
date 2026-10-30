// 지난 혼잡 기록 화면 조각 (사용자 10/26: 지난 날짜 데이터를 사이트에서도). 서버에서 그리는 순수 표시용
import type { Lang } from "@/i18n/config";
import type { T } from "@/i18n/translate";
import type { DailyRow } from "@/lib/archive-daily";
import { heatVar } from "@/lib/heat-palettes";
import { LEVELS, inkOf, levelOf } from "@/lib/levels";

const DOW_BASE = Date.UTC(2026, 0, 4); // 일요일
export const dowName = (w: number, lang: Lang) => new Intl.DateTimeFormat(lang, { weekday: "short", timeZone: "UTC" }).format(new Date(DOW_BASE + w * 86_400_000));
const dowOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const fmtNum = (n: number, lang: Lang) => n.toLocaleString(lang);

/** 칸 하나: 점수 → 단계 색 (설정에서 고른 히트맵 색, lib/heat-palettes). 자료 없음은 옅은 회색 */
function Cell({ score, title, className = "" }: { score: number; title?: string; className?: string }) {
  return <span title={title} className={`block rounded-[3px] ${className}`} style={{ background: heatVar(score) }} />;
}

/** 색 예시: 쾌적 ■■■■■ 매우 혼잡 (지인 QA 10/30: '옅을수록 한산'은 추상적이었다) */
export function HeatLegend({ t, className = "" }: { t: T; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 text-xs text-gray-600 ${className}`}>
      {t(LEVELS[0].label)}
      {LEVELS.map((l, i) => (
        <span key={l.key} title={t(l.label)} className="h-3 w-5 rounded" style={{ background: `var(--heat-${i})` }} />
      ))}
      {t(LEVELS[4].label)}
      <span className="ml-2 inline-flex items-center gap-1">
        <span className="h-3 w-3 rounded border border-gray-200" style={{ background: "var(--heat-none)" }} />
        {t("기록 없음")}
      </span>
    </div>
  );
}

/** 요일 × 시간 평균 (쌓인 날들로 본 '가기 좋은 시간') */
export function WeekdayHourHeatmap({ rows, lang, t }: { rows: DailyRow[]; lang: Lang; t: T }) {
  const sum = Array.from({ length: 7 }, () => Array(24).fill(0));
  const n = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const r of rows) {
    if (!r.hourly) continue;
    const w = dowOf(r.date);
    r.hourly.forEach((v, h) => {
      if (v >= 0) {
        sum[w][h] += v;
        n[w][h]++;
      }
    });
  }
  const hours = Array.from({ length: 24 }, (_, h) => h).filter((h) => n.some((row) => row[h] > 0));
  if (!hours.length) return null;
  const avg = (w: number, h: number) => (n[w][h] ? Math.round(sum[w][h] / n[w][h]) : -1);
  // 가장 한산한 요일·시간 (자료가 2일 이상인 칸만)
  let best: { w: number; h: number; s: number } | undefined;
  for (let w = 0; w < 7; w++) for (const h of hours) if (n[w][h] >= 2 && (!best || avg(w, h) < best.s)) best = { w, h, s: avg(w, h) };
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <section className="mt-6 rounded-3xl border border-gray-100 p-4">
      <h2 className="text-lg font-bold">{t("요일·시간대별 평균")}</h2>
      <p className="mt-0.5 text-sm text-gray-600">{t("지금까지 쌓인 실제 기록의 평균이에요.")}</p>
      {best && (
        <p className="mt-2 text-[15px] font-semibold">
          {t("가장 한산했던 때: {day} {hour}시쯤", { day: dowName(best.w, lang), hour: best.h })}{" "}
          <span style={{ color: inkOf(levelOf(best.s).color) }}>{t(levelOf(best.s).label)}</span>
        </p>
      )}
      <div className="mt-3 overflow-x-auto">
        <table className="border-separate border-spacing-[3px] text-[11px] text-gray-500">
          <thead>
            <tr>
              <th />
              {hours.map((h) => (
                <th key={h} className="w-5 font-medium">
                  {h % 3 === 0 ? h : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.map((w) => (
              <tr key={w}>
                <th className="pr-1 text-left font-semibold text-gray-700">{dowName(w, lang)}</th>
                {hours.map((h) => (
                  <td key={h}>
                    <Cell score={avg(w, h)} title={`${dowName(w, lang)} ${h}:00 · ${avg(w, h) < 0 ? "-" : t(levelOf(avg(w, h)).label)}`} className="h-5 w-5" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <HeatLegend t={t} className="mt-3" />
    </section>
  );
}

/**
 * 날마다 한 장: 날짜 · 0~23시 띠 · 하루 평균 · 가장 붐빈 시각 · 사람 수.
 * 접어 두고 '더보기'를 눌러야 펼친다 (경수님 10/30: 길면 아래 정보가 너무 내려간다). 휴대폰은 카드, PC는 표
 */
export function DailyTable({ rows, lang, t, unit }: { rows: DailyRow[]; lang: Lang; t: T; unit?: string }) {
  const ppl = (r: DailyRow) => (r.avgPeople != null ? (unit === "분" ? t("{n}분", { n: r.avgPeople }) : fmtNum(r.avgPeople, lang)) : "-");
  const date = (r: DailyRow) => (
    <>
      {Number(r.date.slice(5, 7))}/{Number(r.date.slice(8, 10))} <span className="text-gray-500">({dowName(dowOf(r.date), lang)})</span>
    </>
  );
  const strip = (r: DailyRow, cls: string) => (r.hourly ?? Array(24).fill(-1)).map((v, h) => <Cell key={h} score={v} title={`${h}:00`} className={cls} />);
  return (
    <section className="mt-6">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <h2 className="text-lg font-bold">{t("날짜별 기록")}</h2>
          <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700">
            <span className="group-open:hidden">{t("더보기 ({n}일)", { n: rows.length })} ▾</span>
            <span className="hidden group-open:inline">{t("접기")} ▴</span>
          </span>
        </summary>
        <HeatLegend t={t} className="mt-2" />

        {/* 휴대폰: 날짜마다 카드 (옆으로 밀던 표 대신) */}
        <ul className="mt-3 space-y-2.5 md:hidden">
          {rows.map((r) => {
            const lv = levelOf(r.avg);
            return (
              <li key={r.date} className="rounded-2xl border border-gray-100 bg-white px-3.5 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <b className="text-[15px]">{date(r)}</b>
                  <span className="text-[13px] text-gray-600">
                    {t("하루 평균")}{" "}
                    <b style={{ color: inkOf(lv.color) }}>{t(lv.label)}</b>
                  </span>
                </div>
                <span className="mt-2.5 grid grid-cols-24 gap-0.5">{strip(r, "h-4")}</span>
                <span className="relative mt-1 block h-3.5 text-[11px] text-gray-400">
                  {[0, 6, 12, 18].map((h) => (
                    <span key={h} className="absolute" style={{ left: `${(h / 24) * 100}%` }}>
                      {h}
                    </span>
                  ))}
                </span>
                <p className="mt-1.5 flex gap-3.5 text-[13px] text-gray-600">
                  <span>
                    {t("가장 붐빈 때")} <b className="text-gray-900">{r.maxAt || "-"}</b>
                  </span>
                  <span>
                    {unit === "분" ? t("평균 대기") : t("평균 인원")} <b className="text-gray-900">{ppl(r)}</b>
                  </span>
                </p>
              </li>
            );
          })}
        </ul>

        {/* PC: 표 (가장 붐빈 때는 시각만) */}
        <div className="mt-3 hidden overflow-x-auto rounded-2xl border border-gray-100 bg-white md:block">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">{t("날짜")}</th>
                <th className="px-3 py-2 text-left">{t("시간대별")}</th>
                <th className="px-3 py-2 text-left">{t("하루 평균")}</th>
                <th className="px-3 py-2 text-left">{t("가장 붐빈 때")}</th>
                <th className="px-3 py-2 text-right">{unit === "분" ? t("평균 대기") : t("평균 인원")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const lv = levelOf(r.avg);
                return (
                  <tr key={r.date} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-semibold">{date(r)}</td>
                    <td className="px-3 py-2">
                      <span className="grid w-[216px] grid-cols-24 gap-0.5">{strip(r, "h-4")}</span>
                    </td>
                    <td className="px-3 py-2 font-semibold" style={{ color: inkOf(lv.color) }}>
                      {t(lv.label)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{r.maxAt || "-"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{ppl(r)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
