// 공항 실시간 혼잡도 (공공데이터포털, DATA_GO_KR_KEY)
// - 인천공항: 인천국제공항공사_출국장 혼잡도 조회 (T1, data.go.kr 15148225),
//   출국장 혼잡도_제2여객터미널 조회 (T2, 15161098). 둘 다 1분 주기
// - 김포·제주(v1), 김해·대구·청주(v2): 한국공항공사_공항 혼잡도 정보 (data.go.kr 15159598)
import { dataGoKr } from "../datagokr";
import { scoreFromValue } from "../levels";
import type { AirportCode, CrowdSnapshot, Place, Zone } from "../types";
import { modelSnapshot } from "./model";
import { kst } from "../time";
import type { Signals } from "./signals";

// 한국공항공사 4단계 (1 원활 ~ 4 매우혼잡) → 0~100 점수
const KAC_LEVEL_SCORE: Record<string, number> = { "1": 22, "2": 48, "3": 72, "4": 90 };

const KAC_SEGMENTS = [
  { field: "CGDR_A_LVL", id: "A", label: "체크인 → 신분확인" },
  { field: "CGDR_B_LVL", id: "B", label: "신분확인 → 보안검색" },
  { field: "CGDR_C_LVL", id: "C", label: "보안검색 → 탑승" },
] as const;

const INCHEON_PATH = {
  ICN1: "/B551177/statusOfDepartureCongestion/getDepartureCongestion",
  ICN2: "/B551177/statusOfDepartureCongestionT2/getDepartureCongestionT2",
};

/** 대기시간(분)을 장소 기준(예: 10·20·30·45분)으로 점수화. 기준이 없으면 20분=보통 근사 */
const waitScore = (min: number, place: Place) =>
  place.criteria?.unit === "분" ? scoreFromValue(min, place.criteria.steps) : Math.round(Math.min(95, 10 + min * 2));

/** DG3_E → 출국장 3 동편, DG1_A → 출국장 1 A */
function gateLabel(gateId: string): string {
  const m = gateId.match(/^DG(\d+)_?(\w)?$/);
  if (!m) return gateId;
  const side = ({ E: "동편", W: "서편" } as Record<string, string>)[m[2] ?? ""] ?? m[2] ?? "";
  return `출국장 ${m[1]}${side ? ` ${side}` : ""}`;
}

function withCurrent(
  place: Place,
  score: number,
  headcount: number,
  source: CrowdSnapshot["source"],
  s: Signals | undefined,
  zones: Zone[],
): CrowdSnapshot {
  const base = modelSnapshot(place, new Date(), s);
  const hourly = base.hourly.map((p) => ({ ...p }));
  const current = hourly.filter((p) => !p.forecast).at(-1);
  if (current) current.score = score;
  return { ...base, score, open: true, headcount, hourly, source, zones, updatedAt: new Date().toISOString() };
}

// 출국장별 대기시간(분)·대기인원. 운영 중인 출국장의 평균 대기시간으로 점수를 매긴다
async function fetchIncheon(place: Place, code: "ICN1" | "ICN2", s?: Signals): Promise<CrowdSnapshot> {
  const items = await dataGoKr(INCHEON_PATH[code], { type: "json" });
  // 운영시간이 비어 있으면 닫힌 출국장
  const gates = items.filter((i) => String(i.operatingTime ?? "").trim() !== "");
  if (gates.length === 0) return { ...modelSnapshot(place, new Date(), s), open: false };
  const zones: Zone[] = gates.map((g) => {
    const waitMin = Number(g.waitTime ?? 0);
    return {
      id: String(g.gateId),
      label: gateLabel(String(g.gateId)),
      score: waitScore(waitMin, place),
      waitMin,
      people: Number(g.waitLength ?? 0),
      hours: String(g.operatingTime),
    };
  });
  const waitMin = zones.reduce((sum, z) => sum + (z.waitMin ?? 0), 0) / zones.length;
  const people = zones.reduce((sum, z) => sum + (z.people ?? 0), 0);
  return withCurrent(place, waitScore(waitMin, place), people, "incheon-airport", s, zones);
}

async function fetchKac(place: Place, code: AirportCode, s?: Signals): Promise<CrowdSnapshot> {
  const version = code === "GMP" || code === "CJU" ? "v1" : "v2";
  const items = (await dataGoKr(`/B551178/airport-congestion/${version}`, { type: "json" })).filter((i) => i.IATA_APCD === code);
  // 처리시간이 가장 최근인 행
  const latest = items.sort((a, b) => String(b.PRC_HR ?? "").localeCompare(String(a.PRC_HR ?? "")))[0];
  const score = latest && KAC_LEVEL_SCORE[String(Number(latest.CGDR_ALL_LVL))];
  if (score === undefined) {
    // 밤(23~06시)에는 국내선 운항이 끝나 혼잡도 행이 비는 게 정상 → 운영 종료로 (갱신 실패로 보지 않는다)
    const h = kst().hour;
    if (h >= 23 || h < 6) return { ...modelSnapshot(place, new Date(), s), open: false };
    throw new Error(`kac ${code}: no congestion row`);
  }
  const zones: Zone[] = KAC_SEGMENTS.flatMap((seg) => {
    const z = KAC_LEVEL_SCORE[String(Number(latest[seg.field]))];
    return z === undefined ? [] : [{ id: seg.id, label: seg.label, score: z }];
  });
  // 인원은 혼잡도 API에 없어서, 시간대별 탑승객 수 API의 이번 시간 출발 승객 수를 쓴다
  const now = kst();
  const pax = s?.pax?.get(now.date)?.[Math.floor(now.hour)];
  const snap = withCurrent(place, score, pax ?? Math.round((place.capacity * score) / 100), "kac-airport", s, zones);
  return pax !== undefined ? { ...snap, paxHour: true } : snap;
}

export function fetchAirport(place: Place, code: AirportCode, s?: Signals): Promise<CrowdSnapshot> {
  return code === "ICN1" || code === "ICN2" ? fetchIncheon(place, code, s) : fetchKac(place, code, s);
}
