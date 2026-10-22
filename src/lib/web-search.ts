// 웹·뉴스 검색 (Brave Search · Tavily, 둘 다 무료 플랜). 사용자 10/22: 하루 적당량만 써서 매월 초기화 안에서.
// - Brave: 뉴스 검색이 주력 (장소별 최근 소식·시즌 이벤트). 월 2,000건, 하루 60건까지 (lib/api-quota)
// - Tavily: Brave가 안 될 때 대신. 월 1,000크레딧, 하루 30까지
// 같은 검색어는 12시간 저장(lib/cached) → 같은 날 여러 번 불려도 한 번만 나간다. 빌드 중에는 부르지 않는다
import { APIS, beforeCall } from "./api-quota";
import { cached } from "./cached";

export interface NewsHit {
  title: string;
  url: string;
  description: string;
  /** 언론사·사이트 이름 */
  source: string;
  /** 'n일 전' 등 원문 그대로 또는 ISO 날짜 */
  age?: string;
  img?: string;
}

const HOUR = 3600;
const building = () => process.env.NEXT_PHASE === "phase-production-build";
const strip = (s: unknown) =>
  String(s ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

export const webSearchEnabled = () => !!(process.env.BRAVE_SEARCH_API_KEY || process.env.TAVILY_API_KEY);

async function braveNews(q: string, freshness: string): Promise<NewsHit[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) throw new Error("BRAVE_SEARCH_API_KEY 없음");
  await beforeCall(APIS.find((a) => a.id === "brave-search"));
  const qs = new URLSearchParams({ q, country: "KR", search_lang: "ko", count: "10", freshness });
  const res = await fetch(`https://api.search.brave.com/res/v1/news/search?${qs}`, {
    headers: { Accept: "application/json", "X-Subscription-Token": key },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`brave ${res.status}`);
  const j = (await res.json()) as {
    results?: { title?: string; url?: string; description?: string; age?: string; page_age?: string; meta_url?: { hostname?: string }; thumbnail?: { src?: string } }[];
  };
  return (j.results ?? [])
    .map((r) => ({
      title: strip(r.title),
      url: String(r.url ?? ""),
      description: strip(r.description).slice(0, 300),
      source: String(r.meta_url?.hostname ?? "").replace(/^www\./, ""),
      age: r.page_age ?? r.age,
      img: r.thumbnail?.src,
    }))
    .filter((r) => r.title && /^https?:\/\//.test(r.url));
}

async function tavilyNews(q: string, days: number): Promise<NewsHit[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("TAVILY_API_KEY 없음");
  await beforeCall(APIS.find((a) => a.id === "tavily"));
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query: q, topic: "news", days, max_results: 8, search_depth: "basic", include_answer: false }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`tavily ${res.status}`);
  const j = (await res.json()) as { results?: { title?: string; url?: string; content?: string; published_date?: string }[] };
  return (j.results ?? [])
    .map((r) => {
      let source = "";
      try {
        source = new URL(String(r.url)).hostname.replace(/^www\./, "");
      } catch {}
      return { title: strip(r.title), url: String(r.url ?? ""), description: strip(r.content).slice(0, 300), source, age: r.published_date };
    })
    .filter((r) => r.title && /^https?:\/\//.test(r.url));
}

/**
 * 최근 뉴스 검색. Brave 먼저, 실패·한도면 Tavily. 결과는 12시간 저장.
 * days: 며칠 안 기사 (Brave는 1·7·31일 단위로 맞춘다)
 */
export function searchNews(q: string, days = 7): Promise<NewsHit[]> {
  const freshness = days <= 1 ? "pd" : days <= 7 ? "pw" : "pm";
  return cached(
    `ws:news:${freshness}:${q}`,
    12 * HOUR,
    async () => {
      if (building()) throw new Error("빌드 중에는 검색하지 않음");
      try {
        return await braveNews(q, freshness);
      } catch (e) {
        if (!process.env.TAVILY_API_KEY) throw e;
        return tavilyNews(q, days);
      }
    },
    (v) => v.length === 0,
  ).catch(() => []);
}
