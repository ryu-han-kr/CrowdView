// 공항 혼잡도 (공공데이터포털, DATA_GO_KR_KEY)
// - 인천공항: 인천국제공항공사_출국장 혼잡도 조회 (T1, data.go.kr 15148225),
//   출국장 혼잡도_제2여객터미널 조회 (T2, 15161098). 둘 다 1분 주기
// - 김포·제주(v1), 김해·대구·청주(v2): 한국공항공사_공항 혼잡도 정보 (data.go.kr 15159598)
import type { AirportCode, CrowdSnapshot, Place } from "../types";
import { modelSnapshot } from "./model";

const BASE = "https://apis.data.go.kr";

// 한국공항공사 4단계 (1 원활 ~ 4 매우혼잡) → 0~100 점수
const KAC_LEVEL_SCORE: Record<string, number> = { "1": 22, "2": 48, "3": 72, "4": 90 };

type Item = Record<string, string | number | undefined>;

async function getItems(path: string, key: string, params: Record<string, string> = {}): Promise<Item[]> {
  const qs = new URLSearchParams({ serviceKey: key, pageNo: "1", numOfRows: "100", type: "json", ...params });
  const res = await fetch(`${BASE}${path}?${qs}`, { signal: AbortSignal.timeout(5000) });
  const text = await res.text();
  // 활용신청 전이면 403 + SERVICE_KEY_IS_NOT_REGISTERED_ERROR
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text.match(/"errMsg":\s*"([^"]+)"/)?.[1] ?? text.slice(0, 80)}`);
  let json: Record<string, any>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${path}: non-JSON response ${text.slice(0, 120)}`);
  }
  // 인증 오류는 OpenAPI_ServiceResponse로 온다 (활용신청 전이면 SERVICE_KEY_IS_NOT_REGISTERED_ERROR)
  const authErr = json.OpenAPI_ServiceResponse?.cmmMsgHeader?.errMsg;
  if (authErr) throw new Error(`${path}: ${authErr}`);
  const body = json.response?.body ?? json.body;
  const item = body?.items?.item ?? body?.items;
  if (!item) throw new Error(`${path}: unexpected payload`);
  return Array.isArray(item) ? item : [item];
}

function withCurrent(place: Place, score: number, headcount: number, source: CrowdSnapshot["source"]): CrowdSnapshot {
  const base = modelSnapshot(place);
  const hourly = base.hourly.map((p) => ({ ...p }));
  const current = hourly.filter((p) => !p.forecast).at(-1);
  if (current) current.score = score;
  return { ...base, score, open: true, headcount, hourly, source, updatedAt: new Date().toISOString() };
}

// 출국장별 대기시간(분)·대기인원. 운영 중인 출국장의 평균 대기시간으로 점수를 매긴다
const INCHEON_PATH = {
  ICN1: "/B551177/statusOfDepartureCongestion/getDepartureCongestion",
  ICN2: "/B551177/statusOfDepartureCongestionT2/getDepartureCongestionT2",
};

async function fetchIncheon(place: Place, code: "ICN1" | "ICN2", key: string): Promise<CrowdSnapshot> {
  const items = await getItems(INCHEON_PATH[code], key);
  // 운영시간이 비어 있으면 닫힌 출국장
  const gates = items.filter((i) => String(i.operatingTime ?? "").trim() !== "");
  if (gates.length === 0) return { ...modelSnapshot(place), open: false };
  const waitMin = gates.reduce((s, g) => s + Number(g.waitTime ?? 0), 0) / gates.length;
  const people = gates.reduce((s, g) => s + Number(g.waitLength ?? 0), 0);
  // 대기 0분 ≈ 10점, 20분 ≈ 50점(보통), 40분 이상 ≈ 90점(매우 붐빔)
  const score = Math.round(Math.min(95, 10 + waitMin * 2));
  return withCurrent(place, score, people, "incheon-airport");
}

async function fetchKac(place: Place, code: AirportCode, key: string): Promise<CrowdSnapshot> {
  const version = code === "GMP" || code === "CJU" ? "v1" : "v2";
  const items = (await getItems(`/B551178/airport-congestion/${version}`, key)).filter((i) => i.IATA_APCD === code);
  // 처리시간이 가장 최근인 행
  const latest = items.sort((a, b) => String(b.PRC_HR ?? "").localeCompare(String(a.PRC_HR ?? "")))[0];
  const score = latest && KAC_LEVEL_SCORE[String(latest.CGDR_ALL_LVL)];
  if (score === undefined) throw new Error(`kac ${code}: no congestion row`);
  return withCurrent(place, score, Math.round((place.capacity * score) / 100), "kac-airport");
}

export function fetchAirport(place: Place, code: AirportCode, key: string): Promise<CrowdSnapshot> {
  return code === "ICN1" || code === "ICN2" ? fetchIncheon(place, code, key) : fetchKac(place, code, key);
}
