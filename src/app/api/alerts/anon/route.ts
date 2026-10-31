// 로그인 없는 '한산해지면 알림' (lib/alerts-anon). POST {action: "on", placeId, subscription, lang} 켜기 /
// {action: "off", endpoint} 끄기 / {action: "status", endpoint} → {placeId}. 구독 주소는 주소창에 싣지 않으려고 모두 POST
import { NextResponse } from "next/server";
import { alertTarget, pushEnabled, type PushSub } from "@/lib/alerts";
import { deleteAnonAlert, getAnonAlert, saveAnonAlert } from "@/lib/alerts-anon";
import { getAllCrowd } from "@/lib/crowd/service";
import { errorJson } from "@/lib/plus-http";
import { dailyLimit, rateLimit, clientIp } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const limited = await rateLimit(req, "alerts");
  if (limited) return limited;
  if (!pushEnabled) return NextResponse.json({ error: "알림 준비 중이에요" }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; placeId?: string; subscription?: PushSub; endpoint?: string; lang?: string };
  if (body.action === "status" || body.action === "off") {
    if (!body.endpoint) return errorJson("잘못된 요청");
    if (body.action === "off") await deleteAnonAlert(body.endpoint);
    return NextResponse.json({ placeId: body.action === "status" ? await getAnonAlert(body.endpoint) : null });
  }
  if (body.action !== "on" || !body.placeId || !alertTarget(body.placeId)) return errorJson("잘못된 요청");
  if (!body.subscription?.endpoint || !body.subscription.keys?.p256dh) return errorJson("알림 권한이 필요해요");
  // 한 IP가 하루 20번 넘게 바꾸면 막는다 (알림 하나라 정상 사용은 몇 번이면 충분)
  const daily = await dailyLimit("alerts-anon", clientIp(req), 20);
  if (daily) return daily;
  // 지금 점수를 기준으로 저장 → 이미 한산하면 한 번 붐볐다가 다시 한산해질 때 알린다 (화면에 '지금도 한산해요' 안내)
  const crowd = body.placeId.startsWith("seoul-") ? undefined : (await getAllCrowd().catch(() => undefined))?.[body.placeId];
  const now = crowd?.open ? (crowd.score ?? null) : null;
  await saveAnonAlert(body.placeId, body.subscription, body.lang ?? "ko", now);
  return NextResponse.json({ ok: true, calmNow: now !== null && now < 40 });
}
