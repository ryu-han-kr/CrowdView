// 상태 점검: 데이터 신선도(소스별 가장 오래된 실시간 값), Redis, 오늘 API 사용률.
// 외부 감시 도구(UptimeRobot 등)가 1~5분마다 부르게 하면 된다. 문제가 있으면 503
// features: 키가 필요한 기능이 켜졌는지 (값은 보여 주지 않고 있다/없다만). 꺼져 있어도 503이 아니다
import { NextResponse } from "next/server";
import { authEnabled, enabledProviders } from "@/lib/auth";
import { pushEnabled } from "@/lib/alerts";
import { pool } from "@/lib/db";
import { mailEnabled } from "@/lib/mail";
import { tossEnabled } from "@/lib/toss";
import { getVitals } from "@/lib/vitals";
import { getApiUsage } from "@/lib/api-quota";
import { kv, kvBackend } from "@/lib/cache";
import { getAllCrowd } from "@/lib/crowd/service";
import { getAllSeoulLive } from "@/lib/seoul-live";
import { kst } from "@/lib/time";
import { probeKeys } from "@/lib/key-probe";

export const dynamic = "force-dynamic";

/** 실시간 데이터가 이보다 오래되면 '지연' (수집기 10분 + 원본 갱신 주기 여유) */
const STALE_MIN = 40;
/** 서울시 도시데이터는 기준 시각 자체가 20~40분 늦게 나와서 따로 */
const SEOUL_STALE_MIN = 70;

/** DB 연결 + 적용된 마이그레이션 (scripts/smoke.mjs가 db/migrations 파일과 비교) */
async function dbStatus() {
  if (!pool) return { configured: false };
  try {
    const rows = (await pool.query<{ name: string }>("select name from schema_migrations order by name")).rows;
    return { configured: true, ok: true, migrations: rows.map((r) => r.name) };
  } catch (e) {
    return { configured: true, ok: false, error: e instanceof Error ? e.message.slice(0, 120) : "error" };
  }
}

const has = (k: string) => !!process.env[k];

function features() {
  return {
    auth: authEnabled,
    loginProviders: enabledProviders,
    payment: tossEnabled,
    paymentTestMode: tossEnabled && (process.env.TOSS_SECRET_KEY ?? "").startsWith("test_"),
    push: pushEnabled,
    mail: mailEnabled,
    admin: has("ADMIN_EMAILS"),
    ads: has("NEXT_PUBLIC_ADSENSE_CLIENT"),
    sktCongestion: has("SK_OPENAPI_APP_KEY"),
    errorTracking: has("NEXT_PUBLIC_SENTRY_DSN"),
    searchVerification: {
      google: has("NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION"),
      naver: has("NEXT_PUBLIC_NAVER_SITE_VERIFICATION"),
      bing: has("NEXT_PUBLIC_BING_SITE_VERIFICATION"),
    },
  };
}

export async function GET() {
  const started = Date.now();
  const redisOk = await kv
    .set("health:ping", String(started), 60)
    .then(() => true)
    .catch(() => false);
  const [crowd, seoul, usage, vitals, db, keyProbe] = await Promise.all([
    getAllCrowd().catch(() => ({}) as Awaited<ReturnType<typeof getAllCrowd>>),
    getAllSeoulLive().catch(() => ({}) as Awaited<ReturnType<typeof getAllSeoulLive>>),
    getApiUsage().catch(() => []),
    // 실사용 화면 속도: 최근 7일 '좋음' 비율 (상태 판단에는 넣지 않는다)
    getVitals(7).catch(() => ({})),
    dbStatus(),
    // 새 API 키 확인 (교통·지하철). 상태 판단(ok)에는 넣지 않는다
    probeKeys().catch(() => ({})),
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
      db,
      features: features(),
      keyProbe,
      ms: Date.now() - started,
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
