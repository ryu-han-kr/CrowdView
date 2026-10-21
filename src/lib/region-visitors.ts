// 대표 명소의 시군구 방문객 (관광공사 데이터랩 '지역별 방문자 수', 외지인+외국인). 데이터랩은 한 달쯤 늦게 나와서
// 오늘·이번 주 값은 없고, 작년 같은 요일(364일 전) 값으로 "이맘때 얼마나 오는지"를 본다.
// 쓰는 곳: 명소 상세 '작년 이맘때 방문객' 막대, 관광공사 집중률이 없는 명소의 예측 보정 (signals.concentration 대신)
import spotRegionData from "@/data/korea/spot-region.json";
import { kv } from "./cache";
import { regionVisitorsOf, visitorsOn } from "./festivals";
import { addDays, kst } from "./time";

const SPOT_REGION = spotRegionData as Record<string, { code: string; name: string }>;

export const spotRegion = (spotId: string) => SPOT_REGION[spotId];

/** dates마다 작년 같은 요일(364일 전) 그 시군구 방문객. 데이터가 없는 날은 빠진다 */
export async function lastYearVisitors(code: string, dates: string[], name?: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const rows = await Promise.all(dates.map((d) => visitorsOn(addDays(d, -364)).catch(() => undefined)));
  rows.forEach((day, i) => {
    const v = day && regionVisitorsOf(day, code, name)?.visitors;
    if (v) out.set(dates[i], Math.round(v));
  });
  return out;
}

// ── 주말/평일 방문객 비 (10/21 실제 수치로 모델 고치기): 예측 모델은 주말을 평일의 1.6배로 두는데, 실제로는
// 관광지 시군구는 2~3배, 도심은 1.2배쯤으로 다르다. 작년 이맘때 6주 데이터랩 일별 방문객으로 시군구마다 다시 잰다.
// 하루 한 번 수집기가 전부 계산해 한 키에 두고(날짜별 호출은 30일 캐시라 매일 새로 부르는 건 1~2번), 명소 화면은 그 키만 읽는다
const RATIO_KEY = "weekratio";
const RATIO_KEEP = 3 * 86_400;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** 순수 계산: 주말 중앙값 / 평일 중앙값 (연휴가 섞여도 덜 흔들리게 중앙값). 표본이 적으면 undefined. 1 ~ 3 */
export function weekRatioFrom(days: { date: string; visitors: number }[]): number | undefined {
  const isWeekend = (d: string) => [0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay());
  const we = days.filter((d) => d.visitors > 0 && isWeekend(d.date)).map((d) => d.visitors);
  const wd = days.filter((d) => d.visitors > 0 && !isWeekend(d.date)).map((d) => d.visitors);
  if (we.length < 4 || wd.length < 10) return undefined;
  const r = median(we) / median(wd);
  return Math.round(Math.max(1, Math.min(3, r)) * 100) / 100;
}

/** 하루 한 번: 명소가 있는 시군구마다 주말/평일 비를 계산해 저장. 계산한 시군구 수 */
export async function updateWeekRatios(today = kst().date): Promise<number> {
  const regions = new Map(Object.values(SPOT_REGION).map((r) => [r.code, r.name]));
  // 작년 같은 요일 기준 오늘 3주 전 ~ 3주 뒤
  const dates = Array.from({ length: 42 }, (_, i) => addDays(today, i - 21 - 364));
  const days = await Promise.all(dates.map((d) => visitorsOn(d).catch(() => undefined)));
  const out: Record<string, number> = {};
  for (const [code, name] of regions) {
    const rows = dates.map((date, i) => ({ date, visitors: (days[i] && regionVisitorsOf(days[i]!, code, name)?.visitors) || 0 }));
    const r = weekRatioFrom(rows);
    if (r) out[code] = r;
  }
  if (Object.keys(out).length) await kv.set(RATIO_KEY, JSON.stringify(out), RATIO_KEEP);
  return Object.keys(out).length;
}

/** 시군구의 주말/평일 비 (없으면 undefined) */
export async function getWeekRatio(code: string): Promise<number | undefined> {
  const raw = await kv.get(RATIO_KEY).catch(() => null);
  return raw ? (JSON.parse(raw) as Record<string, number>)[code] : undefined;
}
