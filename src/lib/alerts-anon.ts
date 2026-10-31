// 로그인 없이 '한산해지면 알림' (경수님 10/31 '알리기' 11번: 첫 방문자가 버튼을 눌러도 로그인에 막혀 재방문 통로가 없었다).
// 브라우저(푸시 구독) 하나에 장소 하나, 한 번 알리면 끝, 7일 지나면 사라진다 — 회원 알림(lib/alerts, 계속 울림·여러 곳)과 겹치지 않게 가볍게.
// DB가 아니라 Redis 해시(alerts:anon, 필드 = 구독 주소 해시) 하나에 둔다: 마이그레이션 없이, 10분 수집기는 HGETALL 한 번
import { createHash } from "node:crypto";
import webpush from "web-push";
import { getT } from "@/i18n/server";
import { isLang, localePath } from "@/i18n/config";
import { alertTarget, pushEnabled, type PushSub } from "./alerts";
import { kv } from "./cache";
import { levelOf } from "./levels";
import { getAllSeoulLive } from "./seoul-live";
import type { CrowdResult } from "./types";

const KEY = "alerts:anon";
const TTL_MS = 7 * 86_400_000;
/** lib/alerts와 같은 '한산' 기준 (원활 이하) */
const CALM_BELOW = 40;

interface Anon {
  placeId: string;
  sub: PushSub;
  lang: string;
  /** 지난 점검 때 점수 — 경계를 넘는 순간에만 알린다 */
  last: number | null;
  at: number;
}

const idOf = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 32);

export async function getAnonAlert(endpoint: string): Promise<string | null> {
  const [raw] = (await kv.pipeline([["HGET", KEY, idOf(endpoint)]])) as (string | null)[];
  if (!raw) return null;
  const a = JSON.parse(raw) as Anon;
  return Date.now() - a.at < TTL_MS ? a.placeId : null;
}

/** 켜기. 같은 브라우저가 다른 장소를 켜면 바꾼다 (한 곳만) */
export async function saveAnonAlert(placeId: string, sub: PushSub, lang: string, score: number | null) {
  const a: Anon = { placeId, sub, lang, last: score, at: Date.now() };
  await kv.pipeline([
    ["HSET", KEY, idOf(sub.endpoint), JSON.stringify(a)],
    ["EXPIRE", KEY, (TTL_MS / 1000) * 2],
  ]);
}

export const deleteAnonAlert = (endpoint: string) => kv.pipeline([["HDEL", KEY, idOf(endpoint)]]);

/** 10분 수집기에서. 한산해진 곳을 알리고 그 알림은 지운다. 보낸 수를 돌려준다 */
export async function checkAnonAlerts(crowd: Record<string, CrowdResult>): Promise<number> {
  if (!pushEnabled) return 0;
  const flat = (await kv.pipeline([["HGETALL", KEY]]))[0] as string[] | null;
  if (!flat?.length) return 0;
  // 서울 실시간 지역 알림이 있을 때만 서울시 데이터를 읽는다 (Redis 캐시)
  const seoul = flat.some((v, i) => i % 2 === 1 && v.includes('"placeId":"seoul-')) ? await getAllSeoulLive() : {};
  const cmds: (string | number)[][] = [];
  let sent = 0;
  for (let i = 0; i < flat.length; i += 2) {
    const id = flat[i];
    const a = JSON.parse(flat[i + 1]) as Anon;
    const target = alertTarget(a.placeId);
    if (!target || Date.now() - a.at > TTL_MS) {
      cmds.push(["HDEL", KEY, id]);
      continue;
    }
    const c = a.placeId.startsWith("seoul-") ? { open: true, score: seoul[a.placeId.slice(6)]?.score } : crowd[a.placeId];
    if (!c?.open || c.score === undefined) continue;
    const now = c.score;
    if (a.last !== null && a.last >= CALM_BELOW && now < CALM_BELOW) {
      const lang = isLang(a.lang) ? a.lang : "ko";
      const t = getT(lang);
      const payload = JSON.stringify({
        title: t("{name} 지금 한산해요", { name: t(target.name) }),
        body: t("지금 {level} · 눌러서 자세히 보기", { level: t(levelOf(now).label) }),
        url: localePath(lang, target.href),
        tag: `${a.placeId}-calm`,
      });
      try {
        await webpush.sendNotification(a.sub, payload, { TTL: 1800 });
        sent++;
      } catch (e) {
        console.warn("[alerts-anon] push", (e as { statusCode?: number }).statusCode);
      }
      cmds.push(["HDEL", KEY, id]);
    } else if (a.last !== now) {
      cmds.push(["HSET", KEY, id, JSON.stringify({ ...a, last: now })]);
    }
  }
  if (cmds.length) await kv.pipeline(cmds);
  return sent;
}
