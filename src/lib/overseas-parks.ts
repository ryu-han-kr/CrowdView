// 해외 테마파크 지금 대기시간 (경수님 10/30: '해외 공항 및 명소 혼잡도'). 한국 여행자가 많이 가는 아시아 공원부터.
// ThemeParks.wiki 무료 API (상업 이용 가능, "Powered by ThemeParks.wiki" 표기 필수) — 국내 테마파크와 같은 출처(lib/crowd/themeparks).
// 유니버설 싱가포르(대기시간 비어 있음)는 자료가 살아나면 넣는다. 오션파크 홍콩은 11/1 갱신이 살아나 넣음
// 11/1 경수님 '해외 탭 나라별로': 나라(country) 칸 + 미국·프랑스·후지큐 추가
import { levelOf, scoreFromValue, type Level, type LevelSteps } from "./levels";

const API = "https://api.themeparks.wiki/v1/entity";
// 몇 시간째 갱신이 없는 대기시간은 버린다 (운영 종료 후 마지막 값이 남아 있음, lib/crowd/themeparks와 같다)
const STALE_MS = 3 * 60 * 60 * 1000;
// 운영 중 놀이기구 평균 대기(분) 기준: 15분 미만 쾌적 · 25 원활 · 40 보통 · 60 혼잡 · 그 위 매우 혼잡 (디즈니 평일 평균이 15~30분)
const STEPS: LevelSteps = [15, 25, 40, 60];

export interface OverseasPark {
  id: string;
  /** 번역 원본 (한국어) */
  name: string;
  city: string;
  /** 나라 (번역 원본, 해외 화면 나라 칩) */
  country: string;
  /** 국기 이모지 */
  flag: string;
  themeparksId: string;
}

export const OVERSEAS_PARKS: OverseasPark[] = [
  { id: "tokyo-disneyland", name: "도쿄 디즈니랜드", city: "일본 지바", country: "일본", flag: "🇯🇵", themeparksId: "3cc919f1-d16d-43e0-8c3f-1dd269bd1a42" },
  { id: "tokyo-disneysea", name: "도쿄 디즈니씨", city: "일본 지바", country: "일본", flag: "🇯🇵", themeparksId: "67b290d5-3478-4f23-b601-2f8fb71ba803" },
  { id: "usj", name: "유니버설 스튜디오 재팬", city: "일본 오사카", country: "일본", flag: "🇯🇵", themeparksId: "47f61fac-7586-41ac-ae80-61c9257cf33e" },
  { id: "legoland-japan", name: "레고랜드 재팬", city: "일본 나고야", country: "일본", flag: "🇯🇵", themeparksId: "0c14c187-13f5-41ef-91b1-7ecb504239a7" },
  { id: "shanghai-disneyland", name: "상하이 디즈니랜드", city: "중국 상하이", country: "중국", flag: "🇨🇳", themeparksId: "ddc4357c-c148-4b36-9888-07894fe75e83" },
  { id: "universal-beijing", name: "유니버설 스튜디오 베이징", city: "중국 베이징", country: "중국", flag: "🇨🇳", themeparksId: "68e1d8f0-ed42-4351-af25-160421e37ce0" },
  { id: "fuji-q", name: "후지큐 하이랜드", city: "일본 야마나시", country: "일본", flag: "🇯🇵", themeparksId: "ae527507-b1d0-4d40-83ea-143d87bef989" },
  { id: "hongkong-disneyland", name: "홍콩 디즈니랜드", city: "홍콩", country: "홍콩", flag: "🇭🇰", themeparksId: "bd0eb47b-2f02-4d4d-90fa-cb3a68988e3b" },
  { id: "ocean-park-hk", name: "오션파크 홍콩", city: "홍콩", country: "홍콩", flag: "🇭🇰", themeparksId: "1c6cf709-2157-443d-9c4b-d443dd53c0de" },
  { id: "disneyland-paris", name: "디즈니랜드 파리", city: "프랑스 파리", country: "프랑스", flag: "🇫🇷", themeparksId: "dae968d5-630d-4719-8b06-3d107e944401" },
  { id: "disneyland-ca", name: "디즈니랜드 (캘리포니아)", city: "미국 애너하임", country: "미국", flag: "🇺🇸", themeparksId: "7340550b-c14d-4def-80bb-acdb51d49a66" },
  { id: "universal-hollywood", name: "유니버설 스튜디오 할리우드", city: "미국 로스앤젤레스", country: "미국", flag: "🇺🇸", themeparksId: "bc4005c5-8c7e-41d7-b349-cdddf1796427" },
  { id: "magic-kingdom", name: "매직 킹덤 (디즈니 월드)", city: "미국 올랜도", country: "미국", flag: "🇺🇸", themeparksId: "75ea578a-adc8-4116-a54d-dccb60765ef9" },
  { id: "universal-florida", name: "유니버설 스튜디오 플로리다", city: "미국 올랜도", country: "미국", flag: "🇺🇸", themeparksId: "eb3f4560-2383-4a36-9152-6b3e5ed6bc57" },
];

