// 요즘 뜨는 곳 (사용자 10/22: '지금 붐비는 TOP 5' 대신 유명하고 화제인 곳·이벤트를 매일 자동으로)
// 1) 네이버 검색어 트렌드로 우리 장소·다가오는 축제의 최근 7일 검색량과 증가율 → 순위
// 2) ANTHROPIC_API_KEY가 있으면 AI 웹 검색으로 찾은 화제 행사(예: 에버랜드 할로윈)를 맨 앞에
// 수집기(cron)가 하루 한 번 계산해 Redis에 저장하고, 홈은 읽기만 한다
import { aiEventsEnabled, fetchAiEvents, type AiEvent } from "./ai-events";
import { APIS, beforeCall } from "./api-quota";
import { kv } from "./cache";
import { naverDatalabKeys, SEARCH_TREND_URL, searchTrendHeaders } from "./crowd/extra-signals";
import { festivalHref, getFestivals, isLongRunning } from "./festivals";
import { heroImage } from "./place-photos";
import { PLACES, placeHref } from "./places";
import { addDays, kst } from "./time";

export interface TrendItem {
  id: string;
  kind: "place" | "festival" | "event";
  title: string;
  href: string;
  /** 바깥 주소(기사·공식 사이트)면 새 창 */
  external?: boolean;
  img?: string;
  /** 왜 떴는지 (예: 검색량 2.1배 · AI가 찾은 화제 행사) */
  reason: string;
  /** 검색량 지수 (기준 키워드 대비) */
  index?: number;
  /** 최근 7일 ÷ 그 전 3주 */
  rising?: number;
  period?: string;
  region?: string;
}

export interface Trending {
  date: string;
  items: TrendItem[];
  ai: AiEvent[];
}

const KEY = "trending:v1";
/** 모든 묶음에 같이 넣어 묶음끼리 비교하는 기준 키워드 */
const ANCHOR = "에버랜드";

/** 검색어로 쓸 이름: 회차·연도·괄호 떼기 */
export function trendKeyword(name: string): string {
  return name
    .replace(/\[[^\]]*\]|\([^)]*\)|（[^）]*）/g, " ")
    .replace(/제?\s*\d+\s*회|20\d\d|\d{4}년/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20);
}

