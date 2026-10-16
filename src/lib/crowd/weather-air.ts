// 4~10일 뒤 날씨(기상청 중기예보)와 대기질(에어코리아 실시간·초미세먼지 예보).
// 단기예보(3일, 1시간 단위)는 signals.ts에 있고, 여기는 그 뒤 기간과 미세먼지를 채운다.
import { dataGoKr } from "../datagokr";
import { addDays, kst } from "../time";
import type { Place } from "../types";

const HOUR = 3600;

export interface MidDay {
  popAm: number;
  popPm: number;
  wfAm: string;
  wfPm: string;
  min?: number;
  max?: number;
}

export interface AirNow {
  station: string;
  time: string;
  pm10?: number;
  pm25?: number;
  /** 1 좋음 · 2 보통 · 3 나쁨 · 4 매우나쁨 */
  pm25Grade?: number;
  pm10Grade?: number;
}

export const AIR_GRADE = ["", "좋음", "보통", "나쁨", "매우나쁨"] as const;

// 중기예보 발표: 06시·18시
function midTmFc(now = new Date()): string {
  const t = kst(now);
  const ymd = t.date.replaceAll("-", "");
  if (t.hour >= 18) return `${ymd}1800`;
  if (t.hour >= 6) return `${ymd}0600`;
  return `${addDays(t.date, -1).replaceAll("-", "")}1800`;
}

/** 4~10일 뒤 YYYY-MM-DD → 강수확률·날씨·기온 */
export async function getMidWeather(place: Place): Promise<Map<string, MidDay> | undefined> {
  if (!place.midRegion) return undefined;
  const tmFc = midTmFc();
  const params = (regId: string) => ({ regId, tmFc, dataType: "JSON", numOfRows: "10" });
  const [[land], [ta]] = await Promise.all([
    dataGoKr("/1360000/MidFcstInfoService/getMidLandFcst", params(place.midRegion.land), 6 * HOUR),
    dataGoKr("/1360000/MidFcstInfoService/getMidTa", params(place.midRegion.temp), 6 * HOUR),
  ]);
  if (!land) return undefined;
  // 발표일 기준 n일 뒤 (18시 발표는 다음 날 기준이 아니라 발표일 기준)
  const base = `${tmFc.slice(0, 4)}-${tmFc.slice(4, 6)}-${tmFc.slice(6, 8)}`;
  const map = new Map<string, MidDay>();
  for (let n = 4; n <= 10; n++) {
    const am = land[`rnSt${n}Am`] ?? land[`rnSt${n}`];
    if (am === undefined) continue;
    map.set(addDays(base, n), {
      popAm: Number(am),
      popPm: Number(land[`rnSt${n}Pm`] ?? am),
      wfAm: String(land[`wf${n}Am`] ?? land[`wf${n}`] ?? ""),
      wfPm: String(land[`wf${n}Pm`] ?? land[`wf${n}`] ?? ""),
      min: ta?.[`taMin${n}`] !== undefined ? Number(ta[`taMin${n}`]) : undefined,
      max: ta?.[`taMax${n}`] !== undefined ? Number(ta[`taMax${n}`]) : undefined,
    });
  }
  return map;
}

/** 가까운 측정소의 지금 미세먼지 */
export async function getAirNow(place: Place): Promise<AirNow | undefined> {
  if (!place.airStation) return undefined;
  const rows = await dataGoKr(
    "/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty",
    { sidoName: place.airStation.sido, returnType: "json", numOfRows: "200", ver: "1.0" },
    // 측정값은 1시간마다 바뀐다. 에어코리아는 하루 500건 한도라 1시간 캐시 (시도 5곳 × 24 = 120건)
    HOUR,
  );
  const r = rows.find((x) => x.stationName === place.airStation!.name);
  if (!r) return undefined;
  const num = (v: unknown) => (v === undefined || v === null || v === "-" || v === "" ? undefined : Number(v));
  return {
    station: String(r.stationName),
    time: String(r.dataTime ?? ""),
    pm10: num(r.pm10Value),
    pm25: num(r.pm25Value),
    pm25Grade: num(r.pm25Grade),
    pm10Grade: num(r.pm10Grade),
  };
}

const GRADE_WORD: Record<string, number> = { 좋음: 1, 보통: 2, 나쁨: 3, 매우나쁨: 4 };
// 예보 지역 이름 (에어코리아 informGrade의 "서울 : 보통" 표기)
const FORECAST_REGION: Record<string, string> = { 서울: "서울", 경기: "경기남부", 인천: "인천", 부산: "부산", 제주: "제주" };

/** 오늘·내일(·모레) YYYY-MM-DD → 초미세먼지 예보 등급 */
export async function getAirForecast(place: Place): Promise<Map<string, number> | undefined> {
  if (!place.airStation) return undefined;
  const region = FORECAST_REGION[place.airStation.sido] ?? place.airStation.sido;
  const rows = await dataGoKr(
    "/B552584/ArpltnInforInqireSvc/getMinuDustFrcstDspth",
    { searchDate: kst().date, InformCode: "PM25", returnType: "json", numOfRows: "20" },
    3 * HOUR,
  );
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.informCode !== "PM25" || !r.informData) continue;
    const m = String(r.informGrade ?? "").match(new RegExp(`${region}\\s*:\\s*(좋음|보통|나쁨|매우나쁨)`));
    if (m) map.set(String(r.informData), GRADE_WORD[m[1]]);
  }
  return map;
}
