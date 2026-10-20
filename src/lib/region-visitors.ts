// 대표 명소의 시군구 방문객 (관광공사 데이터랩 '지역별 방문자 수', 외지인+외국인). 데이터랩은 한 달쯤 늦게 나와서
// 오늘·이번 주 값은 없고, 작년 같은 요일(364일 전) 값으로 "이맘때 얼마나 오는지"를 본다.
// 쓰는 곳: 명소 상세 '작년 이맘때 방문객' 막대, 관광공사 집중률이 없는 명소의 예측 보정 (signals.concentration 대신)
import spotRegionData from "@/data/korea/spot-region.json";
import { regionVisitorsOf, visitorsOn } from "./festivals";
import { addDays } from "./time";

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
