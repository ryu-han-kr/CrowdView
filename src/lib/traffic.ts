// 이용 집계 (사용자 10/24: 광고·제휴 기대수익을 이용자 기준으로 보려고). 개인 정보는 남기지 않는다
// - 날짜마다 해시 하나(t:{날짜})에 횟수만: 페이지뷰·방문(세션)·언어·기기·Plus·광고 노출·제휴 클릭
// - 순방문자는 HyperLogLog(t:{날짜}:uv) — 브라우저의 익명 번호를 넣지만 Redis에는 '대략 몇 개'만 남는다 (누가 왔는지는 알 수 없음)
// - 브라우저가 페이지마다 모아 한 번 보내고(components/TrafficBeacon), 서버는 Redis 요청 1번(pipeline)으로 처리한다
import { kv } from "./cache";
import { addDays, kst } from "./time";
import { LANGS } from "@/i18n/config";

const TTL = 400 * 86_400;
const dayKey = (date: string) => `t:${date}`;
const uvKey = (date: string) => `t:${date}:uv`;

/** 광고 칸 이름 (AdUnit slotName) */
export const AD_SLOT_NAMES = ["rail", "inline"] as const;
/** 제휴 링크를 세는 곳 이름 (StayLinks·TourLinks의 data-aff) */
export const AFF_PARTNERS = ["agoda", "booking", "trip", "airbnb", "expedia", "hotels", "google", "yanolja", "yeogi", "naver", "klook", "kkday", "myrealtrip", "getyourguide", "trip-tour"] as const;

export interface Beacon {
  /** 익명 방문자 번호 (브라우저 localStorage, 무작위) */
  vid: string;
  lang: string;
  mobile: boolean;
  plus: boolean;
  /** 이 탭에서 처음 본 페이지면 true (방문 1번) */
  session: boolean;
  /** 이번에 본 페이지 수 (보통 1) */
  pv: number;
  /** 채워진 광고 칸 이름들 */
  ads: string[];
  /** 누른 제휴 링크들 */
  aff: string[];
}

/** 봇·자동화 브라우저(검색엔진, Lighthouse, Playwright 화면 확인)는 세지 않는다 */
export const isBot = (ua: string) => /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|python|curl|wget|playwright/i.test(ua);

export async function recordBeacon(b: Beacon): Promise<void> {
  const date = kst().date;
  const key = dayKey(date);
  const lang = (LANGS as readonly string[]).includes(b.lang) ? b.lang : "other";
  const inc: Record<string, number> = {};
  const add = (f: string, n = 1) => n > 0 && (inc[f] = (inc[f] ?? 0) + n);
  const pv = Math.min(Math.max(b.pv | 0, 0), 20);
  add("pv", pv);
  add(`pv:${lang}`, pv);
  add(b.mobile ? "pv:m" : "pv:d", pv);
  if (b.plus) add("pv:plus", pv);
  if (b.session) add("ses");
  for (const s of b.ads.slice(0, 5)) if ((AD_SLOT_NAMES as readonly string[]).includes(s)) add(`ad:${s}`), add(`ad:${lang}`);
  for (const a of b.aff.slice(0, 5)) if ((AFF_PARTNERS as readonly string[]).includes(a)) add(`aff:${a}`);
  const cmds: (string | number)[][] = Object.entries(inc).map(([f, n]) => ["HINCRBY", key, f, n]);
  if (!cmds.length) return;
  cmds.push(["EXPIRE", key, TTL]);
  if (pv && /^[a-z0-9]{8,40}$/i.test(b.vid)) cmds.push(["PFADD", uvKey(date), b.vid], ["EXPIRE", uvKey(date), TTL]);
  await kv.pipeline(cmds);
}

export interface DayTraffic {
  date: string;
  /** 순방문자 (하루 안에 여러 번 와도 1명) */
  uv: number;
  /** 방문 (탭을 새로 열 때마다 1번 — 하루에 3번 들어오면 3) */
  sessions: number;
  /** 페이지뷰 (화면을 넘길 때마다 1 — 애드센스 수익은 이 수에 비례) */
  pv: number;
  f: Record<string, number>;
}

export async function getTraffic(days = 14): Promise<DayTraffic[]> {
  const today = kst().date;
  const dates = Array.from({ length: days }, (_, i) => addDays(today, -i));
  const res = await kv.pipeline(dates.flatMap((d) => [["HGETALL", dayKey(d)], ["PFCOUNT", uvKey(d)]])).catch(() => [] as unknown[]);
  return dates.map((date, i) => {
    const raw = (res[i * 2] as string[] | null) ?? [];
    const f: Record<string, number> = {};
    for (let j = 0; j + 1 < raw.length; j += 2) f[raw[j]] = Number(raw[j + 1]);
    return { date, uv: Number(res[i * 2 + 1] ?? 0), sessions: f.ses ?? 0, pv: f.pv ?? 0, f };
  });
}
