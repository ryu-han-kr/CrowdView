// 외부 혼잡도 데이터 소스.
// 서울시 실시간 도시데이터(citydata_ppltn)·공항 혼잡도가 있는 장소는 실데이터, 나머지는 모델값.
import type { CrowdSnapshot, Place } from "../types";
import { fetchAirport } from "./airport";
import { SEOUL_AREAS } from "../seoul-areas";
import { SEOUL_LEVEL_SCORE, getAllSeoulLive } from "../seoul-live";
import { modelSnapshot } from "./model";
import { fetchThemePark } from "./themeparks";
import { fixtureMode } from "../fixtures";
import { updateBaseline } from "./baseline";
import { valueFromScore, type LevelSteps } from "../levels";
import { getSignals, type Signals } from "./signals";

/**
 * 지역 실측 인구 → 명소 기준 인원. 서울시 인구는 주변 지역 전체(롯데월드면 잠실 관광특구 6만 명대)라
 * 장소 수용 인원 ÷ 그 지역이 '매우 붐빔'일 때 인원(기준 마지막 단계)을 비율로 곱한다. 행사는 지역이 곧 행사장이라 그대로
 */
export function siteShare(place: Place): number {
  const top = place.criteria?.unit === "명" ? place.criteria.steps[3] : undefined;
  if (place.category === "event" || !top) return 1;
  return Math.min(1, place.capacity / top);
}

/**
 * 서울시 실시간 도시데이터가 있는 장소: 서울 121곳 묶음(lib/seoul-live, 10분 캐시)에서 그 지역 값을 그대로 쓴다.
 * 장소 화면·서울 실시간 화면·홈이 같은 관측 시각의 같은 공식 단계를 보이게 (따로 부르면 시각이 달라 단계가 갈린다)
 */
async function fetchSeoulCitydata(place: Place, s: Signals): Promise<CrowdSnapshot> {
  const area = SEOUL_AREAS.find((a) => a.name === place.seoulArea);
  const row = area && (await getAllSeoulLive())[area.code];
  if (!row || SEOUL_LEVEL_SCORE[row.level] === undefined) throw new Error(`seoul citydata: ${place.seoulArea} 없음`);
  const headcountRange: [number, number] = [row.min, row.max];
  const share = siteShare(place);
  // 평소 이 요일·시간 대비 지금 지역 인구 (2주 넘게 쌓인 뒤부터 값이 나온다)
  const vsUsual = await updateBaseline(place.id, (row.min + row.max) / 2).catch(() => undefined);
  const base = modelSnapshot(place, new Date(), s);
  // 지역 안의 한 시설(롯데월드 ⊂ 잠실 관광특구): 지역 단계·인원을 그대로 쓰면 크게 부풀려진다 (지역 10만 명 > 시설 정원 3.5만).
  // → 시설의 평소 하루(예측 모델: 요일·시간·날씨·관광공사 집중률) × 오늘 지역이 평소보다 붐비는 정도. 인원은 시설 정원 기준으로 환산
  const inArea = share < 1;
  const siteSteps: LevelSteps = [0.2, 0.4, 0.6, 0.8].map((r) => Math.round(place.capacity * r)) as LevelSteps;
  const score = inArea ? Math.max(0, Math.min(100, Math.round(base.score * (vsUsual ?? 1)))) : row.score;
  const site = (n: number) => (inArea ? Math.min(place.capacity, Math.round((n * share) / 100) * 100) : n);
  const headcount = inArea ? Math.round(valueFromScore(score, siteSteps) / 100) * 100 : Math.round((row.min + row.max) / 2);
  const peopleKind = inArea ? "est" : "real";

  // 시간대 곡선은 모델 곡선을 쓰고, 서울시 12시간 예측이 있는 시간은 공식 예보로 덮어쓴다 (지역 안 시설은 모델 곡선 그대로)
  const hourly = base.hourly.map((p) => ({ ...p }));
  for (const f of inArea ? [] : row.forecast) {
    const h = Number(f.time.slice(11, 13));
    const point = hourly.find((p) => p.hour === h && p.forecast);
    if (!point) continue;
    point.score = f.score;
    Object.assign(point, { people: site(Math.round((f.min + f.max) / 2)), peopleKind });
  }
  const current = hourly.filter((p) => !p.forecast).at(-1);
  if (current) Object.assign(current, { score, people: headcount, peopleKind });
  // 영업시간·휴무일은 장소 기준 (서울시 인구는 주변 지역 단위라 문을 닫아도 값이 나온다)
  return {
    ...base,
    score,
    open: base.open,
    headcount,
    ...(share === 1 ? { headcountRange } : { area: { name: area.name, range: headcountRange } }),
    ...(vsUsual !== undefined && { vsUsual }),
    // 지역 안 시설은 지역의 공식 단계를 시설 단계처럼 보이지 않게 뺀다
    ...(!inArea && { officialLevel: row.level }),
    observedAt: row.time,
    hourly,
    source: "seoul-citydata",
    updatedAt: new Date().toISOString(),
  };
}

export async function fetchSnapshot(place: Place): Promise<CrowdSnapshot> {
  // 고정 자료 모드(시험)에서는 키 없이도 서울시·공항 자리에 시험 자료를 쓴다
  const key = process.env.SEOUL_OPENAPI_KEY ?? fixtureMode();
  // 날씨·공휴일·관광지 집중률·공항 승객 수로 예측 곡선을 보정한다
  const s = await getSignals(place);
  if (key && place.seoulArea) return fetchSeoulCitydata(place, s);
  if (place.themeparksId) return fetchThemePark(place, s);
  if ((process.env.DATA_GO_KR_KEY || fixtureMode()) && place.airport) return fetchAirport(place, place.airport, s);
  return modelSnapshot(place, new Date(), s);
}
