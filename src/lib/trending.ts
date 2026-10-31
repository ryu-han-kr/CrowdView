// 요즘 뜨는 곳 (사용자 10/22: '지금 붐비는 TOP 5' 대신 유명하고 화제인 곳·이벤트를 매일 자동으로)
// 1) 네이버 검색어 트렌드로 우리 장소·다가오는 축제의 최근 7일 검색량과 증가율 → 순위
// 2) ANTHROPIC_API_KEY가 있으면 AI 웹 검색으로 찾은 화제 행사(예: 에버랜드 할로윈)를 맨 앞에
// 수집기(cron)가 하루 한 번 계산해 Redis에 저장하고, 홈은 읽기만 한다
import { aiEventsEnabled, fetchAiEvents, type AiEvent } from "./ai-events";
import { APIS, beforeCall } from "./api-quota";
import { kv } from "./cache";
import { naverDatalabKeys, SEARCH_TREND_URL, searchTrendHeaders } from "./crowd/extra-signals";
import { festivalHref, getFestivals, isLongRunning } from "./festivals";
import { summarizeNews } from "./news-summary";
import { heroImage } from "./place-photos";
import { REGIONS, inRegion } from "./korea";
import { PLACES, placeHref } from "./places";
import { addDays, kst } from "./time";
import type { Place } from "./types";
import { cleanTitle, searchNews, strip, webSearchEnabled, type NewsHit } from "./web-search";

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

/** 장소별 최근 소식 (장소 상세 '최근 소식') */
export interface PlaceNews {
  date: string;
  hits: NewsHit[];
  /** AI가 기사로 정리한 '지금 이슈' 한 줄 (언어별). 방문과 상관없는 기사뿐이면 없다 */
  summary?: Record<string, string>;
}
const newsKey = (placeId: string) => `news:v1:${placeId}`;
export async function getPlaceNews(placeId: string): Promise<PlaceNews | undefined> {
  const raw = await kv.get(newsKey(placeId)).catch(() => null);
  return raw ? (JSON.parse(raw) as PlaceNews) : undefined;
}

/** 뉴스 제목이 '행사·시즌 이벤트' 소식인지 */
const EVENT_WORDS = /할로윈|핼러윈|크리스마스|축제|페스티벌|시즌|이벤트|퍼레이드|불꽃축제|불꽃쇼|개장|팝업|빛축제|라이트쇼|단풍|벚꽃|눈썰매|야간개장|콘서트|특별 공연/;
/** 방문과 상관없는 기사 (운영 시험 10/22: "직원 소방 대결"이 이벤트로 잡힘) */
const NOT_EVENT = /직원|사고|논란|소방|훈련|채용|주가|실적|부상|사망|화재|민원|소송|노조|적자|매각|과징금/;
/** 커뮤니티 글은 소식으로 쓰지 않는다 */
const COMMUNITY = /ruliweb|fmkorea|dcinside|theqoo|instiz|clien|ppomppu|pann.nate|bobaedream|mlbpark|inven|todayhumor|blog.|cafe./;
const isEvent = (h: NewsHit) => EVENT_WORDS.test(h.title) && !NOT_EVENT.test(h.title);

const squash = (s: string) => s.replace(/[\s·,\-]/g, "");
/** AI가 쓴 시·도 이름(서울특별시·경상남도 등) → 짧은 이름(서울·경남). 모르면 빈 값 */
const LONG_REGION: Record<string, string> = { 충청북도: "충북", 충청남도: "충남", 전라북도: "전북", 전북특별자치도: "전북", 전라남도: "전남", 경상북도: "경북", 경상남도: "경남", 강원특별자치도: "강원", 강원도: "강원", 경기도: "경기", 제주특별자치도: "제주", 제주도: "제주" };
function shortRegion(region: string): string {
  const first = region.trim().split(/[\s·,/]/)[0] ?? "";
  const r = LONG_REGION[first] ?? first.replace(/(특별시|광역시|특별자치시)$/, "");
  return REGIONS.some((x) => x.id === r) ? r : "";
}

