// 찜·담은 곳 공유 링크 만들기: POST { favorites: string[], picks: Pick[] } → { id } (/l/{id}, 30일 보관)
import { NextResponse } from "next/server";
import { cleanList, saveSharedList } from "@/lib/list-share";
import { clientIp, dailyLimit, rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const limited = (await rateLimit(req, "share")) ?? (await dailyLimit("share", clientIp(req), 50));
  if (limited) return limited;
  const list = cleanList(await req.json().catch(() => null));
  if (!list) return NextResponse.json({ error: "공유할 장소가 없어요" }, { status: 400 });
  const id = await saveSharedList(list);
  return NextResponse.json({ id });
}
