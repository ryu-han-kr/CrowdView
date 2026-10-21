// Plus 혼잡 알림: 장소(우리 장소 id) 또는 서울 실시간 지역(seoul-<코드>)이 한산해지면(calm) / 붐비기 시작하면(busy) 웹 푸시.
// 10분 수집기가 끝날 때 checkAlerts()를 부른다. 웹 푸시는 표준(VAPID)이라 어느 서버에서든 보낼 수 있다.
import webpush from "web-push";
import { getT } from "@/i18n/server";
import { localePath, type Lang } from "@/i18n/config";
import { kv } from "./cache";
import { pool, sql } from "./db";
import { levelOf } from "./levels";
import { PLACES, placeHref } from "./places";
import { SEOUL_AREAS } from "./seoul-areas";
import { getAllSeoulLive } from "./seoul-live";
import type { CrowdResult } from "./types";

const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
export const pushEnabled = !!PUBLIC && !!PRIVATE && !!pool;
if (pushEnabled) webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:support@crowdview.app", PUBLIC!, PRIVATE!);

/** 한산: 원활 이하(40점 미만) / 붐빔: 혼잡 이상(60점 이상) */
const CALM_BELOW = 40;
const BUSY_FROM = 60;
/** 같은 알림은 3시간에 한 번까지 */
const COOLDOWN_MS = 3 * 3600_000;

/** 알림을 걸 수 있는 곳: 우리 장소 또는 서울 실시간 지역. 없는 id면 undefined */
export function alertTarget(id: string): { id: string; name: string; href: string } | undefined {
  if (id.startsWith("seoul-")) {
    const a = SEOUL_AREAS.find((x) => x.code === id.slice(6));
    return a && { id, name: a.name, href: `/seoul/${a.code}` };
  }
  const p = PLACES.find((x) => x.id === id);
  return p && { id, name: p.name, href: placeHref(p) };
}

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function savePushSubscription(userId: string, s: PushSub, lang: string) {
  await sql(
    `insert into push_subscription (endpoint, user_id, p256dh, auth, lang) values ($1, $2, $3, $4, $5)
     on conflict (endpoint) do update set user_id = $2, p256dh = $3, auth = $4, lang = $5`,
    [s.endpoint, userId, s.keys.p256dh, s.keys.auth, lang],
  );
}

interface Due {
  user_id: string;
  place_id: string;
  kind: "calm" | "busy";
  last_score: number | null;
  last_sent_at: Date | null;
}

// 알림이 하나라도 있는지 Redis에 표시해 둔다. 없으면 10분 수집기가 DB를 깨우지 않는다
// (Neon 같은 서버리스 Postgres는 깨어 있는 시간만큼 요금이 나간다)
const ANY_KEY = "alerts:any";
export const markAlertsExist = () => kv.set(ANY_KEY, "1", 35 * 24 * 3600).catch(() => {});

/** 알림 조건을 확인하고 보낸다. 보낸 수를 돌려준다 */
export async function checkAlerts(crowd: Record<string, CrowdResult>): Promise<number> {
  if (!pushEnabled) return 0;
  if (!(await kv.get(ANY_KEY).catch(() => "1"))) return 0;
  // Plus 회원은 전부, 무료 회원은 가장 먼저 켠 1개만 (외부 점검 P2-1, 사용자 결정 10/21 — Plus가 끝나도 1개는 계속 간다)
  const alerts = await sql<Due>(
    `select a.user_id, a.place_id, a.kind, a.last_score, a.last_sent_at
     from crowd_alert a
     where exists (select 1 from plus_subscription s where s.user_id = a.user_id and s.status <> 'expired' and s.current_period_end > now())
        or a.created_at = (select min(b.created_at) from crowd_alert b where b.user_id = a.user_id)`,
  );
  // 알림이 남아 있으면 표시를 연장하고, 다 지워졌으면 표시를 내린다
  if (alerts.length) await markAlertsExist();
  else await kv.set(ANY_KEY, "", 1).catch(() => {});
  // 서울 실시간 지역 알림이 있을 때만 서울시 데이터를 읽는다 (Redis 캐시)
  const seoul = alerts.some((a) => a.place_id.startsWith("seoul-")) ? await getAllSeoulLive() : {};
  let sent = 0;
  for (const a of alerts) {
    const target = alertTarget(a.place_id);
    const c = a.place_id.startsWith("seoul-") ? { open: true, score: seoul[a.place_id.slice(6)]?.score } : crowd[a.place_id];
    if (!c || !target || !c.open || c.score === undefined) continue;
    const place = target;
    const now = c.score;
    const prev = a.last_score;
    // 경계를 넘는 순간에만 (처음 등록 직후 이미 그 상태면 알리지 않고 기준만 저장)
    const crossed =
      prev !== null && (a.kind === "calm" ? prev >= CALM_BELOW && now < CALM_BELOW : prev < BUSY_FROM && now >= BUSY_FROM);
    const cooled = !a.last_sent_at || Date.now() - a.last_sent_at.getTime() > COOLDOWN_MS;
    if (crossed && cooled) {
      sent += await notifyUser(a.user_id, place.id, place.name, a.kind, now, place.href);
      await sql("update crowd_alert set last_score = $4, last_sent_at = now() where user_id = $1 and place_id = $2 and kind = $3", [
        a.user_id,
        a.place_id,
        a.kind,
        now,
      ]);
    } else if (prev !== now) {
      await sql("update crowd_alert set last_score = $4 where user_id = $1 and place_id = $2 and kind = $3", [a.user_id, a.place_id, a.kind, now]);
    }
  }
  return sent;
}

function notifyUser(userId: string, placeId: string, placeName: string, kind: "calm" | "busy", score: number, href: string) {
  return pushToUser(userId, (t, lang) => ({
    title: kind === "calm" ? t("{name} 지금 한산해요", { name: t(placeName) }) : t("{name} 붐비기 시작했어요", { name: t(placeName) }),
    body: t("지금 {level} · 눌러서 자세히 보기", { level: t(levelOf(score).label) }),
    url: localePath(lang, href),
    tag: `${placeId}-${kind}`,
  }));
}

/** 회원의 모든 브라우저로 웹 푸시. 문구는 브라우저마다 그 언어로 만든다. 보낸 수를 돌려준다 */
export async function pushToUser(
  userId: string,
  build: (t: ReturnType<typeof getT>, lang: Lang) => { title: string; body: string; url: string; tag: string },
): Promise<number> {
  if (!pushEnabled) return 0;
  const subs = await sql<{ endpoint: string; p256dh: string; auth: string; lang: Lang }>(
    "select endpoint, p256dh, auth, lang from push_subscription where user_id = $1",
    [userId],
  );
  let n = 0;
  for (const s of subs) {
    const payload = JSON.stringify(build(getT(s.lang), s.lang));
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 1800 });
      n++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      // 브라우저가 구독을 끊었으면 지운다
      if (code === 404 || code === 410) await sql("delete from push_subscription where endpoint = $1", [s.endpoint]);
      else console.warn("[alerts] push", code, e instanceof Error ? e.message : e);
    }
  }
  return n;
}
