// Claude API 호출 상한 (경수님 10/30). 모든 Claude 호출은 aiCreate로 부른다.
// - 호출 1번마다 'anthropic'(하루·월)을 1 올린다
// - 웹 검색은 부르기 전에 max_uses만큼 'anthropic-search'를 잡아 두고, 끝나면 실제로 쓴 수만 남긴다
// - 응답마다 토큰·검색 수로 비용(달러)을 쌓는다 (lib/ai-cost → 비용 보고서)
// - 한도 90%에 닿으면 QuotaError (호출부는 AI 없이 기본 결과로 간다). AI_DISABLED=1이면 모든 Claude 호출을 끈다
import type Anthropic from "@anthropic-ai/sdk";
import { recordAiCost } from "./ai-cost";
import { APIS, beforeCall, refundCall } from "./api-quota";

const AI = APIS.find((a) => a.id === "anthropic");
const AI_SEARCH = APIS.find((a) => a.id === "anthropic-search");

/** 키가 있고 꺼 두지 않았을 때만 Claude를 부른다 */
export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY && process.env.AI_DISABLED !== "1";

type Params = Anthropic.Beta.MessageCreateParamsNonStreaming;

/** 이번 요청에서 웹 검색을 많아야 몇 번 하는지 (도구의 max_uses 합) */
const searchBudget = (p: Params) =>
  (p.tools ?? []).reduce((n, t) => n + ("type" in t && typeof t.type === "string" && t.type.startsWith("web_search") ? Number((t as { max_uses?: number }).max_uses ?? 10) : 0), 0);

/** 상한을 확인하고 Claude를 부른다 */
export async function aiCreate(client: Anthropic, params: Params): Promise<Anthropic.Beta.BetaMessage> {
  const budget = searchBudget(params);
  await beforeCall(AI);
  if (budget) {
    try {
      await beforeCall(AI_SEARCH, budget);
    } catch (e) {
      await refundCall(AI, 1);
      throw e;
    }
  }
  let res: Anthropic.Beta.BetaMessage | undefined;
  try {
    res = await client.beta.messages.create(params);
    return res;
  } finally {
    const used = res?.usage.server_tool_use?.web_search_requests ?? 0;
    if (budget) await refundCall(AI_SEARCH, budget - Math.min(used, budget));
    // 비용 보고서용 달러 집계 (lib/ai-cost). 실패해도 응답은 그대로
    if (res) await recordAiCost(params.model, res.usage).catch(() => {});
  }
}
