// 외부 API 하루 호출 수 집계와 한도 보호.
// - 실제로 원본 API를 부를 때마다 Redis에 quota:{날짜}:{API} 를 1 올린다 (캐시에서 읽은 건 세지 않는다)
// - 한도의 90%에 닿으면 그날은 더 부르지 않고 마지막으로 받아 둔 데이터를 쓴다 (호출부가 QuotaError를 잡는다)
// - 공공데이터포털이 "한도 초과" 응답을 주면 그날 남은 호출을 막는다
// 한도는 공공데이터포털 마이페이지 '활용신청 현황'의 일일 트래픽 (2026-10-22 확인: 40건 모두 운영계정, 33건 승인).
// 운영 신청이 아직 승인 전인 것(관광공사 4개·강원랜드)은 개발계정 한도 그대로. 승인되면 limit을 올린다.
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
  /** 한 달 한도 (Papago처럼 월 요금 상한이 있는 것). 90%에서 멈춘다 */
  monthlyLimit?: number;
  /** 한도가 공식 확인값이 아니면 true */
  limitGuess?: boolean;
  /** 세는 단위 (기본 "회") */
  unit?: string;
}

export const APIS: ApiInfo[] = [
  { id: "icn-dep-t1", name: "인천공항 출국장 혼잡도 T1", prefix: "/B551177/statusOfDepartureCongestion/", dataset: "15148225", limit: 100000 },
  { id: "icn-dep-t2", name: "인천공항 출국장 혼잡도 T2", prefix: "/B551177/statusOfDepartureCongestionT2/", dataset: "15161098", limit: 100000 },
  { id: "icn-pax", name: "인천공항 승객예고", prefix: "/B551177/passgrAnncmt/", dataset: "15095066", limit: 1000000 },
  { id: "icn-parking", name: "인천공항 주차 정보", prefix: "/B551177/StatusOfParking/", dataset: "15095047", limit: 1000000 },
  { id: "icn-arrivals", name: "인천공항 입국장 현황", prefix: "/B551177/StatusOfArrivals/", dataset: "15095061", limit: 10000 },
  { id: "icn-space-t1", name: "인천공항 T1 주차면", prefix: "/B551177/ParkLocationData/", dataset: "15107228", limit: 10000 },
  { id: "icn-space-t2", name: "인천공항 T2 주차면", prefix: "/B551177/parkLocationAreaData/", dataset: "15160956", limit: 10000 },
  { id: "icn-fee", name: "인천공항 주차 요금", prefix: "/B551177/ParkingChargeInfo/", dataset: "15095053", limit: 1000000 },
  { id: "kac-congestion", name: "한국공항공사 공항 혼잡도", prefix: "/B551178/airport-congestion/", dataset: "15159598", limit: 100000 },
  { id: "kac-parking", name: "한국공항공사 주차장 혼잡도", prefix: "/B551178/parking-congestion/", dataset: "15158689", limit: 100000 },
  { id: "kac-pax", name: "한국공항공사 예상 승객", prefix: "/B551178/daily-expect-passenger/", limit: 100000 },
  { id: "kma-short", name: "기상청 단기예보", prefix: "/1360000/VilageFcstInfoService_2.0/", dataset: "15084084", limit: 100000 },
  { id: "kma-mid", name: "기상청 중기예보", prefix: "/1360000/MidFcstInfoService/", dataset: "15059468", limit: 1000000 },
  { id: "kma-msg", name: "기상청 단기예보 통보문", prefix: "/1360000/VilageFcstMsgService/", dataset: "15058629", limit: 1000000 },
  { id: "airkorea-pm50", name: "에어코리아 고농도 초미세먼지 예보", prefix: "/B552584/MinuDustFrcstDspthSvc/", dataset: "15112307", limit: 10000 },
  { id: "airkorea", name: "에어코리아 대기오염", prefix: "/B552584/ArpltnInforInqireSvc/", dataset: "15073861", limit: 10000 },
  { id: "kasi", name: "천문연구원 특일(공휴일)", prefix: "/B090041/", dataset: "15012690", limit: 1000000 },
  { id: "kto-cnctr", name: "관광공사 관광지 집중률", prefix: "/B551011/TatsCnctrRateService/", dataset: "15128555", limit: 1000 }, // 운영계정 신청 중 (승인되면 100,000)
  { id: "kto-tour", name: "관광공사 TourAPI(축제·운영시간)", prefix: "/B551011/KorService2/", dataset: "15101578", limit: 1000 }, // 운영계정 신청 중 (승인되면 100,000)
  { id: "kto-related", name: "관광공사 연관 관광지", prefix: "/B551011/TarRlteTarService1/", dataset: "15128560", limit: 1000 }, // 운영계정 신청 중 (승인되면 100,000)
  { id: "kto-datalab", name: "관광공사 데이터랩(지역 방문자)", prefix: "/B551011/DataLabService/", dataset: "15101972", limit: 1000 }, // 운영계정 신청 중 (승인되면 100,000)
  // 강원랜드 광장주차장 실시간 주차 (하이원 보조 지표). 10/27 운영계정 승인 10만/일, 요청 주소는 PARKING_HIGH1_URL (lib/crowd/parking)
  { id: "parking-high1", name: "강원랜드 광장주차장 실시간 주차", dataset: "15168488", limit: 100000 },
  { id: "busan-pop", name: "부산시 생활인구", prefix: "/6260000/", limit: 100000 },
  // 공공데이터포털 밖
  { id: "seoul-citydata", name: "서울시 실시간 도시데이터" },
  { id: "seoul-events", name: "서울시 문화행사 정보" },
  // 국가교통정보센터 실시간 소통 (명소·장소 진입로). 한도 공개값을 못 찾아 넉넉히 잡은 추정
  { id: "its-traffic", name: "국가교통정보센터 실시간 소통", limit: 20000, limitGuess: true },
  // 한국도로공사: 전국 콘존 속도를 10분마다 9번(1,000줄씩) + 영업소 좌표 하루 1번 → 하루 많아야 약 1,300회
  { id: "ex-traffic", name: "한국도로공사 실시간 교통량·영업소 위치", limit: 10000, limitGuess: true },
  // 유료(종량제 건당 33원, Basic 요금제 하루 100건까지). 비용 상한용으로 하루 30건(90%면 27건 ≈ 하루 900원)에서 멈춘다.
  // 더 쓰려면 SK_DAILY_LIMIT 환경변수로 올린다. 실제 한도는 여기에 Plus 회원 수 × SK_PER_MEMBER(10)를 더한다 (lib/skt)
  { id: "skt-congestion", name: "SK 장소 혼잡도·TMAP 장소 검색", limit: Number(process.env.SK_DAILY_LIMIT) || 30 },
  // 글자 수로 센다. NCP 콘솔 Application 하루 한도(3만 자)와 맞추고, 90%(2.7만 자)에서 앱이 먼저 멈춘다.
  // 월 상한(기본 30만 자, PAPAGO_MONTHLY_LIMIT)도 둔다 — 10/21 NCP가 429를 내는데 우리 일일 집계는 17%였다 (한 달 누적이 문제)
  // NCP NAVER API HUB Search Trend: 월 5만 건 무료(사용자가 NCP 콘솔 한도도 5만으로 걸어 둠). 우리 쓰임은 월 2천 건 안팎
  { id: "naver-searchtrend", name: "네이버 검색어 트렌드 (NCP Search Trend)", monthlyLimit: Number(process.env.SEARCHTREND_MONTHLY_LIMIT) || 50_000 },
  // 무료 플랜 (사용자 10/22): 매월 초기화. 하루 몫을 나눠 한 달을 넘기지 않게
  // 카카오 로컬 키워드 검색: 무료 쿼터 하루 10만 건·월 300만 건(전체 API 합, 첫 활성화 앱만), 넘으면 건당 2원 (docs/검색·지도-API-쿼터-2026-10-23.md)
  // 무료의 1/5(하루 2만·월 50만)에서 멈춘다 → 카카오 쪽 유료 설정을 켜 둬도 과금 구간에 닿지 않는다. 더 쓰려면 KAKAO_DAILY_LIMIT·KAKAO_MONTHLY_LIMIT
  { id: "kakao-local", name: "카카오 로컬 키워드 검색", limit: Number(process.env.KAKAO_DAILY_LIMIT) || 20_000, monthlyLimit: Number(process.env.KAKAO_MONTHLY_LIMIT) || 500_000 },
  // Brave: 2026-02부터 새 가입은 무료 플랜 대신 매달 $5 크레딧(약 1,000건, 1,000건당 $5) → 넘으면 카드로 과금. 월 900·하루 30에서 멈춘다
  // 하루 30건 고정 (사용자 10/24). 처음(10/22) 기본값이 60이라 10/22·23에 하루 45건 나갔다 (운영 환경변수는 없음) → 환경변수로도 30보다 못 올리게
  { id: "brave-search", name: "Brave Search (월 $5 무료 크레딧)", limit: Math.min(Number(process.env.BRAVE_DAILY_LIMIT) || 30, 30), monthlyLimit: Number(process.env.BRAVE_MONTHLY_LIMIT) || 900 },
  { id: "tavily", name: "Tavily 검색 (무료)", limit: Number(process.env.TAVILY_DAILY_LIMIT) || 30, monthlyLimit: Number(process.env.TAVILY_MONTHLY_LIMIT) || 1000, unit: "크레딧" },
  // 구글 플레이스 (New) 사진 없는 장소 사진 (api/gphoto). 검색 1 + 사진 1을 2로 센다. 사진 월 1,000장 무료 → 월 1,800(사진 900장)에서 멈춘다
  { id: "google-places", name: "구글 플레이스 사진 (검색+사진)", limit: 120, monthlyLimit: 1800 },
  { id: "papago", name: "Papago 번역 (글자 수)", limit: 30000, monthlyLimit: Number(process.env.PAPAGO_MONTHLY_LIMIT) || 300_000, unit: "자" },
];

