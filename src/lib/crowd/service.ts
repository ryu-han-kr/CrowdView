// 캐싱 전략
// - 예약 호출(Vercel Cron 5분)이 refreshAll() 로 미리 채워 둔다. 장소마다 주기가 다르다 (lib/crowd/cadence:
//   운영 중 놀이공원 5분, 서울·공항 10분, 문 닫은 시간·추정 장소 30분) → 주기가 안 된 장소는 건너뛴다.
// - 주기 + 5분 이내 데이터는 신선(fresh) → 그대로 반환. 수집기가 먼저 받아 두니 사용자 요청은 외부 API를 부르지 않는다.
// - 그보다 오래됐으면(stale) → 캐시를 즉시 반환하고 백그라운드에서 갱신 (SWR).
// - 외부 API 장애 → 기존 데이터를 보존(보관 TTL 연장)하고 "n분 전 데이터"로 표시.
import { after } from "next/server";
import { kv } from "../cache";
import { getLivePlace, getLivePlaces } from "../place-info";
import type { CrowdResult, CrowdSnapshot, Place } from "../types";
import { recordHistory } from "./history";
import { fetchSnapshot } from "./provider";
import { withBias } from "./bias";
import { cadenceMinutes, isDue } from "./cadence";
import { modelSnapshot } from "./model";

/** 수집 주기 뒤 이만큼까지는 신선한 것으로 본다 (수집기가 한 번 놓쳐도 사용자 요청이 원천을 두드리지 않게) */
const FRESH_GRACE_SECONDS = 5 * 60;
// 화면의 '갱신 지연' 표시: 수집기(10분)가 세 번 넘게 연달아 못 받아 왔을 때만. 한 번 놓친 정도(20분)는 'n분 전 갱신'으로 충분하다
// (운영 알림·/methodology 설명과 같은 40분)
const STALE_LABEL_MIN = 40;
// 수집기가 멈췄을 때만 사용자 요청이 갱신을 맡는다. 동시에 몰려도 장소당 1번만 부르도록 잠근다
const LOCK_SECONDS = 60;
const KEEP_SECONDS = 6 * 60 * 60;

const cacheKey = (p: Place) => `crowd:${p.category}:${p.id}`;

function toResult(s: CrowdSnapshot): CrowdResult {
  const ageMinutes = Math.max(0, Math.floor((Date.now() - Date.parse(s.updatedAt)) / 60_000));
  return { ...s, ageMinutes, stale: ageMinutes > STALE_LABEL_MIN };
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
    // 예측·추정 값은 방문자 제보로 본 장소별 보정을 더한다 (lib/crowd/bias)
    snap = await withBias(await fetchSnapshot(p));
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
  if (result.ageMinutes * 60 > cadenceMinutes(place) * 60 + FRESH_GRACE_SECONDS) {
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

/** 수집기: 장소별 주기가 된 곳만 다시 받는다. skipped = 아직 주기가 안 돼 건너뛴 장소 */
export async function refreshAll(): Promise<{ id: string; source: string; updatedAt: string; skipped?: true }[]> {
  const places = await getLivePlaces();
  const cached = await readCaches(places);
  const now = new Date();
  return Promise.all(
    places.map(async (p, i) => {
      const c = cached[i];
      if (c && !isDue(p, c.updatedAt, now)) return { id: p.id, source: c.source, updatedAt: c.updatedAt, skipped: true as const };
      const s = await refresh(p, c);
      return { id: p.id, source: s.source, updatedAt: s.updatedAt };
    }),
  );
}
