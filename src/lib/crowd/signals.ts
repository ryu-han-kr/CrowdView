// 예측 모델에 넣는 외부 신호. 전부 공공데이터포털(DATA_GO_KR_KEY)에서 가져오고, 하나가 실패해도 나머지로 예측한다.
// - 공휴일: 한국천문연구원 특일 정보 (getRestDeInfo)
// - 날씨: 기상청 단기예보 (3일, 1시간 단위 기온·강수확률·강수형태)
// - 관광지 집중률: 한국관광공사 관광지 집중률 방문자 추이 예측 (30일)
// - 공항 승객: 한국공항공사 시간대별 탑승객 수, 인천공항 승객예고
import { dataGoKr, ymd } from "../datagokr";
import { addDays, kst } from "../time";
import type { Place } from "../types";
import { getLocalPop, type LocalPop } from "./busan-pop";
import { getAirForecast, getAirNow, getMidWeather, type AirNow, type MidDay } from "./weather-air";

export interface Weather {
  tmp?: number; // 기온 °C
  pop?: number; // 강수확률 %
  pty?: number; // 강수형태 0 없음, 1 비, 2 비/눈, 3 눈, 4 소나기
  sky?: number; // 하늘상태 1 맑음, 3 구름많음, 4 흐림
}

export interface Signals {
  /** 공휴일 YYYY-MM-DD → 이름 */
  holidays?: Map<string, string>;
  /** "YYYY-MM-DD HH" → 날씨 */
  weather?: Map<string, Weather>;
  /** YYYY-MM-DD → 관광지 집중률(%) */
  concentration?: Map<string, number>;
  /** YYYY-MM-DD → 시간대별(0~23) 출발 승객 수 */
  pax?: Map<string, number[]>;
  /** 부산시 생활인구 (시간대·성별·연령, 월평균) */
  localPop?: LocalPop;
  /** 4~10일 뒤 날씨 (기상청 중기예보) */
  midWeather?: Map<string, MidDay>;
  /** 지금 미세먼지 (에어코리아 실시간) */
  air?: AirNow;
  /** YYYY-MM-DD → 초미세먼지 예보 등급 1~4 */
  airForecast?: Map<string, number>;
}

const HOUR = 3600;

// 이번 달부터 3개월치 공휴일
async function getHolidays(): Promise<Map<string, string>> {
  const today = kst().date;
  const months = [0, 1, 2].map((i) => {
    const d = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 + i, 1));
    return { solYear: String(d.getUTCFullYear()), solMonth: String(d.getUTCMonth() + 1).padStart(2, "0") };
  });
  const lists = await Promise.all(
    months.map((m) => dataGoKr("/B090041/openapi/service/SpcdeInfoService/getRestDeInfo", { ...m, _type: "json" }, 12 * HOUR)),
  );
  const map = new Map<string, string>();
  for (const i of lists.flat()) {
    if (i.isHoliday !== "Y") continue;
    const d = String(i.locdate);
    map.set(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, String(i.dateName));
  }
  return map;
}

// 위경도 → 기상청 격자 (Lambert Conformal Conic, 기상청 공개 변환식)
export function toKmaGrid(lat: number, lng: number): { nx: number; ny: number } {
  const RE = 6371.00877 / 5.0;
  const DEG = Math.PI / 180;
  const slat1 = 30 * DEG;
  const slat2 = 60 * DEG;
  const olon = 126 * DEG;
  const olat = 38 * DEG;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  const ro = (RE * sf) / Math.pow(Math.tan(Math.PI * 0.25 + olat * 0.5), sn);
  const ra = (RE * sf) / Math.pow(Math.tan(Math.PI * 0.25 + lat * DEG * 0.5), sn);
  let theta = lng * DEG - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;
  return { nx: Math.floor(ra * Math.sin(theta) + 43 + 0.5), ny: Math.floor(ro - ra * Math.cos(theta) + 136 + 0.5) };
}

// 단기예보 발표 시각(02·05·…·23시) 중 가장 최근. back=1이면 그 직전 발표
function kmaBase(back = 0, now = new Date()): { base_date: string; base_time: string } {
  const t = new Date(now.getTime() + 9 * HOUR * 1000 - 15 * 60_000 - back * 3 * HOUR * 1000);
  const h = t.getUTCHours();
  const base = [23, 20, 17, 14, 11, 8, 5, 2].find((b) => b <= h);
  const day = base === undefined ? new Date(t.getTime() - 86_400_000) : t;
  return { base_date: ymd(day.toISOString().slice(0, 10)), base_time: `${String(base ?? 23).padStart(2, "0")}00` };
}

