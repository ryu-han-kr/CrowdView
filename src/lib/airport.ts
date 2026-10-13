// 공항 탭 상세 데이터: 날짜·시간대별 출발 승객 수(출국장별), 주차장 혼잡도.
// 실시간 혼잡도·구역별 대기는 crowd/service의 스냅샷(zones)에서 온다.
import { kv } from "./cache";
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

// 한국공항공사 전국공항 주차장 혼잡도 (김포·제주·김해 등). 인천공항 주차는 별도 API(15095047) 활용신청 필요
export async function getParking(place: Place): Promise<ParkingLot[]> {
  if (!place.airport || place.airport.startsWith("ICN")) return [];
  try {
    const rows = await dataGoKr("/B551178/parking-congestion/info", { schAirportCode: place.airport, type: "json" }, 5 * 60);
    return rows.map((r) => {
      const occupied = Number(r.parkingOccupiedSpace ?? 0);
      const total = Number(r.parkingTotalSpace ?? 0);
      return {
        name: String(r.parkingAirportCodeName),
        status: String(r.parkingCongestion ?? ""),
        rate: total > 0 ? Math.min(100, Math.round((occupied / total) * 100)) : 0,
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
