// 장소 대표 사진 고르기 (경수님 10/29: Claude 크레딧으로 사진 품질 올리기). scripts/korea-data/photo-pick.mts 가 후보 사진을 작게 줄여 보내면
// Claude가 사진마다 점수·뺄지·설명(alt)을 매긴다. 키(ANTHROPIC_API_KEY)가 Vercel 비밀 값이라 운영 서버에서 돌린다 — CRON_SECRET이 있어야 부를 수 있다
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const maxDuration = 300;

const MODELS = ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"] as const;

const SCHEMA = {
  type: "object",
  properties: {
    photos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          n: { type: "integer" },
          score: { type: "integer" },
          reject: { type: "boolean" },
          reason: { type: "string" },
          alt: { type: "string" },
        },
        required: ["n", "score", "reject", "reason", "alt"],
        additionalProperties: false,
      },
    },
    hero: { type: "integer" },
  },
  required: ["photos", "hero"],
  additionalProperties: false,
};

const prompt = (name: string, category: string, count: number) => `여행 서비스 CrowdView의 '${name}'(${category}) 상세 화면 맨 위 사진을 고른다. 사진 ${count}장이 1번부터 순서대로 있다.
사진마다 1~10점을 매긴다. 기준:
- 이 장소가 어디인지 한눈에 알아보이는가 (대표 시설·전경·상징물). 다른 곳이나 엉뚱한 피사체면 낮게
- 선명하고 구도가 좋은가, 노출·색이 괜찮은가. 흐림·저화질·기울어짐·오래된 느낌이면 낮게
- 가로 사진일수록 좋다 (맨 위 칸이 가로로 넓다)
- ${category === "스키장" ? "눈 덮인 슬로프·리조트 전경이 가장 좋다. 눈 없는 여름 풍경은 낮게" : "놀이기구·성·퍼레이드처럼 그곳다운 장면이 가장 좋다"}
다음은 reject=true (화면에 쓰지 않는다): 지도·안내도·포스터·글자가 큰 이미지, 로고, 실내 매표소·식당 메뉴처럼 관광지 대표가 아닌 사진, 얼굴을 알아볼 수 있는 사람이 크게 나온 사진, 깨진 이미지.
reason은 한국어 한 문장, alt는 화면 읽기용 한국어 설명(40자 안). hero는 맨 위에 쓸 사진 번호.`;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "no key" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { name?: string; category?: string; model?: string; images?: string[] } | null;
  const images = (body?.images ?? []).filter((x) => typeof x === "string").slice(0, 24);
  if (!body?.name || !images.length) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const model = MODELS.find((m) => m === body.model) ?? "claude-haiku-5-5";

  const content: Anthropic.Beta.BetaContentBlockParam[] = images.flatMap((data, i) => [
    { type: "text" as const, text: `사진 ${i + 1}` },
    { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data } },
  ]);
  content.push({ type: "text", text: prompt(body.name, body.category ?? "", images.length) });

  const client = new Anthropic({ timeout: 240_000 });
  const res = await client.beta.messages.create({
    model,
    max_tokens: 8000,
    // Haiku는 서버 쪽 대체 모델이 없다
    ...(model === "claude-haiku-5-5" ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content }],
  });
  if (res.stop_reason === "refusal") return NextResponse.json({ error: "refusal" }, { status: 422 });
  const text = res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return NextResponse.json({ ...JSON.parse(text), model: res.model, usage: res.usage });
  } catch {
    return NextResponse.json({ error: "bad output", stop: res.stop_reason }, { status: 502 });
  }
}
