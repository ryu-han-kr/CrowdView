// 로그인한 회원의 찜 목록 (기기 사이 동기화). GET: 목록, PUT {ids}: 통째로 바꾸기
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { pool, sql } from "@/lib/db";
import { PLACES } from "@/lib/places";

const KNOWN = new Set(PLACES.map((p) => p.id));

export async function GET(req: Request) {
  const user = await currentUser(req.headers);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await sql<{ place_id: string }>("select place_id from favorite where user_id = $1 order by created_at", [user.id]);
  return NextResponse.json({ ids: rows.map((r) => r.place_id) });
}

export async function PUT(req: Request) {
  const user = await currentUser(req.headers);
  if (!user || !pool) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.filter((x): x is string => typeof x === "string" && KNOWN.has(x)))].slice(0, 200) : [];
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from favorite where user_id = $1 and not (place_id = any($2::text[]))", [user.id, ids]);
    if (ids.length)
      await client.query(
        "insert into favorite (user_id, place_id) select $1, unnest($2::text[]) on conflict do nothing",
        [user.id, ids],
      );
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
  return NextResponse.json({ ids });
}
