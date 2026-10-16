// 혼잡 알림 (Plus). GET: 내 알림 목록, POST {placeId, kind, subscription, lang}: 켜기, DELETE {placeId, kind}: 끄기
import { NextResponse } from "next/server";
import { pushEnabled, savePushSubscription, type PushSub } from "@/lib/alerts";
import { sql } from "@/lib/db";
import { PLACES } from "@/lib/places";
import { isPlus, markPlusUsed } from "@/lib/plus";
import { errorJson, requireUser, unauthorized } from "@/lib/plus-http";

const KINDS = ["calm", "busy"] as const;

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return unauthorized();
  const rows = await sql<{ place_id: string; kind: string }>("select place_id, kind from crowd_alert where user_id = $1", [user.id]);
  return NextResponse.json({ alerts: rows.map((r) => ({ placeId: r.place_id, kind: r.kind })) });
}

export async function POST(req: Request) {
  if (!pushEnabled) return NextResponse.json({ error: "알림 준비 중이에요" }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return unauthorized();
  if (!(await isPlus(user.id))) return NextResponse.json({ error: "Plus 회원만 쓸 수 있어요" }, { status: 402 });
  const body = (await req.json().catch(() => ({}))) as { placeId?: string; kind?: string; subscription?: PushSub; lang?: string };
  if (!PLACES.some((p) => p.id === body.placeId) || !KINDS.includes(body.kind as (typeof KINDS)[number])) return errorJson("잘못된 요청");
  if (!body.subscription?.endpoint || !body.subscription.keys?.p256dh) return errorJson("알림 권한이 필요해요");
  await savePushSubscription(user.id, body.subscription, body.lang ?? "ko");
  await sql("insert into crowd_alert (user_id, place_id, kind) values ($1, $2, $3) on conflict do nothing", [user.id, body.placeId, body.kind]);
  // 유료 기능 사용 기록 (7일 환불 판단)
  await markPlusUsed(user.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await requireUser(req);
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { placeId?: string; kind?: string };
  await sql("delete from crowd_alert where user_id = $1 and place_id = $2 and kind = $3", [user.id, body.placeId, body.kind]);
  return NextResponse.json({ ok: true });
}
