// 외부 혼잡도 데이터 소스.
// 서울시 실시간 도시데이터(citydata_ppltn)·공항 혼잡도가 있는 장소는 실데이터, 나머지는 모델값.
import { APIS, beforeCall } from "../api-quota";
import type { CrowdSnapshot, Place } from "../types";
import { fetchAirport } from "./airport";
import { SEOUL_LEVEL_SCORE } from "../seoul-live";
import { modelSnapshot } from "./model";
import { fetchThemePark } from "./themeparks";
import { getSignals, type Signals } from "./signals";



interface SeoulPpltn {
  AREA_CONGEST_LVL: string;
  AREA_PPLTN_MIN: string;
  AREA_PPLTN_MAX: string;
  PPLTN_TIME: string;
  FCST_PPLTN?: { FCST_TIME: string; FCST_CONGEST_LVL: string; FCST_PPLTN_MIN?: string; FCST_PPLTN_MAX?: string }[];
}

async function fetchSeoulCitydata(place: Place, key: string, s: Signals): Promise<CrowdSnapshot> {
  await beforeCall(APIS.find((a) => a.id === "seoul-citydata"));
  const url = `http://openapi.seoul.go.kr:8088/${key}/json/citydata_ppltn/1/5/${encodeURIComponent(place.seoulArea!)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000)});
  if (!res.ok) throw new Error(`seoul citydata ${res.status}`);
  const json = await res.json();
  const row: SeoulPpltn | undefined = json["SeoulRtd.citydata_ppltn"]?.[0];
  if (!row || SEOUL_LEVEL_SCORE[row.AREA_CONGEST_LVL] === undefined) throw new Error("seoul citydata: unexpected payload");
  const headcountRange: [number, number] = [Number(row.AREA_PPLTN_MIN), Number(row.AREA_PPLTN_MAX)];
  const headcount = Math.round((headcountRange[0] + headcountRange[1]) / 2);
  // 단계는 서울시 공식 단계를 그대로 쓴다 (홈·목록·서울 실시간·장소 상세가 같은 시각에 같은 단계를 보이도록).
  // 장소별 인원 기준으로 다시 매기면 같은 곳이 화면마다 다른 단계로 보인다 (외부 검토 2026-10-17)
  const toScore = (_people: number, level: string) => SEOUL_LEVEL_SCORE[level];
  const score = toScore(headcount, row.AREA_CONGEST_LVL);

  // 시간대 곡선은 모델 곡선을 쓰고, 서울시 예측값이 있으면 덮어쓴다
  const base = modelSnapshot(place, new Date(), s);
  const hourly = base.hourly.map((p) => ({ ...p }));
  // 서울시 12시간 예측(인원 범위)이 있으면 그 시간은 공식 예보로 덮어쓴다
  for (const f of row.FCST_PPLTN ?? []) {
    const h = Number(f.FCST_TIME.slice(11, 13));
    const point = hourly.find((p) => p.hour === h && p.forecast);
    if (!point || SEOUL_LEVEL_SCORE[f.FCST_CONGEST_LVL] === undefined) continue;
    const people = f.FCST_PPLTN_MIN ? Math.round((Number(f.FCST_PPLTN_MIN) + Number(f.FCST_PPLTN_MAX ?? f.FCST_PPLTN_MIN)) / 2) : undefined;
    point.score = toScore(people ?? 0, f.FCST_CONGEST_LVL);
    if (people !== undefined) Object.assign(point, { people, peopleKind: "real" });
  }
  const current = hourly.filter((p) => !p.forecast).at(-1);
  if (current) Object.assign(current, { score, people: headcount, peopleKind: "real" });
  // 영업시간·휴무일은 장소 기준 (서울시 인구는 주변 지역 단위라 문을 닫아도 값이 나온다)
  return {
    ...base,
    score,
    open: base.open,
    headcount,
    headcountRange,
    officialLevel: row.AREA_CONGEST_LVL,
    hourly,
    source: "seoul-citydata",
    updatedAt: new Date().toISOString(),
  };
}

export async function fetchSnapshot(place: Place): Promise<CrowdSnapshot> {
  const key = process.env.SEOUL_OPENAPI_KEY;
  // 날씨·공휴일·관광지 집중률·공항 승객 수로 예측 곡선을 보정한다
  const s = await getSignals(place);
  if (key && place.seoulArea) return fetchSeoulCitydata(place, key, s);
  if (place.themeparksId) return fetchThemePark(place, s);
  if (process.env.DATA_GO_KR_KEY && place.airport) return fetchAirport(place, place.airport, s);
  return modelSnapshot(place, new Date(), s);
}
