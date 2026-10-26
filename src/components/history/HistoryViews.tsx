// 지난 혼잡 기록 화면 조각 (사용자 10/26: 지난 날짜 데이터를 사이트에서도). 서버에서 그리는 순수 표시용
import type { Lang } from "@/i18n/config";
import type { T } from "@/i18n/translate";
import type { DailyRow } from "@/lib/archive-daily";
import { inkOf, levelOf } from "@/lib/levels";

const DOW_BASE = Date.UTC(2026, 0, 4); // 일요일
export const dowName = (w: number, lang: Lang) => new Intl.DateTimeFormat(lang, { weekday: "short", timeZone: "UTC" }).format(new Date(DOW_BASE + w * 86_400_000));
const dowOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const fmtNum = (n: number, lang: Lang) => n.toLocaleString(lang);

/** 칸 하나: 점수 → 단계 색 (자료 없음은 옅은 회색) */
function Cell({ score, title, className = "" }: { score: number; title?: string; className?: string }) {
  const bg = score < 0 ? "#f3f4f6" : levelOf(score).color;
  return <span title={title} className={`block rounded-[3px] ${className}`} style={{ background: bg, opacity: score < 0 ? 1 : 0.35 + (score / 100) * 0.65 }} />;
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
      <p className="mt-0.5 text-sm text-gray-600">{t("지금까지 쌓인 실제 기록의 평균이에요. 옅을수록 한산해요.")}</p>
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
    </section>
  );
}

/** 날마다 한 줄: 날짜 · 0~23시 띠 · 평균 단계 · 가장 붐빈 시각 · 사람 수 */
export function DailyTable({ rows, lang, t, unit }: { rows: DailyRow[]; lang: Lang; t: T; unit?: string }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-bold">{t("날짜별 기록")}</h2>
      <p className="mt-0.5 text-sm text-gray-600">{t("띠는 0시부터 23시까지 시간대별 평균이에요.")}</p>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-gray-100 bg-white">
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
              const pk = levelOf(r.max);
              return (
                <tr key={r.date} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-semibold">
                    {Number(r.date.slice(5, 7))}/{Number(r.date.slice(8, 10))} <span className="text-gray-500">({dowName(dowOf(r.date), lang)})</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="grid w-[168px] grid-cols-24 gap-px">
                      {(r.hourly ?? Array(24).fill(-1)).map((v, h) => (
                        <Cell key={h} score={v} title={`${h}:00`} className="h-4" />
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-semibold" style={{ color: inkOf(lv.color) }}>
                    {t(lv.label)}
                  </td>
                  <td className="px-3 py-2">
                    {r.maxAt} <span className="font-semibold" style={{ color: inkOf(pk.color) }}>{t(pk.label)}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.avgPeople != null ? (unit === "분" ? t("{n}분", { n: r.avgPeople }) : fmtNum(r.avgPeople, lang)) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
