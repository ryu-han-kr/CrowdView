// 공공데이터포털(apis.data.go.kr) 공통 호출. DATA_GO_KR_KEY 하나로 활용신청한 API를 모두 쓴다.
import { unstable_cache } from "next/cache";

const BASE = "https://apis.data.go.kr";

export type Item = Record<string, string | number | undefined>;

/**
 * items 배열을 돌려준다. 응답 형식 파라미터(type, _type, dataType)는 API마다 달라 호출부에서 넘긴다.
 * revalidate(초)를 주면 그 시간 동안 캐시한다. 단 결과가 있을 때만 저장한다:
 * 기상청 NO_DATA처럼 200으로 오는 일시적 빈 응답이 캐시에 남아 한 시간 동안 고장 나는 것을 막는다.
 * cache: "no-store"는 쓰지 않는다 (ISR 페이지에서 정적 렌더링이 깨진다).
 */
export async function dataGoKr(path: string, params: Record<string, string>, revalidate?: number): Promise<Item[]> {
  // 같은 요청이 동시에 여러 번 나가지 않게 진행 중인 호출을 공유한다 (예: 시도별 미세먼지를 장소 8곳이 동시에 요청)
  const key = `${path}?${JSON.stringify(params)}:${revalidate ?? 0}`;
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = load(path, params, revalidate).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

const inflight = new Map<string, Promise<Item[]>>();

async function load(path: string, params: Record<string, string>, revalidate?: number): Promise<Item[]> {
  if (!revalidate) return fetchItems(path, params);
  try {
    return await cachedNonEmpty(path, JSON.stringify(params), revalidate);
  } catch (e) {
    if (e instanceof EmptyResult) return [];
    throw e;
  }
}

class EmptyResult extends Error {}

// unstable_cache는 함수가 예외를 던지면 저장하지 않는다 → 빈 결과는 예외로 바꿔 캐시를 건너뛴다
const cachedNonEmpty = (path: string, paramsJson: string, revalidate: number) =>
  unstable_cache(
    async () => {
      const items = await fetchItems(path, JSON.parse(paramsJson));
      if (!items.length) throw new EmptyResult(path);
      return items;
    },
    ["datagokr", path, paramsJson],
    { revalidate },
  )();

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
  const qs = new URLSearchParams({ serviceKey: key, pageNo: "1", numOfRows: "100", ...params });
  const res = await fetch(`${BASE}${path}?${qs}`, { signal: AbortSignal.timeout(8000) });
  const text = await res.text();
  // 활용신청 전이면 403 + SERVICE_KEY_IS_NOT_REGISTERED_ERROR
  const errMsg = text.match(/"errMsg":\s*"([^"]+)"/)?.[1];
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
