// SK 장소 혼잡도(퍼즐)가 지원하는 장소 목록 (10/30: 남산서울타워가 TMAP 검색은 되는데 퍼즐은 NOT_FOUND_POI — 퍼즐은 정해진 장소만 된다).
// 운영 키가 Vercel 비밀 값이라 여기서 받아 돌려준다. scripts/korea-data/skt-pois.mts 가 불러 우리 장소와 맞춘다 (CRON_SECRET 필요)
import { NextResponse } from "next/server";

export const maxDuration = 120;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const key = process.env.SK_OPENAPI_APP_KEY;
  if (!key) return NextResponse.json({ error: "no key" }, { status: 503 });
  const kind = new URL(req.url).searchParams.get("kind") === "areas" ? "areas" : "pois";
  const res = await fetch(`https://apis.openapi.sk.com/puzzle/place/meta/${kind}`, { headers: { appKey: key, accept: "application/json" }, signal: AbortSignal.timeout(60_000) });
  const text = await res.text();
  return new NextResponse(text, { status: res.status, headers: { "content-type": res.headers.get("content-type") ?? "application/json" } });
}
