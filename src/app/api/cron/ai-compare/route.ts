// Opus·Sonnet 비교 (경수님 10/30: '요즘 뜨는 곳' 화제 행사를 Sonnet으로 바꾸면 얼마나 달라지는지). 같은 프롬프트로 두 모델을 돌려 결과·시간을 돌려준다.
// 관리자 전용(CRON_SECRET). 저장하지 않는다
import { NextResponse } from "next/server";
import { fetchAiEvents } from "@/lib/ai-events";
import { aiEnabled } from "@/lib/ai-quota";

export const maxDuration = 800;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!aiEnabled()) return NextResponse.json({ error: "no key" }, { status: 503 });
  const run = async (model: "claude-opus-5-5" | "claude-sonnet-5-5") => {
    const t = Date.now();
    const events = await fetchAiEvents(model, true).catch((e) => ({ error: String(e) }));
    return { model, seconds: Math.round((Date.now() - t) / 1000), events };
  };
  const [opus, sonnet] = await Promise.all([run("claude-opus-5-5"), run("claude-sonnet-5-5")]);
  return NextResponse.json({ opus, sonnet });
}
