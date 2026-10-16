// 외부 API 하루 호출 수 집계와 한도 보호.
// - 실제로 원본 API를 부를 때마다 Redis에 quota:{날짜}:{API} 를 1 올린다 (캐시에서 읽은 건 세지 않는다)
// - 한도의 90%에 닿으면 그날은 더 부르지 않고 마지막으로 받아 둔 데이터를 쓴다 (호출부가 QuotaError를 잡는다)
// - 공공데이터포털이 "한도 초과" 응답을 주면 그날 남은 호출을 막는다
// 한도는 공공데이터포털 개발계정 기준 (2026-10-16 확인). 운영계정으로 바꾸면 limit을 올린다.
import { kv } from "./cache";
import { kst } from "./time";

export interface ApiInfo {
  id: string;
  name: string;
  /** 원본 API 경로 앞부분 (공공데이터포털) */
  prefix?: string;
  /** data.go.kr 데이터셋 번호 */
  dataset?: string;
  /** 하루 호출 한도. 없으면 집계만 */
  limit?: number;
  /** 한도가 공식 확인값이 아니면 true */
  limitGuess?: boolean;
}

export const APIS: ApiInfo[] = [
  { id: "icn-dep-t1", name: "인천공항 출국장 혼잡도 T1", prefix: "/B551177/statusOfDepartureCongestion/", dataset: "15148225", limit: 1000 },
  { id: "icn-dep-t2", name: "인천공항 출국장 혼잡도 T2", prefix: "/B551177/statusOfDepartureCongestionT2/", dataset: "15161098", limit: 1000 },
  { id: "icn-pax", name: "인천공항 승객예고", prefix: "/B551177/passgrAnncmt/", dataset: "15095066", limit: 1000 },
  { id: "icn-parking", name: "인천공항 주차 정보", prefix: "/B551177/StatusOfParking/", dataset: "15095047", limit: 1000 },
  { id: "icn-fee", name: "인천공항 주차 요금", prefix: "/B551177/ParkingChargeInfo/", dataset: "15095053", limit: 1000 },
  { id: "kac-congestion", name: "한국공항공사 공항 혼잡도", prefix: "/B551178/airport-congestion/", dataset: "15159598", limit: 5000 },
  { id: "kac-parking", name: "한국공항공사 주차장 혼잡도", prefix: "/B551178/parking-congestion/", dataset: "15158689", limit: 5000 },
  { id: "kac-pax", name: "한국공항공사 예상 승객", prefix: "/B551178/daily-expect-passenger/", limit: 5000, limitGuess: true },
  { id: "kma-short", name: "기상청 단기예보", prefix: "/1360000/VilageFcstInfoService_2.0/", dataset: "15084084", limit: 10000 },
  { id: "kma-mid", name: "기상청 중기예보", prefix: "/1360000/MidFcstInfoService/", dataset: "15059468", limit: 10000 },
  { id: "airkorea", name: "에어코리아 대기오염", prefix: "/B552584/ArpltnInforInqireSvc/", dataset: "15073861", limit: 500 },
  { id: "kasi", name: "천문연구원 특일(공휴일)", prefix: "/B090041/", dataset: "15012690", limit: 10000 },
  { id: "kto-cnctr", name: "관광공사 관광지 집중률", prefix: "/B551011/TatsCnctrRateService/", dataset: "15128555", limit: 1000 },
  { id: "kto-tour", name: "관광공사 TourAPI(축제·운영시간)", prefix: "/B551011/KorService2/", dataset: "15101578", limit: 1000 },
  { id: "kto-datalab", name: "관광공사 데이터랩(지역 방문자)", prefix: "/B551011/DataLabService/", dataset: "15101972", limit: 1000 },
  { id: "busan-pop", name: "부산시 생활인구", prefix: "/6260000/", limit: 1000, limitGuess: true },
  // 공공데이터포털 밖
  { id: "seoul-citydata", name: "서울시 실시간 도시데이터" },
  { id: "seoul-events", name: "서울시 문화행사 정보" },
  { id: "papago", name: "Papago 번역 (요청 수)" },
];

const SAFETY = 0.9;
const KEEP_DAYS = 8;

export class QuotaError extends Error {}

export const apiOfPath = (path: string) => APIS.find((a) => a.prefix && path.startsWith(a.prefix));
const quotaKey = (id: string, date = kst().date) => `quota:${date}:${id}`;

/**
 * 원본 API를 부르기 직전에 호출한다. 한도(90%)를 넘었으면 QuotaError.
 * Redis가 안 되면 막지 않는다 (집계보다 서비스가 먼저)
 */
export async function beforeCall(api: ApiInfo | undefined): Promise<void> {
  if (!api) return;
  let n: number;
  try {
    n = await kv.incr(quotaKey(api.id), KEEP_DAYS * 86_400);
  } catch {
    return;
  }
  if (api.limit && n > api.limit * SAFETY) {
    await kv.decr(quotaKey(api.id)).catch(() => {});
    throw new QuotaError(`${api.name}: 오늘 호출 ${n - 1}회로 한도(${api.limit})의 ${SAFETY * 100}% 도달`);
  }
}

/** 원본이 "한도 초과"라고 답하면 오늘 남은 호출을 막는다 */
export async function markExhausted(api: ApiInfo | undefined): Promise<void> {
  if (!api) return;
  await kv.set(quotaKey(api.id), String(api.limit ?? 1_000_000_000), KEEP_DAYS * 86_400).catch(() => {});
}

export interface ApiUsage extends ApiInfo {
  count: number;
  /** 한도 대비 % (한도가 있을 때) */
  pct?: number;
}

/** 그날 API별 호출 수 (Redis 명령 1번) */
export async function getApiUsage(date = kst().date): Promise<ApiUsage[]> {
  const raws = await kv.mget(APIS.map((a) => quotaKey(a.id, date))).catch(() => APIS.map(() => null));
  return APIS.map((a, i) => {
    const count = Number(raws[i] ?? 0);
    return { ...a, count, pct: a.limit ? (count / a.limit) * 100 : undefined };
  });
}
