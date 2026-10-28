// 유료 '지금 실제 인원 보기' (SK텔레콤 장소 혼잡도). GET: 남은 횟수, POST: 불러오기 (단계별 하루·월 횟수, 10분 공유 캐시)
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { getPlace } from "@/lib/places";
import { getPlus, markPlusUsed } from "@/lib/plus";
import { errorJson, requireUser, unauthorized } from "@/lib/plus-http";
import { liveCount, liveLeft } from "@/lib/live-count";
import { isAdminEmail } from "@/lib/admin";
import { asPlan } from "@/lib/business";

const noStore = { headers: { "cache-control": "no-store" } };

async function member(req: Request) {
  const user = await requireUser(req);
  if (!user) return { res: unauthorized() };
  // 운영자(ADMIN_EMAILS)는 결제 없이 가장 높은 단계(Max)처럼 시험할 수 있다 (경수님 10/28 '버튼 잘 작동하나 확인')
  if (isAdminEmail(user.email)) return { user, plan: "max" as const };
  const plus = await getPlus(user.id);
  if (!plus.active) return { res: NextResponse.json({ error: "유료 회원 전용이에요" }, { status: 403 }) };
  return { user, plan: asPlan(plus.plan) };
}

export async function GET(req: Request) {
  const m = await member(req);
  if ("res" in m) return m.res;
  return NextResponse.json({ plan: m.plan, left: await liveLeft(m.user.id, m.plan) }, noStore);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await rateLimit(req, "alerts");
  if (limited) return limited;
  const m = await member(req);
  if ("res" in m) return m.res;
  const place = getPlace((await params).id);
  if (!place) return errorJson("장소를 찾지 못했어요", 404);
  if (!process.env.SK_OPENAPI_APP_KEY) return NextResponse.json({ error: "실제 인원 연결을 준비하고 있어요" }, { status: 503 });
  try {
    const r = await liveCount(m.user.id, m.plan, { id: place.id, name: place.name, lat: place.lat, lng: place.lng });
    if (r.data) await markPlusUsed(m.user.id).catch(() => {});
    return NextResponse.json({ plan: m.plan, ...r }, { ...noStore, status: r.error && !r.data ? 429 : 200 });
  } catch (e) {
    return errorJson(e, 500);
  }
}
