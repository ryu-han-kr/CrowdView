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

/** 줄바꿈으로 묶어 한 번에 번역 (Papago는 줄 구분을 유지한다) */
async function papago(texts: string[], lang: Lang): Promise<string[] | null> {
  const id = clientId();
  const secret = clientSecret();
  if (!id || !secret) return null;
  await beforeCall(APIS.find((a) => a.id === "papago"));
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "X-NCP-APIGW-API-KEY-ID": id,
      "X-NCP-APIGW-API-KEY": secret,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ source: "ko", target: lang, text: texts.join("\n") }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`papago ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const out = String((await res.json()).message?.result?.translatedText ?? "").split("\n");
  return out.length === texts.length ? out.map((s) => s.trim()) : null;
}

const HANGUL = /[가-힣]/;
let disabledUntil = 0; // 권한 없음 등으로 실패하면 잠시 호출을 멈춘다

/** 한국어 이름들 → 번역 Map (번역 못 한 것은 원문). ko면 그대로 */
export async function translateNames(texts: (string | undefined)[], lang: Lang): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const uniq = [...new Set(texts.filter((s): s is string => !!s && HANGUL.test(s)))];
  if (lang === "ko" || uniq.length === 0) return out;

  const cached = await kv.mget(uniq.map((s) => cacheKey(lang, s))).catch(() => uniq.map(() => null));
  const missing: string[] = [];
  uniq.forEach((s, i) => (cached[i] ? out.set(s, cached[i]!) : missing.push(s)));
  if (missing.length === 0 || Date.now() < disabledUntil) return out;

  // 글자 수 제한에 맞춰 나눠 보낸다
  const batches: string[][] = [[]];
  let len = 0;
  for (const s of missing) {
    if (len + s.length + 1 > MAX_CHARS && batches.at(-1)!.length) {
      batches.push([]);
      len = 0;
    }
    batches.at(-1)!.push(s.replace(/\n/g, " "));
    len += s.length + 1;
  }
  try {
    for (const batch of batches) {
      const result = await papago(batch, lang);
      if (!result) break;
      await Promise.all(
        batch.map((s, i) => {
          const tr = result[i];
          if (!tr) return;
          out.set(s, tr);
          return kv.set(cacheKey(lang, s), tr, TTL).catch(() => {});
        }),
      );
    }
  } catch (e) {
    disabledUntil = Date.now() + 10 * 60 * 1000;
    console.warn("[name-translate]", e instanceof Error ? e.message : e);
  }
  return out;
}

/** translateNames 결과로 바꾸는 함수 (없으면 원문) */
export async function nameTranslator(texts: (string | undefined)[], lang: Lang): Promise<(s: string) => string> {
  const map = await translateNames(texts, lang);
  return (s) => map.get(s) ?? s;
}
