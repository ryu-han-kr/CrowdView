// 장소 사진 사전조사 (경수님 10/30: 사진을 가져오기 전에 그곳의 유명 명소를 빡세게 조사 → 명소별로 사진을 찾는다).
// Claude가 웹 검색으로 대표 명소·포토 스폿과 위키미디어 공용 검색어를 정리한다. scripts/korea-data/photo-pick.mts 가 부른다 (CRON_SECRET 필요)
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const maxDuration = 300;

const SYSTEM = `너는 한국 여행 사진 편집자다. 한 장소에서 여행자들이 가장 많이 찍고 공유하는 대표 명소·포토 스폿을 웹 검색으로 조사한다.
공식 사이트·관광공사·블로그·인스타그램 후기에서 실제로 자주 나오는 것만 고른다. 지어내지 않는다.`;

const prompt = (name: string, address: string) => `장소: ${name} (${address})
이곳의 대표 명소·포토 스폿을 4~7개 조사하라. 시설(놀이기구·동물원·정원), 계절 행사(축제·퍼레이드·눈꽃), 시간대(야경·일몰) 모두 후보다.
각 명소마다 위키미디어 공용(Wikimedia Commons)에서 사진을 찾을 영어 검색어 2~3개(장소 영어 이름 + 명소 영어 이름, 예: "Everland rose garden")와 한국어 검색어 1개를 쓴다.
마지막 답은 다른 말 없이 JSON 하나만: {"nameEn":"장소 영어 이름","spots":[{"label":"화면에 쓸 짧은 한국어 이름(8자 안)","why":"왜 유명한지 한 줄","queries":["..."]}]}`;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "no key" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { name?: string; address?: string } | null;
  if (!body?.name) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const client = new Anthropic({ timeout: 240_000 });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt(body.name, body.address ?? "") }];
  for (let turn = 0; turn < 3; turn++) {
    const res = await client.beta.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 6000,
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
    if (res.stop_reason === "refusal") return NextResponse.json({ error: "refusal" }, { status: 422 });
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const m = text.match(/\{[\s\S]*\}/);
    try {
      return NextResponse.json({ ...JSON.parse(m?.[0] ?? ""), usage: res.usage });
    } catch {
      return NextResponse.json({ error: "bad output" }, { status: 502 });
    }
  }
  return NextResponse.json({ error: "too many turns" }, { status: 502 });
}