async function getWeather(place: Place): Promise<Map<string, Weather>> {
  const { nx, ny } = toKmaGrid(place.lat, place.lng);
  // 기상청 발표가 늦으면 최신 회차가 NO_DATA로 온다 → 최대 3회차(9시간) 전 발표까지 거슬러 올라간다
  let items: Awaited<ReturnType<typeof dataGoKr>> = [];
  for (const back of [0, 1, 2, 3]) {
    items = await dataGoKr(
      "/1360000/VilageFcstInfoService_2.0/getVilageFcst",
      { ...kmaBase(back), nx: String(nx), ny: String(ny), numOfRows: "1000", dataType: "JSON" },
      HOUR,
    ).catch(() => []);
    if (items.length) break;
  }
  if (!items.length) throw new Error(`no forecast for grid ${nx},${ny}`);
  const map = new Map<string, Weather>();
  for (const i of items) {
    const field = ({ TMP: "tmp", POP: "pop", PTY: "pty", SKY: "sky" } as const)[String(i.category) as "TMP" | "POP" | "PTY" | "SKY"];
    if (!field) continue;
    const d = String(i.fcstDate);
    const key = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)} ${String(i.fcstTime).slice(0, 2)}`;
    const w = map.get(key) ?? {};
    w[field] = Number(i.fcstValue);
    map.set(key, w);
  }
  return map;
}

export async function getConcentration(kto: NonNullable<Place["kto"]>): Promise<Map<string, number>> {
  const items = await dataGoKr(
    "/B551011/TatsCnctrRateService/tatsCnctrRatedList",
    { areaCd: kto.areaCd, signguCd: kto.signguCd, tAtsNm: kto.name, MobileOS: "WEB", MobileApp: "CrowdView", _type: "json" },
    6 * HOUR,
  );
  const map = new Map<string, number>();
  for (const i of items) {
    if (i.tAtsNm !== kto.name) continue;
    const d = String(i.baseYmd);
    map.set(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, Number(i.cnctrRate));
  }
  return map;
}

/** 어제·오늘·내일 시간대별 출발 승객 수 */
export async function getAirportPax(place: Place): Promise<Map<string, number[]>> {
  const today = kst().date;
  const map = new Map<string, number[]>();
  if (place.airport === "ICN1" || place.airport === "ICN2") {
    const field = place.airport === "ICN1" ? "t1dgsum1" : "t2dgsum2";
    for (const [sel, date] of [["0", today], ["1", addDays(today, 1)]] as const) {
      const rows = await dataGoKr("/B551177/passgrAnncmt/getPassgrAnncmt", { selectdate: sel, type: "json" }, 30 * 60);
      const hours = Array<number>(24).fill(0);
      for (const r of rows) {
        const h = Number(String(r.atime).slice(0, 2));
        if (Number.isInteger(h) && h < 24) hours[h] = Number(r[field] ?? 0);
      }
      map.set(date, hours);
    }
  } else if (place.airport) {
    // 기간 조회는 HTTP_ERROR가 나서 날짜별로 호출
    for (const date of [addDays(today, -1), today, addDays(today, 1)]) {
      const rows = await dataGoKr(
        "/B551178/daily-expect-passenger/info",
        { schStDate: ymd(date), schEdDate: ymd(date), schAirport: place.airport, schTof: "D", schAOD: "D", type: "json" },
        30 * 60,
      );
      if (rows.length === 0) continue;
      const hours = Array<number>(24).fill(0);
      for (const r of rows) hours[Number(r.HH)] = Number(r.PCT ?? 0);
      map.set(date, hours);
    }
  }
  return map;
}

export async function getSignals(place: Place): Promise<Signals> {
  if (!process.env.DATA_GO_KR_KEY) return {};
  const [holidays, weather, concentration, pax, localPop, midWeather, air, airForecast] = await Promise.allSettled([
    getHolidays(),
    getWeather(place),
    place.kto ? getConcentration(place.kto) : Promise.resolve(undefined),
    place.airport ? getAirportPax(place) : Promise.resolve(undefined),
    getLocalPop(place),
    getMidWeather(place),
    getAirNow(place),
    getAirForecast(place),
  ]);
  const ok = <T>(r: PromiseSettledResult<T>, name: string): T | undefined => {
    if (r.status === "fulfilled") return r.value;
    console.warn(`[signals] ${place.id} ${name}:`, r.reason instanceof Error ? r.reason.message : r.reason);
    return undefined;
  };
  return {
    holidays: ok(holidays, "holidays"),
    weather: ok(weather, "weather"),
    concentration: ok(concentration, "concentration"),
    pax: ok(pax, "pax"),
    localPop: ok(localPop, "localPop"),
    midWeather: ok(midWeather, "midWeather"),
    air: ok(air, "air"),
    airForecast: ok(airForecast, "airForecast"),
  };
}
