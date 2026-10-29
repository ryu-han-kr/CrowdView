// 유료 'AI 여행 요약' (입장권·교통·볼거리·추천). GET ?lang= → 장소·언어별 요약 (처음 한 번은 웹 검색으로 만들어 14일 보관)
import { NextResponse } from "next/server";
import { isLang } from "@/i18n/config";
import { isAdminEmail } from "@/lib/admin";
import { getLivePlace } from "@/lib/place-info";
import { getPlus } from "@/lib/plus";
import { errorJson, requireUser, unauthorized } from "@/lib/plus-http";
import { dailyLimit, rateLimit } from "@/lib/ratelimit";
import { kst } from "@/lib/time";
import { getTripBrief } from "@/lib/trip-brief";

// 웹 검색까지 하면 1분 안팎 걸린다
export const maxDuration = 300; // 웹 검색 여러 번이면 2분 넘게 걸린다 (10/29 롯데월드 129초)

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await rateLimit(req, "alerts");
  if (limited) return limited;
  const user = await requireUser(req);
  if (!user) return unauthorized();
  if (!isAdminEmail(user.email) && !(await getPlus(user.id)).active) return NextResponse.json({ error: "유료 회원 전용이에요" }, { status: 403 });
  // 한 회원이 하루에 새로 여는 요약 수 (저장된 요약도 센다 — 긁어 가기 방지)
  const daily = await dailyLimit("brief", user.id, 40);
  if (daily) return daily;
  const place = await getLivePlace((await params).id);
  if (!place) return errorJson("장소를 찾을 수 없어요", 404);
  const lang = new URL(req.url).searchParams.get("lang") ?? "ko";
  try {
    const brief = await getTripBrief(place, isLang(lang) ? lang : "ko", kst().date);
    return NextResponse.json({ brief }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorJson(e, 503);
  }
}
