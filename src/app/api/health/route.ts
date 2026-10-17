// 상태 점검: 데이터 신선도(소스별 가장 오래된 실시간 값), Redis, 오늘 API 사용률.
// 외부 감시 도구(UptimeRobot 등)가 1~5분마다 부르게 하면 된다. 문제가 있으면 503
import { NextResponse } from "next/server";
import { getVitals } from "@/lib/vitals";
import { getApiUsage } from "@/lib/api-quota";
import { kv, kvBackend } from "@/lib/cache";
import { getAllCrowd } from "@/lib/crowd/service";
import { getAllSeoulLive } from "@/lib/seoul-live";
import { kst } from "@/lib/time";

export const dynamic = "force-dynamic";

/** 실시간 데이터가 이보다 오래되면 '지연' (수집기 10분 + 원본 갱신 주기 여유) */
const STALE_MIN = 40;
/** 서울시 도시데이터는 기준 시각 자체가 20~40분 늦게 나와서 따로 */
const SEOUL_STALE_MIN = 70;

export async function GET() {
  const started = Date.now();
  const redisOk = await kv
    .set("health:ping", String(started), 60)
    .then(() => true)
    .catch(() => false);
  const [crowd, seoul, usage, vitals] = await Promise.all([
    getAllCrowd().catch(() => ({}) as Awaited<ReturnType<typeof getAllCrowd>>),
    getAllSeoulLive().catch(() => ({}) as Awaited<ReturnType<typeof getAllSeoulLive>>),
    getApiUsage().catch(() => []),
    // 실사용 화면 속도: 최근 7일 '좋음' 비율 (상태 판단에는 넣지 않는다)
    getVitals(7).catch(() => ({})),
  ]);

  // 소스별: 실시간 장소 수, 가장 오래된 값(분)
  const bySource: Record<string, { places: number; oldestMin: number }> = {};
  for (const c of Object.values(crowd)) {
    if (c.source === "model") continue;
    const s = (bySource[c.source] ??= { places: 0, oldestMin: 0 });
    s.places++;
    s.oldestMin = Math.max(s.oldestMin, c.ageMinutes);
  }
  // 서울 121곳: 서울시 기준 시각과 지금의 차이
  const seoulTimes = Object.values(seoul).map((s) => s.time);
  const newest = seoulTimes.sort().at(-1);
  const now = kst();
  const seoulAgeMin = newest
    ? Math.round((Date.parse(`${now.date}T00:00:00Z`) + now.hour * 3600_000 - Date.parse(`${newest.replace(" ", "T")}:00Z`)) / 60_000)
    : null;

  const stale = Object.entries(bySource)
    .filter(([, s]) => s.oldestMin > STALE_MIN)
    .map(([k]) => k);
  if (seoulAgeMin === null || seoulAgeMin > SEOUL_STALE_MIN) stale.push("seoul-live");
  const quotaHot = usage.filter((u) => (u.pct ?? 0) >= 70).map((u) => ({ id: u.id, pct: Math.round(u.pct!) }));
  const ok = redisOk && stale.length === 0;

  return NextResponse.json(
    {
      ok,
      checkedAt: new Date().toISOString(),
      redis: { ok: redisOk, backend: kvBackend },
      sources: bySource,
      seoulLive: { areas: seoulTimes.length, newest, ageMin: seoulAgeMin },
      stale,
      quotaHot,
      vitals,
      ms: Date.now() - started,
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