/**
 * AI 화제 행사 → 우리 장소 (그 장소 상세로 보낼지). 11/1 감사: 예전엔 `PLACES.find(venue ⊃ 이름 || 이름 ⊃ venue || 제목 ⊃ 이름)`이라
 * 장소가 '광안리'면 짱오락실 부산광안리점, 빈 장소면 맨 앞 장소(롯데월드), '롯데월드 어드벤처 부산 할로윈'이면 서울 롯데월드로 갔다.
 * 이제: 지역이 맞는 곳 중 장소 이름이 같음 > 장소 칸에 우리 이름이 통째로 > 제목에 우리 이름이 통째로 > 우리 이름에 장소 칸이 통째로(3글자 이상).
 * 실내 매장은 이름이 같거나 장소 칸에 통째로 있을 때만. 같은 단계면 장소 칸·제목에 든 쪽은 더 긴(구체적인) 이름, 장소 칸을 품는 쪽은 더 짧은(가까운) 이름
 */
export function placeForEvent(e: Pick<AiEvent, "title" | "venue" | "region">, places: readonly Place[] = PLACES): Place | undefined {
  const venue = squash(e.venue);
  const title = squash(e.title);
  const region = shortRegion(e.region);
  let top: { p: Place; s: number } | undefined;
  for (const p of places) {
    if (p.category === "airport") continue;
    if (region && !inRegion(p.region, region)) continue;
    const name = squash(p.name);
    if (name.length < 2) continue;
    const indoor = p.category === "indoor";
    // 정수 부분 = 단계, 소수 부분 = 같은 단계 안 순서
    const s =
      venue && venue === name
        ? 4
        : venue && name.length >= 3 && venue.includes(name)
          ? 3 + name.length / 100
          : !indoor && name.length >= 3 && title.includes(name)
            ? 2 + name.length / 100
            : !indoor && venue.length >= 3 && name.includes(venue)
              ? 1 + (1 - name.length / 100)
              : 0;
    if (s && (!top || s > top.s)) top = { p, s };
  }
  return top?.p;
}

/**
 * 뉴스 제목이 이 장소 이야기인지: 짧은 이름이 들어 있고, 그 이름을 품은 다른 우리 장소(더 긴 이름)의 기사가 아닐 때.
 * 예: '롯데월드 어드벤처 부산 할로윈'은 서울 롯데월드 어드벤처(짧은 이름 '롯데월드')의 소식이 아니다
 */
export function newsTitleFits(p: Place, short: string, title: string, places: readonly Place[] = PLACES): boolean {
  if (!title.includes(short)) return false;
  const t = squash(title);
  const mine = squash(p.name);
  const s = squash(short);
  return !places.some((q) => {
    if (q.id === p.id) return false;
    const other = squash(q.name);
    return other.length > mine.length && other.includes(s) && !mine.includes(other) && t.includes(other);
  });
}

/** 소식을 볼 장소: 사람이 찾아가는 곳 (공항·행사 장소 제외), 스키장은 11~3월만 */
function newsPlaces(month: number) {
  return PLACES.filter(
    (p) => ["themepark", "waterpark", "street", "landmark", "beach", "indoor"].includes(p.category) || (p.category === "ski" && (month >= 11 || month <= 3)),
  );
}

