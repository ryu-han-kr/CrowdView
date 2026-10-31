// 구글 장소 정보(평점·리뷰 수·운영 시간·영업 상태, lib/google-facts) 몰아 받기: 처음 채우거나 밀린 곳을 한 번에.
// 평소에는 수집기(api/cron/refresh)가 매시 몇 곳씩 10일 지난 곳만 다시 받는다. CRON_SECRET이 있어야 부를 수 있다.
// body: { size } (기본 20, 최대 60). 이달 상세 호출이 900건(무료 1,000건의 90%)에 닿으면 멈춘다
import { NextResponse } from "next/server";
import { refreshGoogleFacts } from "@/lib/google-facts";
import { PLACES } from "@/lib/places";

export const maxDuration = 60;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.GOOGLE_PLACES_API_KEY) return NextResponse.json({ error: "no key" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { size?: number } | null;
  const size = Math.min(60, Math.max(1, Number(body?.size) || 20));
  return NextResponse.json(await refreshGoogleFacts(PLACES, size));
}
