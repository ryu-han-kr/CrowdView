// 캐싱 전략
// - 예약 호출(QStash 10분, Vercel Cron 하루 1번)이 refreshAll() 로 미리 채워 둔다.
// - 15분 이내 데이터는 신선(fresh) → 그대로 반환. 수집기가 10분마다 돌아서 사용자 요청은 외부 API를 부르지 않는다.
// - 15분 초과(stale) → 캐시를 즉시 반환하고 백그라운드에서 갱신 (SWR).
// - 외부 API 장애 → 기존 데이터를 보존(보관 TTL 연장)하고 "n분 전 데이터"로 표시.
import { after } from "next/server";
import { kv } from "../cache";
import { getLivePlace, getLivePlaces } from "../place-info";
import type { CrowdResult, CrowdSnapshot, Place } from "../types";
import { recordHistory } from "./history";
import { fetchSnapshot } from "./provider";
import { modelSnapshot } from "./model";

const FRESH_SECONDS = 15 * 60;
// 수집기가 멈췄을 때만 사용자 요청이 갱신을 맡는다. 동시에 몰려도 장소당 1번만 부르도록 잠근다
const LOCK_SECONDS = 60;
const KEEP_SECONDS = 6 * 60 * 60;

const cacheKey = (p: Place) => `crowd:${p.category}:${p.id}`;

function toResult(s: CrowdSnapshot): CrowdResult {
  const ageMinutes = Math.max(0, Math.floor((Date.now() - Date.parse(s.updatedAt)) / 60_000));
  return { ...s, ageMinutes, stale: ageMinutes * 60 > FRESH_SECONDS };
}

// 장소 여러 곳을 Redis 명령 1번(MGET)으로 읽는다
async function readCaches(places: Place[]): Promise<(CrowdSnapshot | null)[]> {
  try {
    const raws = await kv.mget(places.map(cacheKey));
    return raws.map((raw) => (raw ? (JSON.parse(raw) as CrowdSnapshot) : null));
  } catch {
    return places.map(() => null);
  }
}

async function readCache(p: Place): Promise<CrowdSnapshot | null> {
  try {
    const raw = await kv.get(cacheKey(p));
    return raw ? (JSON.parse(raw) as CrowdSnapshot) : null;
  } catch {
    return null;
  }
}

async function refresh(p: Place, previous: CrowdSnapshot | null): Promise<CrowdSnapshot> {
  let snap: CrowdSnapshot;
  try {
    snap = await fetchSnapshot(p);
  } catch (err) {
    console.warn(`[crowd] ${p.id} fetch failed:`, err);
    if (previous) {
      // Fallback: 이전 데이터 유지 + 보관 TTL 연장
      await kv.set(cacheKey(p), JSON.stringify(previous), KEEP_SECONDS).catch(() => {});
      return previous;
    }
    snap = modelSnapshot(p);
  }
  await kv.set(cacheKey(p), JSON.stringify(snap), KEEP_SECONDS).catch(() => {});
  await recordHistory(snap).catch(() => {});
  return snap;
}

export async function getCrowd(id: string): Promise<CrowdResult | null> {
  const place = await getLivePlace(id);
  if (!place) return null;
  return getCrowdFor(place, await readCache(place));
}

async function getCrowdFor(place: Place, cached: CrowdSnapshot | null): Promise<CrowdResult> {
  if (!cached) return toResult(await refresh(place, null));

  const result = toResult(cached);
  if (result.stale) {
    after(async () => {
      if (await kv.setNX(`lock:refresh:${place.id}`, "1", LOCK_SECONDS).catch(() => false)) await refresh(place, cached);
    });
  }
  return result;
}

export async function getAllCrowd(): Promise<Record<string, CrowdResult>> {
  const places = await getLivePlaces();
  const cached = await readCaches(places);
  const results = await Promise.all(places.map((p, i) => getCrowdFor(p, cached[i])));
  return Object.fromEntries(results.map((r) => [r.placeId, r]));
}

export async function refreshAll(): Promise<{ id: string; source: string; updatedAt: string }[]> {
  const places = await getLivePlaces();
  const cached = await readCaches(places);
  return Promise.all(
    places.map(async (p, i) => {
      const s = await refresh(p, cached[i]);
      return { id: p.id, source: s.source, updatedAt: s.updatedAt };
    }),
  );
}
