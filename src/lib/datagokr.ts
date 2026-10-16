// 공공데이터포털(apis.data.go.kr) 공통 호출. DATA_GO_KR_KEY 하나로 활용신청한 API를 모두 쓴다.
import { apiOfPath, beforeCall, markExhausted } from "./api-quota";
import { cached, shortHash } from "./cached";

const BASE = "https://apis.data.go.kr";
const inflight = new Map<string, Promise<Item[]>>();

export type Item = Record<string, string | number | undefined>;

/**
 * items 배열을 돌려준다. 응답 형식 파라미터(type, _type, dataType)는 API마다 달라 호출부에서 넘긴다.
 * revalidate(초)를 주면 그동안 원본을 다시 부르지 않는다 (메모리 → Redis 캐시, lib/cached.ts).
 * 빈 결과는 저장하지 않고, 원본이 실패하거나 하루 한도에 걸리면 마지막으로 받은 데이터를 쓴다.
 * revalidate가 없으면 매번 원본을 부른다 (10분 수집기가 부르는 실시간 공항 혼잡도. 결과는 수집기가 Redis에 저장)
 */
export async function dataGoKr(path: string, params: Record<string, string>, revalidate?: number): Promise<Item[]> {
  if (!revalidate) {
    // 같은 요청이 동시에 여러 번 나가지 않게 공유 (예: 김포·제주·김해가 같은 한국공항공사 API를 동시에 요청)
    const key = `${path}?${JSON.stringify(params)}`;
    const pending = inflight.get(key);
    if (pending) return pending;
    const p = fetchItems(path, params).finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }
  return cached(`dg:${path}:${shortHash(JSON.stringify(params))}`, revalidate, () => fetchItems(path, params), (v) => v.length === 0);
}

// 공공데이터포털 게이트웨이는 한 키로 동시에 많이 부르면 응답을 늦춘다 (타임아웃).
// 수집기가 16곳을 한꺼번에 갱신해도 동시에 나가는 호출은 MAX_CONCURRENT개로 제한한다
const MAX_CONCURRENT = 6;
let running = 0;
const waiting: (() => void)[] = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) await new Promise<void>((r) => waiting.push(r));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

function fetchItems(path: string, params: Record<string, string>): Promise<Item[]> {
  return withSlot(() => fetchItemsNow(path, params));
}

async function fetchItemsNow(path: string, params: Record<string, string>): Promise<Item[]> {
  const key = process.env.DATA_GO_KR_KEY;
  if (!key) throw new Error("DATA_GO_KR_KEY 미설정");
  // 하루 한도 집계·보호 (lib/api-quota.ts). 한도 90%면 QuotaError → 캐시의 마지막 데이터를 쓴다
  const api = apiOfPath(path);
  await beforeCall(api);
  const qs = new URLSearchParams({ serviceKey: key, pageNo: "1", numOfRows: "100", ...params });
  const res = await fetch(`${BASE}${path}?${qs}`, { signal: AbortSignal.timeout(8000) });
  const text = await res.text();
  // 활용신청 전이면 403 + SERVICE_KEY_IS_NOT_REGISTERED_ERROR
  const errMsg = text.match(/"errMsg":\s*"([^"]+)"/)?.[1] ?? text.match(/<returnAuthMsg>([^<]+)</)?.[1];
  if (errMsg?.includes("LIMITED_NUMBER_OF_SERVICE_REQUESTS")) await markExhausted(api);
  if (!res.ok || errMsg) throw new Error(`${path} ${res.status}: ${errMsg ?? text.slice(0, 80)}`);
  let json: { response?: { body?: unknown }; body?: unknown };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${path}: non-JSON response ${text.slice(0, 120)}`);
  }
  const body = (json.response?.body ?? json.body) as { items?: { item?: Item | Item[] } | Item[] | "" } | undefined;
  if (!body) throw new Error(`${path}: unexpected payload`);
  const items = body.items;
  if (!items) return [];
  const item = Array.isArray(items) ? items : items.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

/** YYYY-MM-DD → YYYYMMDD */
export const ymd = (date: string) => date.replaceAll("-", "");