const SAFETY = 0.9;
const KEEP_DAYS = 8;

export class QuotaError extends Error {}

export const apiOfPath = (path: string) => APIS.find((a) => a.prefix && path.startsWith(a.prefix));
const quotaKey = (id: string, date = kst().date) => `quota:${date}:${id}`;
/** 월 집계 키 (YYYY-MM). 다음 달 집계가 시작된 뒤에도 지난달을 볼 수 있게 40일 보관 */
const monthKey = (id: string, month = kst().date.slice(0, 7)) => `quota:m:${month}:${id}`;
const KEEP_MONTH = 40 * 86_400;

/**
 * 원본 API를 부르기 직전에 호출한다. amount는 이번 호출의 양 (기본 1회, Papago는 글자 수).
 * 한도(90%)를 넘으면 QuotaError. 월 한도가 있는 API는 월 집계도 같이. Redis가 안 되면 막지 않는다 (집계보다 서비스가 먼저)
 */
export async function beforeCall(api: ApiInfo | undefined, amount = 1): Promise<void> {
  if (!api) return;
  let n: number;
  let m = 0;
  try {
    n = await kv.incr(quotaKey(api.id), KEEP_DAYS * 86_400, amount);
    if (api.monthlyLimit) m = await kv.incr(monthKey(api.id), KEEP_MONTH, amount);
  } catch {
    return;
  }
  const over = api.limit && n > api.limit * SAFETY ? `오늘 ${n - amount}${api.unit ?? "회"}로 한도(${api.limit})` : undefined;
  const overMonth = api.monthlyLimit && m > api.monthlyLimit * SAFETY ? `이달 ${m - amount}${api.unit ?? "회"}로 월 한도(${api.monthlyLimit})` : undefined;
  if (over || overMonth) {
    await kv.decr(quotaKey(api.id), amount).catch(() => {});
    if (api.monthlyLimit) await kv.decr(monthKey(api.id), amount).catch(() => {});
    throw new QuotaError(`${api.name}: ${over ?? overMonth}의 ${SAFETY * 100}% 도달`);
  }
}

/** 이달 누적 (월 한도가 있는 API만 의미 있다) */
export async function getMonthUsage(id: string, month = kst().date.slice(0, 7)): Promise<number> {
  return Number((await kv.get(monthKey(id, month)).catch(() => null)) ?? 0);
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
