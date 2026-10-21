// 외부 API 응답 캐시: 메모리(인스턴스) → Redis(모든 서버 공유) → 원본 순서로 읽는다.
// - fresh(초) 동안은 원본을 부르지 않는다. 서버가 몇 대든 원본 호출은 fresh마다 한 번 꼴
// - fresh가 지나도 데이터는 더 오래 보관해, 원본이 실패하거나 한도에 걸리면 마지막 데이터를 쓴다
// - 빈 결과는 30분만 기억하고, 받아 둔 데이터가 있으면 그것을 쓴다 (기상청 NO_DATA처럼 일시적인 빈 응답이 오래 남지 않게)
// Next.js 데이터 캐시에 기대지 않아 직접 운영하는 서버로 옮겨도 그대로 동작한다.
import { kv } from "./cache";

interface Entry<T> {
  /** 받아 온 시각 (ms) */
  t: number;
  v: T;
}

const mem = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
// 실패하면 이 시간 뒤에 다시 시도 (원본 장애 때 계속 두드리지 않게).
// 실패 표시는 Redis에도 남겨 모든 서버가 공유한다 — 새로 뜬 서버마다 시간 초과(8초)를 다시 기다리면 화면이 그만큼 늦어진다
const RETRY_MS = 5 * 60 * 1000;
const failKey = (key: string) => `${key}:fail`;
const EMPTY_FRESH = 30 * 60;

const keepSeconds = (fresh: number) => fresh + Math.max(fresh, 6 * 60 * 60);

/**
 * key: 캐시 키, fresh: 원본을 다시 부르기까지 초, load: 원본 호출.
 * isEmpty가 true인 결과는 30분만 기억하고, 비어 있지 않은 이전 데이터가 있으면 그것을 돌려준다.
 */
export function cached<T>(key: string, fresh: number, load: () => Promise<T>, isEmpty: (v: T) => boolean = () => false): Promise<T> {
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const p = read(key, fresh, load, isEmpty).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function read<T>(key: string, fresh: number, load: () => Promise<T>, isEmpty: (v: T) => boolean): Promise<T> {
  const now = Date.now();
  const isFresh = (e: Entry<unknown> | null | undefined) => !!e && now - e.t < fresh * 1000;

  const local = mem.get(key);
  if (isFresh(local)) return local!.v as T;

  let shared: Entry<T> | null = null;
  let failedRecently = false;
  try {
    const [raw, failed] = await kv.mget([key, failKey(key)]);
    shared = raw ? (JSON.parse(raw) as Entry<T>) : null;
    failedRecently = !!failed;
  } catch {
    shared = null;
  }
  if (isFresh(shared)) {
    mem.set(key, shared!);
    return shared!.v;
  }

  // 오래된 데이터라도 비어 있지 않으면 장애·빈 응답 때 대신 쓴다
  const prev = shared ?? (local as Entry<T> | undefined) ?? null;
  const stale = prev && !isEmpty(prev.v) ? prev : null;
  if (failedRecently) {
    if (stale) return stale.v;
    throw new Error(`${key}: 원본이 최근 실패해 ${RETRY_MS / 60000}분 동안 다시 부르지 않음`);
  }
  try {
    const v = await load();
    if (isEmpty(v)) {
      if (stale) return stale.v;
      // 빈 결과(공휴일 없는 달, 아직 발표 전인 날짜 등)는 짧게만(최대 30분) 기억해 매번 다시 부르지 않게 한다
      const empty = { t: now - (fresh - Math.min(fresh, EMPTY_FRESH)) * 1000, v };
      mem.set(key, empty);
      await kv.set(key, JSON.stringify(empty), Math.min(fresh, EMPTY_FRESH)).catch(() => {});
      return v;
    }
    const entry = { t: now, v };
    mem.set(key, entry);
    await kv.set(key, JSON.stringify(entry), keepSeconds(fresh)).catch(() => {});
    return v;
  } catch (e) {
    await kv.set(failKey(key), "1", RETRY_MS / 1000).catch(() => {});
    if (!stale) throw e;
    // 마지막 데이터를 쓰고, 잠시 뒤 다시 시도
    mem.set(key, { t: now - fresh * 1000 + Math.min(RETRY_MS, fresh * 1000), v: stale.v });
    return stale.v;
  }
}

/** 키에 넣기 좋은 짧은 해시 */
export function shortHash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36) + s.length.toString(36);
}
