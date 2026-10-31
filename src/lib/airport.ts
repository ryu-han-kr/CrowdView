// 공항 탭 상세 데이터: 날짜·시간대별 출발 승객 수(출국장별), 주차장 혼잡도.
// 실시간 혼잡도·구역별 대기는 crowd/service의 스냅샷(zones)에서 온다.
import { kv } from "./cache";
import { cached } from "./cached";
import { dataGoKr, ymd } from "./datagokr";
import { addDays, kst } from "./time";
import type { Place } from "./types";

export interface PaxHour {
  hour: number;
  total: number;
  /** 출국장별 인원 (인천공항만) */
  gates?: Record<string, number>;
}

export interface PaxDay {
  date: string;
  hours: PaxHour[];
  /** forecast: 공항공사 예고·예상치, recorded: 그날 받아 둔 예고치 */
  kind: "forecast" | "recorded";
}

export interface ParkingLot {
  name: string;
  status: string;
  /** 0~100 */
  rate: number;
  occupied: number;
  total: number;
  updatedAt: string;
}

const PAX_KEEP_SECONDS = 8 * 24 * 60 * 60;
const paxKey = (id: string, date: string) => `pax:${id}:${date}`;

// 인천공항 승객예고: 오늘(0)·내일(1)만 제공. 받은 날의 값을 저장해 두고 다음 날 "어제"로 쓴다
async function incheonPax(place: Place): Promise<PaxDay[]> {
  const t1 = place.airport === "ICN1";
  const gateFields = t1 ? ["t1dg1", "t1dg2", "t1dg3", "t1dg4", "t1dg5", "t1dg6"] : ["t2dg1", "t2dg2"];
  const today = kst().date;
  const days: PaxDay[] = [];
  for (const [sel, date] of [["0", today], ["1", addDays(today, 1)]] as const) {
    const rows = await dataGoKr("/B551177/passgrAnncmt/getPassgrAnncmt", { selectdate: sel, type: "json" }, 30 * 60);
    const hours: PaxHour[] = rows
      .filter((r) => /^\d{2}_\d{2}$/.test(String(r.atime)))
      .map((r) => {
        const gates = Object.fromEntries(gateFields.map((f) => [`출국장 ${f.slice(-1)}`, Math.round(Number(r[f] ?? 0))]));
        return { hour: Number(String(r.atime).slice(0, 2)), total: Object.values(gates).reduce((a, b) => a + b, 0), gates };
      });
    days.push({ date, hours, kind: "forecast" });
    await kv.set(paxKey(place.id, date), JSON.stringify(hours), PAX_KEEP_SECONDS).catch(() => {});
  }
  const yesterday = addDays(today, -1);
  const saved = await kv.get(paxKey(place.id, yesterday)).catch(() => null);
  if (saved) days.unshift({ date: yesterday, hours: JSON.parse(saved) as PaxHour[], kind: "recorded" });
  return days;
}

// 한국공항공사 시간대별 탑승객 수: 날짜를 지정해 조회 (기간 조회는 HTTP_ERROR)
async function kacPax(place: Place): Promise<PaxDay[]> {
  const today = kst().date;
  const days: PaxDay[] = [];
  for (const date of [addDays(today, -1), today, addDays(today, 1)]) {
    const rows = await dataGoKr(
      "/B551178/daily-expect-passenger/info",
      { schStDate: ymd(date), schEdDate: ymd(date), schAirport: place.airport!, schTof: "D", schAOD: "D", type: "json" },
      30 * 60,
    );
    if (rows.length === 0) continue;
    const hours = rows.map((r) => ({ hour: Number(r.HH), total: Number(r.PCT ?? 0) })).sort((a, b) => a.hour - b.hour);
    days.push({ date, hours, kind: "forecast" });
  }
  return days;
}

