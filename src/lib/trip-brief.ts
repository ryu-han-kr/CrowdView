// 유료 'AI 여행 요약' (경수님 10/28: 입장권이 필요한지·얼마인지·어디서 사는지, 교통편, 볼거리가 얼마나 되는지를 유료 회원에게 요약·추천).
// 우리가 가진 사실(주소·운영 시간·휴무·가까운 지하철역)을 주고, Claude가 웹 검색으로 요금·교통·볼거리를 확인해 화면 언어로 정리한다.
// 장소·언어마다 한 번 만들어 14일 보관 (유료 회원이 처음 열 때만 만든다). ANTHROPIC_API_KEY가 없으면 우리 자료만으로 짧은 요약
import Anthropic from "@anthropic-ai/sdk";
import type { Lang } from "@/i18n/config";
import { aiCreate, aiEnabled } from "./ai-quota";
import { QuotaError } from "./api-quota";
import { kv } from "./cache";
import { nearestStation } from "./subway";
import { formatClock } from "./time";
import type { Place } from "./types";

export interface TripBrief {
  /** 한 줄 요약 */
  summary: string;
  ticket: {
    /** free 무료 · paid 유료 · partly 일부 유료(입장 무료, 체험·시설 유료) · unknown */
    need: "free" | "paid" | "partly" | "unknown";
    /** 요금 (예: 어른 62,000원 · 어린이 49,000원) */
    price: string;
    /** 어디서 사는지 (현장 매표소, 공식 앱, 온라인 예매처 등) */
    where: string;
  };
  transport: { mode: "subway" | "bus" | "car" | "taxi" | "walk" | "train" | "other"; how: string }[];
  /** 둘러보는 데 걸리는 시간 (예: 반나절, 2~3시간) */
  stay: string;
  highlights: string[];
  tips: string[];
  /** 추천 동선·같이 가기 좋은 곳 */
  plan: string;
  /** ai: 웹 검색으로 정리 · basic: 우리 자료만 */
  source: "ai" | "basic";
  /** YYYY-MM-DD */
  updated: string;
}

export const tripBriefAi = aiEnabled;
const TTL = 14 * 86_400;
const key = (id: string, lang: Lang) => `brief:v1:${id}:${lang}`;

const LANG_NAME: Record<Lang, string> = { ko: "한국어", en: "English", ja: "日本語", "zh-CN": "简体中文", "zh-TW": "繁體中文" };

/** 우리 자료로 아는 사실 (프롬프트·기본 요약 공통) */
export function factsOf(place: Place) {
  const st = nearestStation(place);
  return {
    name: place.name,
    address: place.address,
    category: place.category,
    hours: place.info?.hoursText ?? `${formatClock(place.hours[0])}~${formatClock(place.hours[1])}`,
    rest: place.info?.restText ?? "",
    station: st ? `${st.name} (${st.lines.join("·")}, 걸어서 약 ${st.walkMin}분)` : "",
    stationInfo: st,
  };
}

const SYSTEM = `너는 한국 여행 서비스 CrowdView의 여행 편집자다. 한 장소에 대해 여행자가 가기 전에 알아야 할 것을 짧고 정확하게 정리한다.
반드시 웹 검색으로 공식 사이트·관광공사·최근 안내를 확인한다. 검색 결과에 요금이 있으면 출처가 공식이 아니어도 숫자를 쓰고 "최근 안내 기준"이라고 붙인다. 확인되지 않은 요금·시간은 지어내지 말고 "현장 확인" 같은 말로 둔다.
문장은 짧게, 여행자 말투로. 광고 문구·과장 금지.`;

