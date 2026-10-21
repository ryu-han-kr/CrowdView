// API에서 들어오는 고유명사(축제 이름·지역명·장소명)를 Papago로 번역한다.
// 이름마다 한 번만 번역해 Redis에 90일 저장 → Papago 호출은 새 이름이 생길 때만.
// 키가 없거나 실패하면 원문(한국어)을 그대로 쓴다.
import type { Lang } from "@/i18n/config";
import { APIS, beforeCall } from "./api-quota";
import { kv } from "./cache";

const ENDPOINT = process.env.PAPAGO_ENDPOINT ?? "https://papago.apigw.ntruss.com/nmt/v1/translation";
const TTL = 90 * 24 * 60 * 60;
const MAX_CHARS = 4500; // 요청당 5000자 제한

// 지도와 같은 NCP Application을 쓴다 (콘솔에서 Papago Translation 사용 설정 필요)
const clientId = () => process.env.PAPAGO_CLIENT_ID ?? process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
const clientSecret = () =>
  process.env.PAPAGO_CLIENT_SECRET ?? process.env.PAPAGO_CLIENT_PASSWORD ?? process.env.NAVER_MAP_CLIENT_SECRET;

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
const cacheKey = (lang: Lang, text: string) => `tr:${lang}:${hash(text)}:${text.length}`;

