// 로그인한 회원의 담은 곳(☆) 목록 (기기 사이 동기화). GET: 목록, PUT {picks:[{id,label}]}: 통째로 바꾸기
// 주소(href)는 이용자가 보낸 값을 쓰지 않고 id로 만든다 (seoul-<코드> → /seoul/<코드>, vs-<id> → /guide/<id>)
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { pool, sql } from "@/lib/db";
import { getGuidePlace } from "@/lib/seoul-guide";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { PLACES, placeHref } from "@/lib/places";
import { rateLimit } from "@/lib/ratelimit";

const MAX = 50;

function hrefOf(id: string): string | undefined {
  const place = PLACES.find((p) => p.id === id);
  if (place) return placeHref(place);
  if (id.startsWith("seoul-")) return SEOUL_AREAS.some((a) => a.code === id.slice(6)) ? `/seoul/${id.slice(6)}` : undefined;
  if (id.startsWith("vs-")) return getGuidePlace(id) ? `/guide/${id}` : undefined;
  return undefined;
}

export async function GET(req: Request) {
  const limited = await rateLimit(req, "me");
  if (limited) return limited;
  const user = await currentUser(req.headers);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await sql<{ pick_id: string; label: string }>("select pick_id, label from pick where user_id = $1 order by position, created_at", [user.id]);
  return NextResponse.json({ picks: rows.flatMap((r) => (hrefOf(r.pick_id) ? [{ id: r.pick_id, label: r.label, href: hrefOf(r.pick_id)! }] : [])) });
}

export async function PUT(req: Request) {
  const limited = await rateLimit(req, "me");
  if (limited) return limited;
  const user = await currentUser(req.headers);
  if (!user || !pool) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { picks?: unknown };
  const seen = new Set<string>();
  const picks = (Array.isArray(body.picks) ? body.picks : [])
    .map((p) => p as { id?: unknown; label?: unknown })
    .filter((p): p is { id: string; label: string } => typeof p.id === "string" && typeof p.label === "string" && !!hrefOf(p.id))
    .filter((p) => !seen.has(p.id) && !!seen.add(p.id))
    .slice(0, MAX)
    .map((p) => ({ id: p.id, label: p.label.slice(0, 60) }));
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from pick where user_id = $1", [user.id]);
    if (picks.length)
      await client.query(
        "insert into pick (user_id, pick_id, label, position) select $1, x.id, x.label, x.pos from unnest($2::text[], $3::text[], $4::int[]) as x(id, label, pos)",
        [user.id, picks.map((p) => p.id), picks.map((p) => p.label), picks.map((_, i) => i)],
      );
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
  return NextResponse.json({ picks: picks.map((p) => ({ ...p, href: hrefOf(p.id) })) });
}
