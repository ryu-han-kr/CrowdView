// 캐싱 전략
// - Cron(10분)이 refreshAll() 로 미리 채워 둔다.
// - 15분(공항은 5분) 이내 데이터는 신선(fresh) → 그대로 반환.
// - 15분 초과(stale) → 캐시를 즉시 반환하고 백그라운드에서 갱신 (SWR).
// - 외부 API 장애 → 기존 데이터를 보존(보관 TTL 연장)하고 "n분 전 데이터"로 표시.
import { after } from "next/server";
import { kv } from "../cache";
import { PLACES, getPlace } from "../places";
import type { CrowdResult, CrowdSnapshot, Place } from "../types";
import { recordHistory } from "./history";
import { fetchSnapshot } from "./provider";
import { modelSnapshot } from "./model";

const FRESH_SECONDS = 15 * 60;
// 공항 혼잡도는 1분 주기로 바뀌어 더 자주 갱신한다
const freshSeconds = (p: Place) => (p.category === "airport" ? 5 * 60 : FRESH_SECONDS);
const KEEP_SECONDS = 6 * 60 * 60;

const cacheKey = (p: Place) => `crowd:${p.category}:${p.id}`;

function toResult(s: CrowdSnapshot, p: Place): CrowdResult {
  const ageMinutes = Math.max(0, Math.floor((Date.now() - Date.parse(s.updatedAt)) / 60_000));
  return { ...s, ageMinutes, stale: ageMinutes * 60 > freshSeconds(p) };
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
  const place = getPlace(id);
  if (!place) return null;
  return getCrowdFor(place);
}

async function getCrowdFor(place: Place): Promise<CrowdResult> {
  const cached = await readCache(place);
  if (!cached) return toResult(await refresh(place, null), place);

  const result = toResult(cached, place);
  if (result.stale) after(() => refresh(place, cached).then(() => {}));
  return result;
}

export async function getAllCrowd(): Promise<Record<string, CrowdResult>> {
  const results = await Promise.all(PLACES.map(getCrowdFor));
  return Object.fromEntries(results.map((r) => [r.placeId, r]));
}

export async function refreshAll(): Promise<{ id: string; source: string; updatedAt: string }[]> {
  return Promise.all(
    PLACES.map(async (p) => {
      const s = await refresh(p, await readCache(p));
      return { id: p.id, source: s.source, updatedAt: s.updatedAt };
    }),
  );
}