/** 줄바꿈으로 묶어 한 번에 번역 (Papago는 줄 구분을 유지한다). 줄 수가 안 맞으면 null */
async function papago(texts: string[], lang: Lang): Promise<string[] | null> {
  const id = clientId();
  const secret = clientSecret();
  if (!id || !secret) return null;
  const text = texts.join("\n");
  // 요금은 글자 수로 나가므로 글자 수로 센다
  await beforeCall(APIS.find((a) => a.id === "papago"), text.length);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "X-NCP-APIGW-API-KEY-ID": id,
      "X-NCP-APIGW-API-KEY": secret,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ source: "ko", target: lang, text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 429) {
    // NCP가 한도 초과라고 하면 모든 서버가 6시간 멈춘다 (인스턴스마다 10분씩 다시 두드리던 것을 공유). /api/health papago.blockedUntil
    await kv.set(BLOCK_KEY, new Date(Date.now() + BLOCK_MS).toISOString(), BLOCK_MS / 1000).catch(() => {});
    throw new Error(`papago 429: ${(await res.text()).slice(0, 120)}`);
  }
  if (!res.ok) throw new Error(`papago ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const out = String((await res.json()).message?.result?.translatedText ?? "").split("\n");
  return out.length === texts.length ? out.map((s) => s.trim()) : null;
}

const HANGUL = /[가-힣]/;
let disabledUntil = 0; // 권한 없음·한도 초과 등으로 실패하면 잠시 호출을 멈춘다
/** NCP 429를 받은 뒤 모든 서버가 멈추는 공유 표시 (Redis) */
const BLOCK_KEY = "papago:blocked";
const BLOCK_MS = 6 * 3600_000;
/** 지금 NCP 한도 초과로 멈춰 있으면 풀리는 시각(ISO), 아니면 undefined */
export const papagoBlockedUntil = async (): Promise<string | undefined> => (await kv.get(BLOCK_KEY).catch(() => null)) ?? undefined;
const LOCK_TTL = 60;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 이 서버에서 지금 번역 중인 이름 → 결과. 같은 이름을 동시에 두 번 보내지 않는다
const inflight = new Map<string, Promise<string | undefined>>();

/** 이름들을 번역해 Redis에 저장한다. 묶음의 줄 수가 안 맞으면 버리지 않고 하나씩 다시 보낸다 */
async function translateMissing(names: string[], lang: Lang): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const save = (s: string, tr: string | undefined) => {
    if (!tr) return;
    out.set(s, tr);
    return kv.set(cacheKey(lang, s), tr, TTL).catch(() => {});
  };

  // 글자 수 제한에 맞춰 나눠 보낸다
  const batches: string[][] = [[]];
  let len = 0;
  for (const s of names) {
    if (len + s.length + 1 > MAX_CHARS && batches.at(-1)!.length) {
      batches.push([]);
      len = 0;
    }
    batches.at(-1)!.push(s);
    len += s.length + 1;
  }
  try {
    for (const batch of batches) {
      const result = await papago(batch.map((s) => s.replace(/\n/g, " ")), lang);
      if (result) {
        await Promise.all(batch.map((s, i) => save(s, result[i])));
      } else if (batch.length > 1) {
        for (const s of batch) await save(s, (await papago([s.replace(/\n/g, " ")], lang))?.[0]);
      }
    }
  } catch (e) {
    disabledUntil = Date.now() + 10 * 60 * 1000;
    console.warn("[name-translate]", e instanceof Error ? e.message : e);
  }
  return out;
}

/**
 * 파파고를 부를 수 있는 곳: 운영 배포만 (로컬에서 꼭 필요하면 TRANSLATE_FORCE=1).
 * Preview 배포(PR마다 빌드)는 메모리 캐시라 저장된 번역이 하나도 없어, 빌드 한 번에 모든 이름을 새로 번역했다.
 * 그 사용량은 운영 한도 계산에도 잡히지 않았다 (10/21 확인). Preview는 원문으로 보인다
 */
const canTranslate = () =>
  process.env.NEXT_PHASE !== "phase-production-build" && (process.env.VERCEL_ENV === "production" || process.env.TRANSLATE_FORCE === "1");

/** 한국어 이름들 → 번역 Map (번역 못 한 것은 원문). ko면 그대로 */
export async function translateNames(texts: (string | undefined)[], lang: Lang): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const uniq = [...new Set(texts.filter((s): s is string => !!s && HANGUL.test(s)))];
  if (lang === "ko" || uniq.length === 0) return out;

  // Redis를 못 읽으면(한도 초과·장애) 전부 '번역 없음'으로 보고 다시 번역하지 않는다 — 원문으로 둔다 (10/19 한도 초과 때 이렇게 새어 나갔다)
  const cached = await kv.mget(uniq.map((s) => cacheKey(lang, s))).catch(() => null);
  if (!cached) return out;
  const missing: string[] = [];
  uniq.forEach((s, i) => (cached[i] ? out.set(s, cached[i]!) : missing.push(s)));
  if (missing.length === 0 || Date.now() < disabledUntil || !canTranslate()) return out;
  // 다른 서버가 NCP 429를 받았으면 이 서버도 부르지 않는다 (Redis 읽기 1번)
  if (await papagoBlockedUntil()) return out;

  // 1) 이 서버에서 이미 번역 중인 이름은 그 결과를 기다린다
  const waiting = missing.filter((s) => inflight.has(cacheKey(lang, s)));
  const rest = missing.filter((s) => !inflight.has(cacheKey(lang, s)));

  // 2) 다른 서버(동시에 도는 빌드·미리보기 배포)와 겹치지 않게 이름마다 Redis 잠금을 잡는다
  const locks = await Promise.all(
    rest.map((s) => kv.setNX(`trlock:${cacheKey(lang, s)}`, "1", LOCK_TTL).catch(() => true)),
  );
  const mine = rest.filter((_, i) => locks[i]);
  const elsewhere = rest.filter((_, i) => !locks[i]);

  if (mine.length) {
    const job = translateMissing(mine, lang);
    for (const s of mine) {
      const key = cacheKey(lang, s);
      inflight.set(key, job.then((m) => m.get(s)));
      job.finally(() => inflight.delete(key));
    }
  }

  const pending = [...waiting, ...mine].map((s) => [s, inflight.get(cacheKey(lang, s))!] as const);
  const [results, later] = await Promise.all([
    Promise.all(pending.map(([, p]) => p)),
    // 다른 서버가 번역 중이면 잠깐 기다렸다가 Redis에서 한 번 더 읽는다 (없으면 이번엔 원문)
    elsewhere.length
      ? sleep(3000).then(() => kv.mget(elsewhere.map((s) => cacheKey(lang, s))).catch(() => []))
      : Promise.resolve([] as (string | null)[]),
  ]);
  pending.forEach(([s], i) => results[i] && out.set(s, results[i]!));
  elsewhere.forEach((s, i) => later[i] && out.set(s, later[i]!));
  return out;
}

/** translateNames 결과로 바꾸는 함수 (없으면 원문) */
export async function nameTranslator(texts: (string | undefined)[], lang: Lang): Promise<(s: string) => string> {
  const map = await translateNames(texts, lang);
  return (s) => map.get(s) ?? s;
}
