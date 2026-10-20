// 여행 날짜 저장 (Plus). GET: 내 저장 날짜, POST { placeId, date, subscription, lang }: 저장, DELETE { placeId, date }: 지우기
// 저장하면 매일 아침 그날 예측을 다시 보고, 단계가 바뀌거나 전날이 되면 웹 푸시 (lib/trip-watch)
import { NextResponse } from "next/server";
import { pushEnabled, savePushSubscription, type PushSub } from "@/lib/alerts";
import { sql } from "@/lib/db";
import { isPlus, markPlusUsed } from "@/lib/plus";
import { errorJson, requireUser, unauthorized } from "@/lib/plus-http";
import { rateLimit } from "@/lib/ratelimit";
import { placeHref } from "@/lib/places";
import { addDays, kst } from "@/lib/time";
import { markTripsExist, tripForecast, tripPlace } from "@/lib/trip-watch";

const validDate = (d?: string): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= kst().date && d <= addDays(kst().date, 365);

export async function GET(req: Request) {
  const limited = await rateLimit(req, "alerts");
  if (limited) return limited;
  const user = await requireUser(req);
  if (!user) return unauthorized();
  const rows = await sql<{ place_id: string; date: string }>(
    "select place_id, to_char(date, 'YYYY-MM-DD') as date from trip_watch where user_id = $1 and date >= $2 order by date",
    [user.id, kst().date],
  );
  return NextResponse.json({
    trips: rows.map((r) => {
      const p = tripPlace(r.place_id);
      return { placeId: r.place_id, date: r.date, name: p?.name ?? r.place_id, href: p && placeHref(p) };
    }),
  });
}

export async function POST(req: Request) {
  const limited = await rateLimit(req, "alerts");
  if (limited) return limited;
  if (!pushEnabled) return NextResponse.json({ error: "알림 준비 중이에요" }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return unauthorized();
  if (!(await isPlus(user.id))) return NextResponse.json({ error: "Plus 회원만 쓸 수 있어요" }, { status: 402 });
  const body = (await req.json().catch(() => ({}))) as { placeId?: string; date?: string; subscription?: PushSub; lang?: string };
  const place = body.placeId ? tripPlace(body.placeId) : undefined;
  if (!place || !validDate(body.date)) return errorJson("잘못된 요청");
  if (!body.subscription?.endpoint || !body.subscription.keys?.p256dh) return errorJson("알림 권한이 필요해요");
  // 회원당 30개까지 (매일 아침 날짜마다 예측을 다시 계산한다)
  const [{ n }] = await sql<{ n: number }>("select count(*)::int as n from trip_watch where user_id = $1", [user.id]);
  if (n >= 30) return errorJson("여행 날짜는 30개까지 저장할 수 있어요");
  await savePushSubscription(user.id, body.subscription, body.lang ?? "ko");
  // 저장할 때의 예측 단계를 기준으로 둔다 (그 뒤로 바뀌면 알림)
  const { level } = await tripForecast(place, body.date);
  await sql(
    "insert into trip_watch (user_id, place_id, date, last_level) values ($1, $2, $3, $4) on conflict (user_id, place_id, date) do nothing",
    [user.id, place.id, body.date, level],
  );
  await markTripsExist();
  await markPlusUsed(user.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const limited = await rateLimit(req, "alerts");
  if (limited) return limited;
  const user = await requireUser(req);
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { placeId?: string; date?: string };
  await sql("delete from trip_watch where user_id = $1 and place_id = $2 and date = $3", [user.id, body.placeId, body.date]);
  return NextResponse.json({ ok: true });
}
