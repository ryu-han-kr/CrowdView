// 로그인한 회원의 '내 여행 계획' (저장한 코스). GET: 목록, PUT {plans:[…]}: 통째로 바꾸기 (담은 곳 동기화와 같은 방식)
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { pool, sql } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";

const MAX = 30;
const ID = /^[a-z2-9]{8}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

interface Plan {
  id: string;
  start: string;
  day: string;
  stops: string[];
  savedAt: string;
}

export async function GET(req: Request) {
  const limited = await rateLimit(req, "me");
  if (limited) return limited;
  const user = await currentUser(req.headers);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await sql<{ share_id: string; start_name: string; day: string; stops: string[]; saved_at: string }>(
    "select share_id, start_name, to_char(day, 'YYYY-MM-DD') as day, stops, saved_at from saved_plan where user_id = $1 order by position, saved_at desc",
    [user.id],
  );
  return NextResponse.json({
    plans: rows.map((r) => ({ id: r.share_id, start: r.start_name, day: r.day, stops: r.stops, savedAt: new Date(r.saved_at).toISOString() })),
  });
}

export async function PUT(req: Request) {
  const limited = await rateLimit(req, "me");
  if (limited) return limited;
  const user = await currentUser(req.headers);
  if (!user || !pool) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { plans?: unknown };
  const seen = new Set<string>();
  const plans: Plan[] = (Array.isArray(body.plans) ? body.plans : [])
    .map((p) => p as Partial<Plan>)
    .filter(
      (p): p is Plan => typeof p.id === "string" && ID.test(p.id) && typeof p.start === "string" && typeof p.day === "string" && DAY.test(p.day),
    )
    .filter((p) => !seen.has(p.id) && !!seen.add(p.id))
    .slice(0, MAX)
    .map((p) => ({
      id: p.id,
      start: p.start.slice(0, 60),
      day: p.day,
      stops: (Array.isArray(p.stops) ? p.stops : [])
        .filter((s): s is string => typeof s === "string")
        .slice(0, 10)
        .map((s) => s.slice(0, 60)),
      savedAt: typeof p.savedAt === "string" && !Number.isNaN(Date.parse(p.savedAt)) ? p.savedAt : new Date().toISOString(),
    }));
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from saved_plan where user_id = $1", [user.id]);
    for (const [i, p] of plans.entries())
      await client.query(
        "insert into saved_plan (user_id, share_id, start_name, day, stops, position, saved_at) values ($1, $2, $3, $4, $5, $6, $7)",
        [user.id, p.id, p.start, p.day, JSON.stringify(p.stops), i, p.savedAt],
      );
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
  return NextResponse.json({ plans });
}
