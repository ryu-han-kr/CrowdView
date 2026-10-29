// 장소 사진 고르기 (경수님 10/29: Claude 크레딧으로 사진 품질 올리기). scripts/korea-data/photo-pick.mts 가 후보 사진을 작게 줄여 보내면
// Claude가 사진마다 점수·뺄지·어느 대표 명소인지·설명(alt)을 매긴다. 키(ANTHROPIC_API_KEY)가 Vercel 비밀 값이라 운영 서버에서 돌린다 — CRON_SECRET이 있어야 부를 수 있다
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
          spot: { type: "string" },
          reason: { type: "string" },
          alt: { type: "string" },
        },
        required: ["n", "score", "reject", "spot", "reason", "alt"],
        additionalProperties: false,
      },
    },
    hero: { type: "integer" },
  },
  required: ["photos", "hero"],
  additionalProperties: false,
};

// 경수님 10/30 기준: 그곳의 유명한 명소(에버랜드라면 장미원·사파리·판다·야경·퍼레이드·놀이기구)가 매력적으로 나온 사진.
// 해상도 좋고, 구도가 예쁜 인스타 감성. 전경도 좋지만 한두 가지만 강조해 제대로 담은 사진도 좋다.
// 10/30 추가 (아고다 여행 가이드 사진 예시): 사진만 봐도 '어떤 곳인지' 설명되고, 색감이 좋고, 해상도가 높을 것
const prompt = (name: string, category: string, count: number, spots: string[]) => `여행 서비스 CrowdView의 '${name}'(${category}) 상세 화면 사진을 고른다. 사진 ${count}장이 1번부터 순서대로 있다.
이 사진들은 여행자가 "여기 가고 싶다"고 느끼게 하는 첫인상이다. 사진마다 1~10점을 매긴다.
높은 점수:
- 사진만 봐도 이곳이 어떤 곳인지 한눈에 설명되는 사진 (전망대라면 탑과 내려다본 도시, 궁궐이라면 전각과 마당)
- 이곳의 유명한 대표 명소가 매력적으로 나온 사진${spots.length ? ` (이곳의 대표 명소: ${spots.join(", ")})` : ""}
- 구도가 예쁘고 색감이 좋은(채도·하늘·빛이 살아 있는) 사진. 인스타그램에 올릴 만한 감성 (노을·꽃·퍼레이드처럼 분위기 있는 장면)
- 야경은 이곳이 야경으로 유명할 때만 높게 준다. 야경이 유명해도 낮의 대표 모습과 섞이게, 대표(hero)는 낮 사진을 우선
- 넓은 전경도 좋지만, 한두 가지(동물, 퍼레이드 차, 꽃길, 놀이기구 하나)만 크게 강조해 제대로 담은 사진도 똑같이 좋다
- 선명하고 해상도가 좋아 보이는 사진
낮은 점수: 흐림·어두움·기울어짐, 평범한 기록 사진(주차장·건물 외벽·매표소), 오래된 색감, 무엇을 찍었는지 모호한 사진${category === "스키장" ? ", 눈 없는 여름 풍경" : ""}.
reject=true (화면에 쓰지 않는다): 지도·안내도·포스터·글자가 큰 이미지, 로고, 얼굴을 알아볼 수 있는 일반인이 크게 나온 사진, 깨진 이미지, 이곳이 아닌 사진.
spot: 그 사진이 보여 주는 대표 명소 이름을 위 목록에서 그대로 고른다. 목록에 없거나 전경이면 "전경", 어디에도 안 맞으면 빈 값.
reason은 한국어 한 문장, alt는 화면 읽기용 한국어 설명(40자 안). hero는 맨 위 큰 칸에 쓸, 가장 매력적인 사진 번호.`;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "no key" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { name?: string; category?: string; model?: string; spots?: string[]; images?: string[] } | null;
  const images = (body?.images ?? []).filter((x) => typeof x === "string").slice(0, 40);
  if (!body?.name || !images.length) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const model = MODELS.find((m) => m === body.model) ?? "claude-haiku-5-5";
  const spots = (body.spots ?? []).filter((x) => typeof x === "string").slice(0, 10);

  const content: Anthropic.Beta.BetaContentBlockParam[] = images.flatMap((data, i) => [
    { type: "text" as const, text: `사진 ${i + 1}` },
    { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data } },
  ]);
  content.push({ type: "text", text: prompt(body.name, body.category ?? "", images.length, spots) });

  const client = new Anthropic({ timeout: 240_000 });
  const res = await client.beta.messages.create({
    model,
    max_tokens: 12000,
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
