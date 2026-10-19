// 찜·담은 곳 공유: 내 즐겨찾기(장소)와 담은 곳을 Redis에 30일 저장하고 /l/{id} 로 보여준다 (코스 공유 lib/route-share와 같은 방식).
// 이용자 입력은 믿지 않는다: 장소는 우리 장소 목록에 있는 id만, 담은 곳은 사이트 안 주소(/로 시작)와 이름 60자만 받는다
import { randomBytes } from "node:crypto";
import { kv } from "./cache";
import { getPlace } from "./places";
import type { Pick } from "./prefs";

export interface SharedList {
  /** 즐겨찾기 장소 id */
  favorites: string[];
  /** 담은 곳 (서울 실시간·여행 가이드 등) */
  picks: Pick[];
  /** 만든 날 (KST, YYYY-MM-DD) */
  createdOn?: string;
}

const TTL = 30 * 86_400;
const MAX = 50;
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // 헷갈리는 글자(l, o, 0, 1) 뺌
const key = (id: string) => `list:share:${id}`;

/** 요청 본문을 검사해 저장할 목록으로 (둘 다 비면 null) */
export function cleanList(input: unknown): SharedList | null {
  const o = (input ?? {}) as { favorites?: unknown; picks?: unknown };
  const favorites = Array.isArray(o.favorites)
    ? [...new Set(o.favorites.filter((x): x is string => typeof x === "string" && !!getPlace(x)))].slice(0, MAX)
    : [];
  const picks = Array.isArray(o.picks)
    ? o.picks
        .flatMap((p: unknown) => {
          const { id, label, href } = (p ?? {}) as Partial<Pick>;
          const ok =
            typeof id === "string" &&
            id.length <= 80 &&
            typeof label === "string" &&
            label.trim() &&
            typeof href === "string" &&
            /^\/(?!\/)[^\s<>"]{0,200}$/.test(href);
          return ok ? [{ id, label: label.trim().slice(0, 60), href }] : [];
        })
        .slice(0, MAX)
    : [];
  return favorites.length || picks.length ? { favorites, picks } : null;
}

export async function saveSharedList(list: SharedList): Promise<string> {
  const id = [...randomBytes(8)].map((b) => ALPHABET[b % ALPHABET.length]).join("");
  const createdOn = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  await kv.set(key(id), JSON.stringify({ ...list, createdOn }), TTL);
  return id;
}

export async function getSharedList(id: string): Promise<SharedList | null> {
  if (!/^[a-z2-9]{8}$/.test(id)) return null;
  const raw = await kv.get(key(id)).catch(() => null);
  return raw ? (JSON.parse(raw) as SharedList) : null;
}