/** 장소마다 최근 1주 뉴스 → 관련 있는 것(이름이 제목에 있는 것)만 3개 저장. 행사 소식은 요즘 뜨는 곳 후보로 */
async function refreshPlaceNews(today: string): Promise<TrendItem[]> {
  if (!webSearchEnabled()) return [];
  const month = Number(today.slice(5, 7));
  const events: TrendItem[] = [];
  // 하루에 절반씩 (짝수·홀수 날 번갈아) → 장소마다 이틀에 한 번, Brave 하루 약 20건 (월 $5 무료 크레딧 안). 소식은 3일 저장이라 빈틈 없음
  const day = Math.floor(Date.parse(today) / 86_400_000);
  for (const [i, p] of newsPlaces(month).entries()) {
    const short = p.name.replace(/\s*(어드벤처|스키장|해수욕장|카페거리|걷고싶은거리)$/, "");
    // 오늘 차례가 아닌 곳은 저장해 둔 소식으로 행사 후보만 다시 고른다 (검색 안 함)
    if (i % 2 !== day % 2) {
      const ev = (await getPlaceNews(p.id))?.hits.find(isEvent);
      if (ev) events.push(newsEvent(p, ev));
      continue;
    }
    // Brave 무료 플랜은 1초에 1건 → 장소 사이 1.1초 (저장된 검색어면 바로 넘어간다)
    await new Promise((r) => setTimeout(r, 1100));
    // 12시간 저장된 예전 결과도 제목을 다시 다듬는다
    const tidy = (xs: NewsHit[]) => xs.map((h) => ({ ...h, title: cleanTitle(strip(h.title)) })).filter((h) => !COMMUNITY.test(h.source));
    const base = tidy(await searchNews(p.name, 7));
    const extra = p.category === "themepark" ? await (async () => (await new Promise((r) => setTimeout(r, 1100)), searchNews(`${short} 이벤트`, 7)))().then(tidy) : [];
    const hits = [...extra.filter(isEvent), ...base]
      .filter((h, i, arr) => newsTitleFits(p, short, h.title) && arr.findIndex((x) => x.url === h.url) === i)
      .slice(0, 3);
    if (!hits.length) continue;
    // 기사가 그대로면 지난 요약을 다시 쓰고, 바뀐 날에만 AI를 부른다
    const prev = await getPlaceNews(p.id);
    const same = prev?.hits.map((h) => h.url).join() === hits.map((h) => h.url).join();
    const summary = same ? prev?.summary : await summarizeNews(p.name, hits).catch(() => undefined);
    await kv.set(newsKey(p.id), JSON.stringify({ date: today, hits, summary } satisfies PlaceNews), 3 * 86_400).catch(() => {});
    const ev = hits.find(isEvent);
    if (ev) events.push(newsEvent(p, ev));
  }
  return events;
}

function newsEvent(p: (typeof PLACES)[number], ev: NewsHit): TrendItem {
  return {
    id: `news-${p.id}`,
    kind: "event",
    title: ev.title.length > 40 ? `${ev.title.slice(0, 39)}…` : ev.title,
    href: placeHref(p),
    img: heroImage(p),
    region: p.region,
    reason: `뉴스 · ${ev.source}`,
  };
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
  if (!uniq.length) return out;
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
    if (!out.has(ANCHOR) && anchor.length) out.set(ANCHOR, { recent: 100, prev: (avg(anchor.slice(0, -7)) / base) * 100 });
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
  const [vol, ai, newsEvents] = await Promise.all([
    searchVolumes(cands.map((c) => c.kw)).catch(() => new Map<string, { recent: number; prev: number }>()),
    aiEventsEnabled() ? fetchAiEvents().catch(() => [] as AiEvent[]) : Promise.resolve([] as AiEvent[]),
    refreshPlaceNews(today).catch(() => [] as TrendItem[]),
  ]);
  // 점수: 검색량(로그) + 오름세. 검색이 거의 없는 곳(기준의 3% 미만)은 뺀다
  const scored = cands
    .map((c) => {
      const v = vol.get(c.kw);
      if (!v || v.recent < 3) return undefined;
      const rising = v.prev > 0.5 ? v.recent / v.prev : v.recent > 3 ? 3 : 1;
      const lift = 0.4 * Math.log2(Math.min(Math.max(rising, 0.5), 6)) * (v.recent >= 10 ? 1 : 0.35);
      return { ...c, index: v.recent, rising, score: Math.log10(1 + v.recent) + lift };
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
    const place = placeForEvent(e);
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
  // 순서: AI 화제 행사(사진 있는 것) → 뉴스로 찾은 시즌 이벤트 2개 → 검색량 순위 → 나머지 AI 행사. 같은 장소는 한 번만
  const seen = new Set<string>();
  const merged = [...aiItems.filter((x) => x.img).slice(0, 3), ...newsEvents.slice(0, 2), ...items, ...aiItems.filter((x) => !x.img)].filter((x) => {
    const k = x.external ? x.href : x.href.split("#")[0];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const data: Trending = { date: today, items: merged, ai };
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
