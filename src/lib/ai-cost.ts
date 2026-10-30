// Claude API 비용 집계 (경수님 10/30: 비용 보고서에 Claude가 빠져 '왜 늘었는지'가 안 보였다).
// aiCreate가 응답의 usage(토큰·웹 검색 수)로 달러를 계산해 하루 단위로 쌓는다 → lib/billing/report
import { kv } from "./cache";
import { kst } from "./time";

// 1M 토큰당 달러 (Anthropic 공식 표, 2026-10 기준). 캐시 쓰기는 입력의 1.25배, 캐시 읽기는 표 값
const PRICE: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};
const SEARCH_USD = 10 / 1000; // 웹 검색 1건
/** 원 환산 (보고서의 다른 달러 고정비와 같은 환율) */
export const USD_KRW = 1400;

interface Usage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
}

/** 한 번 호출의 달러 비용. 표에 없는 모델은 Opus 값으로 (넉넉하게) */
export function aiCostUsd(model: string, u: Usage): number {
  const p = PRICE[model] ?? PRICE["claude-opus-5-5"];
  const tokens =
    (u.input_tokens ?? 0) * p.input + (u.cache_creation_input_tokens ?? 0) * p.input * 1.25 + (u.cache_read_input_tokens ?? 0) * p.cacheRead + (u.output_tokens ?? 0) * p.output;
  return tokens / 1_000_000 + (u.server_tool_use?.web_search_requests ?? 0) * SEARCH_USD;
}

// 정수로 쌓으려고 1/10000 달러(0.01센트) 단위
const UNIT = 10_000;
const costKey = (date: string) => `ai-cost:${date}`;

export async function recordAiCost(model: string, u: Usage): Promise<void> {
  const v = Math.round(aiCostUsd(model, u) * UNIT);
  if (v > 0) await kv.incr(costKey(kst().date), 40 * 86_400, v);
}

/** 날짜별 Claude 비용 (달러) */
export async function aiCostByDay(dates: string[]): Promise<number[]> {
  const raw = await kv.mget(dates.map(costKey)).catch(() => dates.map(() => null));
  return raw.map((x) => Number(x ?? 0) / UNIT);
}
