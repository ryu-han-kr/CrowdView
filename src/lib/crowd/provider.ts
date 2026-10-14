// 외부 혼잡도 데이터 소스.
// 서울시 실시간 도시데이터(citydata_ppltn)·공항 혼잡도가 있는 장소는 실데이터, 나머지는 모델값.
import type { CrowdSnapshot, Place } from "../types";
import { fetchAirport } from "./airport";
import { modelSnapshot } from "./model";
import { getSignals, type Signals } from "./signals";

// 서울시 4단계 → 0~100 점수 (5단계 기준 각 구간의 중앙 부근)
const SEOUL_LEVEL_SCORE: Record<string, number> = {
  여유: 25,
  보통: 48,
  "약간 붐빔": 68,
  붐빔: 88,
};

interface SeoulPpltn {
  AREA_CONGEST_LVL: string;
  AREA_PPLTN_MIN: string;
  AREA_PPLTN_MAX: string;
  PPLTN_TIME: string;
  FCST_PPLTN?: { FCST_TIME: string; FCST_CONGEST_LVL: string }[];
}

async function fetchSeoulCitydata(place: Place, key: string, s: Signals): Promise<CrowdSnapshot> {
  const url = `http://openapi.seoul.go.kr:8088/${key}/json/citydata_ppltn/1/5/${encodeURIComponent(place.seoulArea!)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000)});
  if (!res.ok) throw new Error(`seoul citydata ${res.status}`);
  const json = await res.json();
  const row: SeoulPpltn | undefined = json["SeoulRtd.citydata_ppltn"]?.[0];
  const score = row && SEOUL_LEVEL_SCORE[row.AREA_CONGEST_LVL];
  if (!row || score === undefined) throw new Error("seoul citydata: unexpected payload");

  // 시간대 곡선은 모델 곡선을 쓰고, 서울시 예측값이 있으면 덮어쓴다
  const base = modelSnapshot(place, new Date(), s);
  const hourly = base.hourly.map((p) => ({ ...p }));
  for (const f of row.FCST_PPLTN ?? []) {
    const h = Number(f.FCST_TIME.slice(11, 13));
    const point = hourly.find((p) => p.hour === h && p.forecast);
    const s = SEOUL_LEVEL_SCORE[f.FCST_CONGEST_LVL];
    if (point && s !== undefined) point.score = s;
  }
  const current = hourly.filter((p) => !p.forecast).at(-1);
  if (current) current.score = score;

  const headcount = Math.round((Number(row.AREA_PPLTN_MIN) + Number(row.AREA_PPLTN_MAX)) / 2);
  const headcountRange: [number, number] = [Number(row.AREA_PPLTN_MIN), Number(row.AREA_PPLTN_MAX)];
  return { ...base, score, open: true, headcount, headcountRange, hourly, source: "seoul-citydata", updatedAt: new Date().toISOString() };
}

export async function fetchSnapshot(place: Place): Promise<CrowdSnapshot> {
  const key = process.env.SEOUL_OPENAPI_KEY;
  // 날씨·공휴일·관광지 집중률·공항 승객 수로 예측 곡선을 보정한다
  const s = await getSignals(place);
  if (key && place.seoulArea) return fetchSeoulCitydata(place, key, s);
  if (process.env.DATA_GO_KR_KEY && place.airport) return fetchAirport(place, place.airport, s);
  return modelSnapshot(place, new Date(), s);
}