/** 기준 + 4개씩 묶어 최근 28일 일별 비율 → 키워드별 {최근 7일 평균, 그 전 3주 평균} (기준 키워드 최근 7일 = 100으로 맞춤) */
async function searchVolumes(keywords: string[]): Promise<Map<string, { recent: number; prev: number }>> {
  const keys = naverDatalabKeys();
  const out = new Map<string, { recent: number; prev: number }>();
  if (!keys) return out;
  const today = kst().date;
  const uniq = [...new Set(keywords.filter((k) => k && k !== ANCHOR))];
  for (let i = 0; i < uniq.length; i += 4) {
    const group = uniq.slice(i, i + 4);
    await beforeCall(APIS.find((a) => a.id === "naver-searchtrend"));
    const res = await fetch(SEARCH_TREND_URL, {
      method: "POST",
      headers: searchTrendHeaders(keys),
      body: JSON.stringify({
        startDate: addDays(today, -28),
        endDate: addDays(today, -1),
        timeUnit: "date",
        keywordGroups: [ANCHOR, ...group].map((k) => ({ groupName: k, keywords: [k] })),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`search-trend ${res.status}`);
    const j = (await res.json()) as { results?: { title: string; data?: { period: string; ratio: number }[] }[] };
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const series = new Map((j.results ?? []).map((r) => [r.title, (r.data ?? []).map((d) => d.ratio)]));
    const anchor = series.get(ANCHOR) ?? [];
    const base = avg(anchor.slice(-7)) || 1;
    for (const k of group) {
      const s = series.get(k) ?? [];
      out.set(k, { recent: (avg(s.slice(-7)) / base) * 100, prev: (avg(s.slice(0, -7)) / base) * 100 });
    }
  }
  return out;
}

/** 우리 장소·축제 순위 (검색량) + AI 화제 행사 → 저장. 수집기가 하루 한 번 */
export async function refreshTrending(): Promise<number> {
  const today = kst().date;
  const places = PLACES.filter((p) => p.category !== "airport" && (p.category !== "event" || (p.eventDate && p.eventDate <= addDays(today, 14) && (p.eventEndDate ?? p.eventDate) >= today)));
  const festivals = (await getFestivals(14).catch(() => [])).filter((f) => !isLongRunning(f) && f.image).slice(0, 24);
  const cands = [
    ...places.map((p) => ({ kind: "place" as const, id: p.id, kw: trendKeyword(p.name), title: p.name, href: placeHref(p), img: heroImage(p), region: p.region })),
    ...festivals.map((f) => ({
      kind: "festival" as const,
      id: f.id,
      kw: trendKeyword(f.title),
      title: f.title,
      href: festivalHref(f),
      img: f.image,
      region: f.region,
      period: `${f.start.slice(5).replace("-", "/")}~${f.end.slice(5).replace("-", "/")}`,
    })),
  ];
  const [vol, ai] = await Promise.all([
    searchVolumes(cands.map((c) => c.kw)).catch(() => new Map<string, { recent: number; prev: number }>()),
    aiEventsEnabled() ? fetchAiEvents().catch(() => [] as AiEvent[]) : Promise.resolve([] as AiEvent[]),
  ]);
  // 점수: 검색량(로그) + 오름세. 검색이 거의 없는 곳(기준의 3% 미만)은 뺀다
  const scored = cands
    .map((c) => {
      const v = vol.get(c.kw);
      if (!v || v.recent < 3) return undefined;
      const rising = v.prev > 0.5 ? v.recent / v.prev : v.recent > 3 ? 3 : 1;
      return { ...c, index: v.recent, rising, score: Math.log10(1 + v.recent) + 0.6 * Math.log2(Math.min(rising, 8)) };
    })
    .filter((c): c is NonNullable<typeof c> => !!c)
    .sort((a, b) => b.score - a.score);
  const items: TrendItem[] = scored.slice(0, 12).map((c) => ({
    id: c.id,
    kind: c.kind,
    title: c.title,
    href: c.href,
    img: c.img,
    region: c.region,
    period: "period" in c ? c.period : undefined,
    index: Math.round(c.index),
    rising: Math.round(c.rising * 10) / 10,
    reason: c.rising >= 1.5 ? `검색량 ${c.rising.toFixed(1)}배` : "요즘 많이 찾는 곳",
  }));
  // AI 행사: 우리 장소 이름이 들어 있으면 그 장소 상세로, 아니면 기사·공식 주소로
  const aiItems: TrendItem[] = ai.map((e, i) => {
    const place = PLACES.find((p) => e.venue.includes(p.name) || p.name.includes(e.venue) || e.title.includes(p.name));
    return {
      id: `ai-${i}`,
      kind: "event",
      title: e.title,
      href: place ? placeHref(place) : e.url,
      external: !place,
      img: place ? heroImage(place) : undefined,
      region: e.region,
      period: e.start ? `${e.start.slice(5).replace("-", "/")}${e.end ? `~${e.end.slice(5).replace("-", "/")}` : ""}` : undefined,
      reason: e.why || "화제의 행사",
    };
  });
  const data: Trending = { date: today, items: [...aiItems.filter((x) => x.img).slice(0, 3), ...items, ...aiItems.filter((x) => !x.img)], ai };
  if (!data.items.length) return 0;
  await kv.set(KEY, JSON.stringify(data), 3 * 86_400);
  return data.items.length;
}

export async function getTrending(): Promise<Trending | undefined> {
  const raw = await kv.get(KEY).catch(() => null);
  return raw ? (JSON.parse(raw) as Trending) : undefined;
}

/** 오늘 계산했는지 (수집기가 5분마다 확인 → 배포 직후에도 곧 채워진다) */
export async function trendingDue(hour: number): Promise<boolean> {
  const t = await getTrending();
  // 매일 6시 이후 첫 실행에 새로 계산
  return !t || (t.date !== kst().date && hour >= 6);
}
