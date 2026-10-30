// 장소 '지금 이슈' 한 줄 (경수님 10/30: 무료 뉴스 검색으로 모은 기사를 AI가 정리). 웹 검색 없이 Haiku가 헤드라인·요약문만 읽는다.
// 기사가 바뀐 날에만 부른다 → 하루 많아야 약 20번 (lib/trending refreshPlaceNews). 한도는 lib/ai-quota
import Anthropic from "@anthropic-ai/sdk";
import type { Lang } from "@/i18n/config";
import { aiCreate, aiEnabled } from "./ai-quota";
import type { NewsHit } from "./web-search";

const LANGS = ["ko", "en", "ja", "zh-CN", "zh-TW"] as const satisfies readonly Lang[];

const SCHEMA = {
  type: "object",
  properties: {
    relevant: { type: "boolean" },
    ...Object.fromEntries(LANGS.map((l) => [l, { type: "string" }])),
  },
  required: ["relevant", ...LANGS],
  additionalProperties: false,
};

const SYSTEM = `너는 한국 여행 서비스 CrowdView의 편집자다. 한 장소의 최근 기사 제목·요약만 보고, 지금 그곳에 가려는 여행자에게 도움이 되는 소식을 한 줄로 정리한다.
행사·시즌 이벤트·개장·휴장·공사·요금 변경·혼잡 예상처럼 방문과 관련된 것만 쓴다. 기사에 없는 내용(날짜·숫자)은 지어내지 않는다.
방문과 상관없는 기사(실적·인사·사고 수습 등)뿐이면 relevant를 false로 하고 나머지는 빈 문자열로 둔다.
ko는 존댓말 '~해요'체 45자 안, en·ja·zh-CN·zh-TW는 같은 뜻으로 짧게 번역한다.`;

/** 기사 몇 개 → 언어별 한 줄. 방문과 상관없거나 AI를 쓸 수 없으면 undefined */
export async function summarizeNews(placeName: string, hits: NewsHit[]): Promise<Record<Lang, string> | undefined> {
  if (!aiEnabled() || !hits.length) return undefined;
  const list = hits.map((h, i) => `${i + 1}. ${h.title} (${h.source}${h.age ? `, ${h.age}` : ""})\n${h.description.slice(0, 200)}`).join("\n");
  const client = new Anthropic({ timeout: 60_000 });
  const res = await aiCreate(client, {
    model: "claude-haiku-5-5",
    max_tokens: 800,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: `장소: ${placeName}\n기사:\n${list}` }],
  });
  if (res.stop_reason === "refusal") return undefined;
  const text = res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    if (!j.relevant || typeof j.ko !== "string" || !j.ko.trim()) return undefined;
    return Object.fromEntries(LANGS.map((l) => [l, String(j[l] ?? j.ko).slice(0, 120)])) as Record<Lang, string>;
  } catch {
    return undefined;
  }
}