function prompt(place: Place, lang: Lang, today: string) {
  const f = factsOf(place);
  return `오늘은 ${today}이다. 아래 장소를 ${LANG_NAME[lang]}로 정리하라. 장소 이름·역 이름도 ${LANG_NAME[lang]} 독자가 알아보게 쓴다(필요하면 현지 이름을 괄호로).
장소: ${f.name}
주소: ${f.address}
운영 시간(관광공사): ${f.hours}
휴무: ${f.rest || "정보 없음"}
가까운 지하철역(우리 계산): ${f.station || "1.2km 안에 없음"}

요금은 "${f.name} 입장료"·공식 사이트로 꼭 검색해 숫자로 쓴다.
확인할 것: 입장권이 필요한지와 요금(어른·어린이), 어디서 사는지(현장·공식 앱·온라인 예매), 가는 방법(지하철·버스·차·주차), 둘러보는 데 걸리는 시간, 꼭 볼 것, 알아 두면 좋은 팁, 같이 묶기 좋은 동선.
마지막 답은 다른 말 없이 아래 모양의 JSON 하나만 쓴다:
{"summary":"한 줄 요약 (60자 안)","ticket":{"need":"free|paid|partly|unknown","price":"요금 (모르면 빈 값, 200자 안)","where":"사는 곳"},"transport":[{"mode":"subway|bus|car|taxi|walk|train|other","how":"한 줄"}],"stay":"걸리는 시간","highlights":["볼거리 3~5개"],"tips":["팁 2~3개"],"plan":"추천 동선 한두 문장"}`;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const NEEDS = ["free", "paid", "partly", "unknown"] as const;
const MODES = ["subway", "bus", "car", "taxi", "walk", "train", "other"] as const;

/** 답에서 JSON을 꺼내 모양을 맞춘다. 요약이 없으면 undefined */
export function parseBrief(text: string, updated: string): TripBrief | undefined {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return undefined;
  let x: Record<string, unknown>;
  try {
    x = JSON.parse(m[0]);
  } catch {
    return undefined;
  }
  const t = (x.ticket ?? {}) as Record<string, unknown>;
  const list = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.map((s) => str(s, max)).filter(Boolean).slice(0, n) : []);
  const summary = str(x.summary, 120);
  if (!summary) return undefined;
  return {
    summary,
    ticket: {
      need: NEEDS.includes(t.need as (typeof NEEDS)[number]) ? (t.need as TripBrief["ticket"]["need"]) : "unknown",
      price: str(t.price, 400),
      where: str(t.where, 240),
    },
    transport: (Array.isArray(x.transport) ? x.transport : [])
      .map((r: Record<string, unknown>) => ({
        mode: MODES.includes(r?.mode as (typeof MODES)[number]) ? (r.mode as TripBrief["transport"][number]["mode"]) : "other",
        how: str(r?.how, 240),
      }))
      .filter((r) => r.how)
      .slice(0, 4),
    stay: str(x.stay, 100),
    highlights: list(x.highlights, 5, 120),
    tips: list(x.tips, 3, 240),
    plan: str(x.plan, 400),
    source: "ai",
    updated,
  };
}

/** 키가 없을 때: 우리 자료만으로 (요금·볼거리는 비워 둔다) */
export function basicBrief(place: Place, updated: string): TripBrief {
  const f = factsOf(place);
  return {
    summary: place.description,
    ticket: { need: "unknown", price: "", where: "" },
    transport: f.stationInfo ? [{ mode: "subway", how: f.station }] : [],
    stay: "",
    highlights: [],
    tips: f.rest ? [f.rest] : [],
    plan: "",
    source: "basic",
    updated,
  };
}

async function generate(place: Place, lang: Lang, today: string): Promise<TripBrief | undefined> {
  const client = new Anthropic({ timeout: 120_000 });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt(place, lang, today) }];
  for (let turn = 0; turn < 3; turn++) {
    const res = await aiCreate(client, {
      model: "claude-sonnet-5-5",
      max_tokens: 4000,
      system: SYSTEM,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4, user_location: { type: "approximate", country: "KR", timezone: "Asia/Seoul" } }],
      messages,
    });
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    if (res.stop_reason === "refusal") return undefined;
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return parseBrief(text, today);
  }
  return undefined;
}

/** 저장된 요약 → 없으면 만든다 (같은 장소·언어를 여러 명이 동시에 열어도 한 번만 만든다) */
export async function getTripBrief(place: Place, lang: Lang, today: string): Promise<TripBrief> {
  const k = key(place.id, lang);
  const hit = await kv.get(k).catch(() => null);
  if (hit) {
    try {
      return JSON.parse(String(hit)) as TripBrief;
    } catch {}
  }
  if (!tripBriefAi()) return basicBrief(place, today);
  // 방금 실패한 곳은 30분 동안 다시 부르지 않는다 (10/30: 실패하면 누를 때마다 Claude를 다시 불렀다)
  if (await kv.get(`${k}:fail`).catch(() => null)) return basicBrief(place, today);
  const lock = await kv.setNX(`${k}:lock`, "1", 320).catch(() => true);
  if (!lock) throw new Error("요약을 만들고 있어요. 잠시 뒤 다시 눌러 주세요");
  try {
    const brief = await generate(place, lang, today).catch((e) => {
      if (e instanceof QuotaError) return undefined;
      throw e;
    });
    if (!brief) {
      await kv.set(`${k}:fail`, "1", 1800).catch(() => {});
      return basicBrief(place, today);
    }
    // 유료인데 요금에 숫자가 없으면(웹 검색이 빈손) 하루만 두고 다시 만든다 (10/29: 롯데월드가 '요금 확인 안 됨'으로 14일 묶일 뻔)
    const weak = (brief.ticket.need === "paid" || brief.ticket.need === "partly") && !/\d/.test(brief.ticket.price);
    await kv.set(k, JSON.stringify(brief), weak ? 86_400 : TTL).catch(() => {});
    return brief;
  } finally {
    await kv.set(`${k}:lock`, "", 1).catch(() => {});
  }
}
