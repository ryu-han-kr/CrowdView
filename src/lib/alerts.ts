// Plus 혼잡 알림: 찜한 장소가 한산해지면(calm) / 붐비기 시작하면(busy) 웹 푸시.
// 10분 수집기가 끝날 때 checkAlerts()를 부른다. 웹 푸시는 표준(VAPID)이라 어느 서버에서든 보낼 수 있다.
import webpush from "web-push";
import { getT } from "@/i18n/server";
import { localePath, type Lang } from "@/i18n/config";
import { pool, sql } from "./db";
import { levelOf } from "./levels";
import { PLACES, placeHref } from "./places";
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

/** 알림 조건을 확인하고 보낸다. 보낸 수를 돌려준다 */
export async function checkAlerts(crowd: Record<string, CrowdResult>): Promise<number> {
  if (!pushEnabled) return 0;
  // 지금 Plus인 회원의 알림만
  const alerts = await sql<Due>(
    `select a.user_id, a.place_id, a.kind, a.last_score, a.last_sent_at
     from crowd_alert a join plus_subscription s on s.user_id = a.user_id
     where s.status <> 'expired' and s.current_period_end > now()`,
  );
  let sent = 0;
  for (const a of alerts) {
    const c = crowd[a.place_id];
    const place = PLACES.find((p) => p.id === a.place_id);
    if (!c || !place || !c.open) continue;
    const now = c.score;
    const prev = a.last_score;
    // 경계를 넘는 순간에만 (처음 등록 직후 이미 그 상태면 알리지 않고 기준만 저장)
    const crossed =
      prev !== null && (a.kind === "calm" ? prev >= CALM_BELOW && now < CALM_BELOW : prev < BUSY_FROM && now >= BUSY_FROM);
    const cooled = !a.last_sent_at || Date.now() - a.last_sent_at.getTime() > COOLDOWN_MS;
    if (crossed && cooled) {
      sent += await notifyUser(a.user_id, place.id, place.name, a.kind, now, placeHref(place));
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

async function notifyUser(userId: string, placeId: string, placeName: string, kind: "calm" | "busy", score: number, href: string) {
  const subs = await sql<{ endpoint: string; p256dh: string; auth: string; lang: Lang }>(
    "select endpoint, p256dh, auth, lang from push_subscription where user_id = $1",
    [userId],
  );
  let n = 0;
  for (const s of subs) {
    const t = getT(s.lang);
    const payload = JSON.stringify({
      title: kind === "calm" ? t("{name} 지금 한산해요", { name: t(placeName) }) : t("{name} 붐비기 시작했어요", { name: t(placeName) }),
      body: t("지금 {level} · 눌러서 자세히 보기", { level: t(levelOf(score).label) }),
      url: localePath(s.lang, href),
      tag: `${placeId}-${kind}`,
    });
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
