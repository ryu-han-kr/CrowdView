// SK 장소 혼잡도(퍼즐)가 지원하는 장소 목록 (10/30: 남산서울타워가 TMAP 검색은 되는데 퍼즐은 NOT_FOUND_POI — 퍼즐은 정해진 장소만 된다).
// 운영 키가 Vercel 비밀 값이라 여기서 받아 돌려준다. scripts/korea-data/skt-pois.mts 가 불러 우리 장소와 맞춘다 (CRON_SECRET 필요)
import { NextResponse } from "next/server";

export const maxDuration = 120;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const key = process.env.SK_OPENAPI_APP_KEY;
  if (!key) return NextResponse.json({ error: "no key" }, { status: 503 });
  const q = new URL(req.url).searchParams;
  // 실시간 응답 원문 확인용 (10/30: 혼잡도 수치로 인원을 환산하려고 필드를 본다)
  const poi = q.get("rltm");
  if (poi && /^\d+$/.test(poi)) {
    const r = await fetch(`https://apis.openapi.sk.com/puzzle/place/congestion/rltm/pois/${poi}`, { headers: { appKey: key, accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
    return new NextResponse(await r.text(), { status: r.status, headers: { "content-type": "application/json" } });
  }
  const kind = q.get("kind") === "areas" ? "areas" : "pois";
  // 3만 곳이 넘어 나눠 받는다 (offset·limit)
  const page = new URLSearchParams({ offset: String(Number(q.get("offset")) || 0), limit: String(Math.min(Number(q.get("limit")) || 1000, 5000)) });
  const res = await fetch(`https://apis.openapi.sk.com/puzzle/place/meta/${kind}?${page}`, { headers: { appKey: key, accept: "application/json" }, signal: AbortSignal.timeout(60_000) });
  const text = await res.text();
  return new NextResponse(text, { status: res.status, headers: { "content-type": res.headers.get("content-type") ?? "application/json" } });
}
