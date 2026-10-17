// 코스 공유: 만든 코스를 Redis에 30일 저장하고 /r/{id} 로 보여준다 (서버가 만든 결과만 저장, 이용자 입력 글은 이름 60자뿐)
import { randomBytes } from "node:crypto";
import type { Lang } from "@/i18n/config";
import { kv } from "./cache";
import type { LatLng } from "./geo";
import type { RoutePlan } from "./route";

export interface SharedRoute {
  plan: RoutePlan;
  start: LatLng & { name: string };
  /** 출발 시각 (만든 날 0시부터 분) */
  startMin: number;
  lang: Lang;
  /** Plus 미리보기라 가려진 곳 수 */
  locked: number;
  /** 만든 날 (KST, YYYY-MM-DD) — 공유 페이지에서 '내일' 같은 날짜를 그날 기준으로 */
  createdOn?: string;
}

const TTL = 30 * 86_400;
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // 헷갈리는 글자(l, o, 0, 1) 뺌
const key = (id: string) => `route:share:${id}`;

export async function saveSharedRoute(r: SharedRoute): Promise<string> {
  const bytes = randomBytes(8);
  const id = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
  const createdOn = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  await kv.set(key(id), JSON.stringify({ ...r, createdOn }), TTL);
  return id;
}

export async function getSharedRoute(id: string): Promise<SharedRoute | null> {
  if (!/^[a-z2-9]{8}$/.test(id)) return null;
  const raw = await kv.get(key(id)).catch(() => null);
  return raw ? (JSON.parse(raw) as SharedRoute) : null;
}