export interface ParkNow {
  park: OverseasPark;
  /** 현지 시간대 (Asia/Tokyo 등) */
  timezone?: string;
  /** 오늘 운영 시간 (현지 ISO) */
  hours?: { open: string; close: string };
  /** 지금 운영 중 (시간표 기준). 모르면 undefined */
  open?: boolean;
  /** 운영 중 놀이기구 평균 대기(분) */
  avgWait?: number;
  level?: Level;
  /** 대기가 긴 놀이기구 3개 */
  top: { name: string; wait: number }[];
  /** 운영 중이면서 대기시간이 있는 놀이기구 수 */
  rides: number;
}

interface LiveItem {
  name: string;
  entityType: string;
  status?: string;
  lastUpdated?: string;
  queue?: { STANDBY?: { waitTime?: number | null } };
}

/** 대기시간 목록 → 평균·단계·상위 3개 (시험용으로 따로) */
export function summarize(items: LiveItem[], now = Date.now()): Pick<ParkNow, "avgWait" | "level" | "top" | "rides"> {
  const waits = items
    .filter((x) => x.entityType === "ATTRACTION" && x.status === "OPERATING" && typeof x.queue?.STANDBY?.waitTime === "number")
    .filter((x) => !x.lastUpdated || now - Date.parse(x.lastUpdated) < STALE_MS)
    .map((x) => ({ name: x.name, wait: x.queue!.STANDBY!.waitTime! }));
  if (!waits.length) return { top: [], rides: 0 };
  const avgWait = Math.round(waits.reduce((s, x) => s + x.wait, 0) / waits.length);
  return { avgWait, level: levelOf(scoreFromValue(avgWait, STEPS)), top: [...waits].sort((a, b) => b.wait - a.wait).slice(0, 3), rides: waits.length };
}

async function get<T>(path: string): Promise<T | null> {
  // 5분 캐시 (페이지 ISR과 같다). no-store를 쓰면 ISR 페이지가 조용히 동적으로 바뀐다
  const res = await fetch(`${API}/${path}`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  return res?.ok ? ((await res.json().catch(() => null)) as T | null) : null;
}

export async function parkNow(park: OverseasPark, now = new Date()): Promise<ParkNow> {
  const [live, sched] = await Promise.all([
    get<{ liveData?: LiveItem[] }>(`${park.themeparksId}/live`),
    get<{ timezone?: string; schedule?: { date: string; type: string; openingTime: string; closingTime: string }[] }>(`${park.themeparksId}/schedule`),
  ]);
  // 오늘(현지) 운영 시간: 지금 시각을 감싸는 OPERATING 구간, 없으면 오늘 날짜의 첫 OPERATING
  const ops = (sched?.schedule ?? []).filter((s) => s.type === "OPERATING");
  const t = now.getTime();
  const cur = ops.find((s) => Date.parse(s.openingTime) <= t && t < Date.parse(s.closingTime));
  const localDate = sched?.timezone ? new Intl.DateTimeFormat("en-CA", { timeZone: sched.timezone }).format(now) : undefined;
  const today = cur ?? ops.find((s) => s.date === localDate);
  return {
    park,
    timezone: sched?.timezone,
    hours: today ? { open: today.openingTime, close: today.closingTime } : undefined,
    open: sched ? !!cur : undefined,
    ...summarize(live?.liveData ?? [], t),
  };
}

export const allParksNow = () => Promise.all(OVERSEAS_PARKS.map((p) => parkNow(p)));