export async function getAirportPaxDays(place: Place): Promise<PaxDay[]> {
  if (!place.airport) return [];
  try {
    return place.airport === "ICN1" || place.airport === "ICN2" ? await incheonPax(place) : await kacPax(place);
  } catch (e) {
    console.warn(`[airport] ${place.id} pax:`, e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * 주차 수치 정리 (QA 10/21 AIR-S02): 음수·숫자 아님은 0, 주차 대수는 전체 면수를 넘지 않게, 점유율 0~100%.
 * 빈자리 = 전체 - 주차 대수. 전체 면수가 0이면(센서 없음) 점유율 0으로 두고 화면에서 빈자리를 숨긴다
 */
export function parkingNumbers(occupiedRaw: unknown, totalRaw: unknown): { occupied: number; total: number; free: number; rate: number } {
  const n = (v: unknown) => {
    const x = Number(v);
    return Number.isFinite(x) && x > 0 ? Math.round(x) : 0;
  };
  const total = n(totalRaw);
  const occupied = Math.min(n(occupiedRaw), total);
  return { occupied, total, free: total - occupied, rate: total > 0 ? Math.round((occupied / total) * 100) : 0 };
}

// 인천공항 주차 정보 (data.go.kr 15095047): 터미널별 주차장·층의 주차 대수와 전체 면수
async function incheonParking(place: Place): Promise<ParkingLot[]> {
  const terminal = place.airport === "ICN1" ? "T1" : "T2";
  const rows = await dataGoKr("/B551177/StatusOfParking/getTrackingParking", { type: "json" }, 5 * 60);
  return rows
    .filter((r) => String(r.floor).startsWith(terminal))
    .map((r) => {
      const { occupied, total, rate } = parkingNumbers(r.parking, r.parkingarea);
      const t = String(r.datetm ?? "");
      return {
        name: String(r.floor).replace(`${terminal} `, "").replace(/(지하|지상)/, " $1"),
        status: "",
        rate,
        occupied,
        total,
        updatedAt: t.length >= 12 ? `${t.slice(8, 10)}:${t.slice(10, 12)}` : "",
      };
    });
}

export interface ParkingFee {
  group: string;
  lines: FeeLine[];
}

/** 요금 한 줄: 번역 원본 k + 값 (분 m · 원 w). 못 읽은 줄은 원문 그대로 k */
export interface FeeLine {
  k: string;
  m?: number;
  w?: number;
}

const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * 공항공사 요금 문장을 읽기 쉽게 (11/1 지인 QA: '최초 00:30 에 한해 1200원 적용'·'00:15 초과 시 600원 부과'가 무슨 말인지 모르겠다)
 * → '처음 30분 1,200원' · '이후 15분마다 600원' · '하루 최대 24,000원'
 */
export function friendlyFees(lines: string[]): FeeLine[] {
  const hasFirst = lines.some((l) => /최초\s*\d\d:\d\d/.test(l));
  return lines.map((l) => {
    const first = l.match(/최초\s*(\d\d:\d\d)\s*에\s*한해\s*([\d,]+)\s*원/);
    if (first) return { k: "처음 {m} {w}원", m: mins(first[1]), w: Number(first[2].replace(/,/g, "")) };
    const over = l.match(/(\d\d:\d\d)\s*초과\s*시\s*([\d,]+)\s*원/);
    if (over) return { k: hasFirst ? "이후 {m}마다 {w}원" : "{m}마다 {w}원", m: mins(over[1]), w: Number(over[2].replace(/,/g, "")) };
    const max = l.match(/일일\s*최대\s*([\d,]+)\s*원/);
    if (max) return { k: "하루 최대 {w}원", w: Number(max[1].replace(/,/g, "")) };
    return { k: l };
  });
}

// 인천공항 주차장별 요금 부과 기준 (data.go.kr 15095053). 요금 코드에 주차장 이름이 없어서,
// 인천공항이 공지한 단기·장기 요금과 일치하는 코드 1·2번만 매칭해 보여준다 (매칭은 추정)
export async function getParkingFees(place: Place): Promise<ParkingFee[]> {
  if (!place.airport?.startsWith("ICN")) return [];
  try {
    const rows = await dataGoKr("/B551177/ParkingChargeInfo/getParkingChargeInformation", { type: "json", numOfRows: "100" }, 24 * 60 * 60);
    const by = (id: string) => rows.filter((r) => String(r.charid).endsWith(id)).map((r) => String(r.chardesc));
    const fee = (n: string) => [...by(`FB0000000${n}`), ...by(`NF0000000${n}`)];
    return [
      { group: "단기주차장", lines: friendlyFees(fee("1")) },
      { group: "장기주차장", lines: friendlyFees(fee("2")) },
    ].filter((f) => f.lines.length > 0);
  } catch (e) {
    console.warn(`[airport] ${place.id} fees:`, e instanceof Error ? e.message : e);
    return [];
  }
}

// 한국공항공사 전국공항 주차장 혼잡도 (김포·제주·김해 등), 인천공항은 인천국제공항공사 주차 정보
export async function getParking(place: Place): Promise<ParkingLot[]> {
  if (!place.airport) return [];
  if (place.airport.startsWith("ICN")) {
    try {
      return await incheonParking(place);
    } catch (e) {
      console.warn(`[airport] ${place.id} parking:`, e instanceof Error ? e.message : e);
      return [];
    }
  }
  try {
    const rows = await dataGoKr("/B551178/parking-congestion/info", { schAirportCode: place.airport, type: "json" }, 5 * 60);
    return rows.map((r) => {
      const { occupied, total, rate } = parkingNumbers(r.parkingOccupiedSpace, r.parkingTotalSpace);
      return {
        name: String(r.parkingAirportCodeName),
        status: String(r.parkingCongestion ?? ""),
        rate,
        occupied,
        total,
        updatedAt: `${r.sysGetdate ?? ""} ${String(r.sysGettime ?? "").slice(0, 5)}`.trim(),
      };
    });
  } catch (e) {
    console.warn(`[airport] ${place.id} parking:`, e instanceof Error ? e.message : e);
    return [];
  }
}

export interface ArrivalFlight {
  flight: string;
  /** 출발 공항 IATA */
  from: string;
  /** HH:MM (예상) */
  time: string;
  late: boolean;
  entryGate: string;
  gate: string;
  korean: number;
  foreigner: number;
}

export interface ArrivalGate {
  gate: string;
  flights: number;
  waiting: number;
}

// YYYYMMDDHHMM → 분 단위 시각 (지연 계산용)
const minutesOf = (s: unknown) => {
  const v = String(s ?? "");
  return v.length >= 12 ? Date.UTC(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8), +v.slice(8, 10), +v.slice(10, 12)) / 60_000 : NaN;
};
const hhmm = (s: unknown) => {
  const v = String(s ?? "");
  return v.length >= 12 ? `${v.slice(8, 10)}:${v.slice(10, 12)}` : "";
};

// 인천공항 입국장 현황 (data.go.kr 15095061): 지금 기준 -2시간 ~ +2시간 도착편과 입국장별 대기 인원.
// 개발계정 하루 500회라 20분 캐시 (터미널 2개 × 72회 = 144회, 29%)
export async function getArrivals(place: Place): Promise<{ flights: ArrivalFlight[]; gates: ArrivalGate[] }> {
  if (!place.airport?.startsWith("ICN")) return { flights: [], gates: [] };
  try {
    const rows = await dataGoKr(
      "/B551177/StatusOfArrivals/getArrivalsCongestion",
      { type: "json", numOfRows: "300", terno: place.airport === "ICN1" ? "T1" : "T2" },
      20 * 60,
    );
    const flights = rows
      .map((r) => ({
        flight: String(r.flightid ?? ""),
        from: String(r.airport ?? ""),
        time: hhmm(r.estimatedtime || r.scheduletime),
        // 30분 이상 늦으면 지연
        late: minutesOf(r.estimatedtime) - minutesOf(r.scheduletime) >= 30,
        entryGate: String(r.entrygate ?? ""),
        gate: String(r.gatenumber ?? ""),
        korean: Math.round(Number(r.korean ?? 0)),
        foreigner: Math.round(Number(r.foreigner ?? 0)),
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
    const by = new Map<string, ArrivalGate>();
    for (const f of flights) {
      if (!f.entryGate) continue;
      const g = by.get(f.entryGate) ?? { gate: f.entryGate, flights: 0, waiting: 0 };
      g.flights++;
      g.waiting += f.korean + f.foreigner;
      by.set(f.entryGate, g);
    }
    return { flights, gates: [...by.values()].sort((a, b) => a.gate.localeCompare(b.gate)) };
  } catch (e) {
    console.warn(`[airport] ${place.id} arrivals:`, e instanceof Error ? e.message : e);
    return { flights: [], gates: [] };
  }
}

export interface ParkingZone {
  /** 주차장-구역 번호 (예: 01-03). 공항공사가 이름을 주지 않아 번호로 표시 */
  zone: string;
  total: number;
  free: number;
}

// 인천공항 주차면 센서 (T1 15107228 단기주차장, T2 15160956): 면 단위 상태를 구역별 빈자리로 묶는다.
// 원본이 수천 줄(최대 2MB)이라 원본 대신 묶은 결과만 10분 캐시 (하루 144회, 14%)
export async function getParkingZones(place: Place): Promise<ParkingZone[]> {
  if (!place.airport?.startsWith("ICN")) return [];
  const t1 = place.airport === "ICN1";
  try {
    return await cached(
      `icn:zones:${place.airport}`,
      10 * 60,
      async () => {
        const rows = await dataGoKr(
          t1 ? "/B551177/ParkLocationData/getParkLocationData" : "/B551177/parkLocationAreaData/getParkLocationAreaData",
          { type: "json", numOfRows: t1 ? "6000" : "14000" },
        );
        const by = new Map<string, ParkingZone>();
        for (const r of rows) {
          const zone = `${r.parklotno}-${r.parkzoneno}`;
          const z = by.get(zone) ?? { zone, total: 0, free: 0 };
          z.total++;
          if (r.carstatus === "N") z.free++;
          by.set(zone, z);
        }
        return [...by.values()].sort((a, b) => a.zone.localeCompare(b.zone));
      },
      (v) => v.length === 0,
    );
  } catch (e) {
    console.warn(`[airport] ${place.id} zones:`, e instanceof Error ? e.message : e);
    return [];
  }
}
