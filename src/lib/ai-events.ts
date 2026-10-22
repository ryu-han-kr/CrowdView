// 요즘 화제인 축제·테마파크 시즌 이벤트를 하루 한 번 AI 웹 검색으로 모은다 (사용자 10/22: '에버랜드 할로윈' 같은 것을 매일 자동으로).
// ANTHROPIC_API_KEY가 있을 때만 돈다. 결과는 lib/trending 이 Redis에 저장해 홈 '요즘 뜨는 곳'에 섞는다.
// 비용: 하루 1번(웹 검색 최대 6번) — Claude Opus 5.5 기준 한 달 몇 달러
import Anthropic from "@anthropic-ai/sdk";
import { kst } from "./time";

export interface AiEvent {
  /** 행사 이름 (예: 에버랜드 할로윈 축제) */
  title: string;
  /** 열리는 곳 (예: 에버랜드) */
  venue: string;
  /** 시·도 (예: 경기) */
  region: string;
  /** YYYY-MM-DD (모르면 빈 값) */
  start: string;
  end: string;
  /** 공식 안내·기사 주소 */
  url: string;
  /** 왜 화제인지 한 줄 */
  why: string;
}

export const aiEventsEnabled = () => !!process.env.ANTHROPIC_API_KEY;

const SYSTEM = `너는 한국 여행 서비스 CrowdView의 편집자다. 웹 검색으로 지금 한국에서 사람들이 많이 찾는 축제·행사·테마파크 시즌 이벤트를 고른다.
기준: 오늘 진행 중이거나 2주 안에 시작하는 것, 최근 뉴스·SNS에서 화제인 것(예: 테마파크 할로윈·크리스마스 시즌 이벤트, 지역 대표 축제, 큰 팝업·전시).
확인되지 않은 날짜는 지어내지 말고 빈 문자열로 둔다. 공식 사이트나 언론 기사 주소만 쓴다.`;

function prompt(today: string) {
  return `오늘은 ${today}(한국 시간)이다. 지금 한국에서 가장 화제인 축제·행사·시즌 이벤트 8~10개를 찾아라.
마지막 답은 다른 말 없이 아래 모양의 JSON 배열 하나만 쓴다:
[{"title":"행사 이름","venue":"장소 이름","region":"시·도 (서울·경기·부산·제주·강원 등)","start":"YYYY-MM-DD 또는 빈 값","end":"YYYY-MM-DD 또는 빈 값","url":"https://...","why":"화제인 이유 한 줄 (40자 안)"}]`;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

/** 답에서 JSON 배열을 꺼내 모양을 확인한다 (모자란 항목은 버린다) */
export function parseAiEvents(text: string): AiEvent[] {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(m[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x: Record<string, unknown>) => ({
      title: str(x?.title, 80),
      venue: str(x?.venue, 60),
      region: str(x?.region, 20),
      start: date(x?.start),
      end: date(x?.end),
      url: /^https?:\/\//.test(str(x?.url, 500)) ? str(x?.url, 500) : "",
      why: str(x?.why, 80),
    }))
    .filter((e) => e.title && e.venue && e.url)
    .slice(0, 10);
}

/** 웹 검색 한 번으로 오늘의 화제 행사 목록. 키가 없으면 [] */
export async function fetchAiEvents(): Promise<AiEvent[]> {
  if (!aiEventsEnabled()) return [];
  const client = new Anthropic({ timeout: 5 * 60_000 });
  const today = kst().date;
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt(today) }];
  // 웹 검색이 길어지면 pause_turn 으로 멈춘다 → 받은 내용을 붙여 다시 보내면 이어서 한다 (최대 3번)
  for (let turn = 0; turn < 4; turn++) {
    const res = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "medium" },
      // 안전 분류기가 거절하면 서버가 알아서 다른 모델로 이어서 답한다
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      tools: [
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: 6,
          user_location: { type: "approximate", country: "KR", city: "Seoul", timezone: "Asia/Seoul" },
        },
      ],
      messages,
    });
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    if (res.stop_reason === "refusal") return [];
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return parseAiEvents(text);
  }
  return [];
}
