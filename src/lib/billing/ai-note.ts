// 비용 보고서 '어제 이상한 점' 한두 줄 (경수님 10/30: API로 하면 좋은 것 6번). 지난 7일 API 호출 수와 어제를 비교해
// 평소의 2배가 넘게 튄 것만 골라 Haiku가 짧게 설명한다. 튄 게 없으면 AI를 부르지 않는다
import Anthropic from "@anthropic-ai/sdk";
import { aiCreate, aiEnabled } from "../ai-quota";
import { getApiUsage, type ApiUsage } from "../api-quota";

export interface Spike {
  name: string;
  yesterday: number;
  avg: number;
  unit: string;
}

/** 어제가 앞선 6일 평균의 2배 넘고 10 이상이면 '튐' */
export function findSpikes(yesterday: ApiUsage[], before: ApiUsage[][]): Spike[] {
  return yesterday
    .map((a) => {
      const prev = before.map((d) => d.find((x) => x.id === a.id)?.count ?? 0);
      const avg = prev.length ? prev.reduce((s, n) => s + n, 0) / prev.length : 0;
      return { name: a.name, yesterday: a.count, avg: Math.round(avg * 10) / 10, unit: a.unit ?? "회" };
    })
    .filter((s) => s.yesterday >= 10 && s.yesterday > Math.max(s.avg, 1) * 2);
}

const ymd = (d: Date) => new Date(d.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);

/** 어제(periodEnd)와 그 앞 6일을 비교한 한두 줄. 튄 게 없거나 AI를 못 쓰면 undefined */
export async function costAiNote(periodEnd: string, yesterday: ApiUsage[]): Promise<string | undefined> {
  const end = new Date(`${periodEnd}T00:00:00+09:00`);
  const before = await Promise.all([1, 2, 3, 4, 5, 6].map((i) => getApiUsage(ymd(new Date(end.getTime() - i * 86_400_000))).catch(() => [])));
  const spikes = findSpikes(yesterday, before);
  if (!spikes.length || !aiEnabled()) return undefined;
  const list = spikes.map((s) => `- ${s.name}: 어제 ${s.yesterday}${s.unit}, 지난 6일 평균 ${s.avg}${s.unit}`).join("\n");
  const res = await aiCreate(new Anthropic({ timeout: 60_000 }), {
    model: "claude-haiku-5-5",
    max_tokens: 300,
    system:
      "너는 CrowdView 운영 보조다. 평소보다 튄 외부 API 사용량을 보고 운영자에게 한두 문장으로 알린다. 무엇이 몇 배 늘었는지, 비용·한도 위험이 있는지만 쓴다. 원인은 추측이라고 밝힌다. 존댓말 '~해요'체.",
    messages: [{ role: "user", content: list }],
  });
  const text = res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return text ? text.slice(0, 300) : undefined;
}
