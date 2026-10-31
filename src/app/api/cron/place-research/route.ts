// 장소별 혼잡 관련 사실 모으기 (lib/place-research). 손으로 부르는 일:
// POST {part, size, force} — 대상(장소 + 서울 121곳)을 size곳씩 나눈 part번째를 5곳씩 동시에. GET ?ids=a,b 는 저장된 결과
import { NextResponse } from "next/server";
import { kv } from "@/lib/cache";
import { research, researchKey, researchTargets } from "@/lib/place-research";
import { kst } from "@/lib/time";

export const maxDuration = 300;

const authed = (req: Request) => {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
};

export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { part?: number; size?: number; force?: boolean } | null;
  const all = researchTargets();
  const size = Math.min(10, Math.max(1, Number(body?.size) || 5));
  const part = Math.max(0, Number(body?.part) || 0);
  const slice = all.slice(part * size, (part + 1) * size);
  const results: Record<string, string> = {};
  await Promise.all(
    slice.map(async (t) => {
      results[t.id] = await research(t, kst().date, !!body?.force).catch((e) => `error: ${e instanceof Error ? e.message : e}`);
    }),
  );
  return NextResponse.json({ total: all.length, part, parts: Math.ceil(all.length / size), results });
}

export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 100);
  const list = ids.length ? ids : researchTargets().map((t) => t.id).slice(0, 100);
  const raws = await kv.mget(list.map(researchKey)).catch(() => list.map(() => null));
  return NextResponse.json(Object.fromEntries(list.map((id, i) => [id, raws[i] ? JSON.parse(String(raws[i])) : null])));
}
