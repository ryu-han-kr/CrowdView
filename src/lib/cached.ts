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
// 실패하면 이 시간 뒤에 다시 시도 (원본 장애 때 계속 두드리지 않게). 연달아 실패하면 5분 → 15분 → 1시간으로 늘린다
// (10/22: 에어코리아 한 시도가 시간 초과를 반복 → 5분마다 재시도가 하루 호출을 늘렸다).
// 실패 표시는 Redis에도 남겨 모든 서버가 공유한다 — 새로 뜬 서버마다 시간 초과(8초)를 다시 기다리면 화면이 그만큼 늦어진다
const RETRY_MIN = [5, 15, 60];
/** 연속 실패 n번째(1부터) → 다시 부르기까지 ms */
export const retryAfterMs = (n: number) => RETRY_MIN[Math.min(Math.max(n, 1), RETRY_MIN.length) - 1] * 60 * 1000;
const failKey = (key: string) => `${key}:fail`;
/** 연속 실패 횟수 (성공하면 0) */
const failCountKey = (key: string) => `${key}:failn`;
const FAIL_COUNT_KEEP = 3 * 3600;
// 빌드(next build) 중에는 결과를 Redis에 저장하지 못한다(lib/cache buildSafe). 그래서 빌드 작업자마다 같은 원본을 다시 부르고
// 그 호출이 하루 한도에 그대로 잡혔다(10/21 운영 배포 51번). 빌드 중엔 묵은 값이라도 있으면 원본을 부르지 않는다 — 배포 뒤 첫 요청에서 새로 받는다
const building = () => process.env.NEXT_PHASE === "phase-production-build";
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
  let failCount = 0;
  try {
    const [raw, failed, failn] = await kv.mget([key, failKey(key), failCountKey(key)]);
    shared = raw ? (JSON.parse(raw) as Entry<T>) : null;
    failedRecently = !!failed;
    failCount = Number(failn ?? 0) || 0;
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
  if (stale && building()) return stale.v;
  if (failedRecently) {
    if (stale) return stale.v;
    throw new Error(`${key}: 원본이 최근 실패해 잠시 다시 부르지 않음 (연속 ${failCount}번)`);
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
    if (failCount) await kv.set(failCountKey(key), "0", 1).catch(() => {});
    return v;
  } catch (e) {
    const wait = retryAfterMs(failCount + 1);
    await kv.set(failKey(key), "1", wait / 1000).catch(() => {});
    await kv.set(failCountKey(key), String(failCount + 1), FAIL_COUNT_KEEP).catch(() => {});
    if (!stale) throw e;
    // 마지막 데이터를 쓰고, 잠시 뒤 다시 시도
    mem.set(key, { t: now - fresh * 1000 + Math.min(wait, fresh * 1000), v: stale.v });
    return stale.v;
  }
}

/** 키에 넣기 좋은 짧은 해시 */
export function shortHash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36) + s.length.toString(36);
}
