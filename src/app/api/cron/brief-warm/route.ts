// 'AI 여행 요약'(lib/trip-brief)을 미리 만들어 둔다 (경수님 10/31 '크레딧 써': 매달 1일 초기화 전 남은 Claude 크레딧으로).
// Plus 회원이 처음 열 때 1~2분 기다리던 것을 바로 보이게. 이미 저장된 곳은 건너뛴다(14일 보관).
// 손으로 부르는 일: POST {lang, part, size} — 오락실·클라이밍장·행사는 빼고, 한 번에 size곳을 5곳씩 동시에
import { NextResponse } from "next/server";
import { isLang } from "@/i18n/config";
import { getLivePlace } from "@/lib/place-info";
import { PLACES } from "@/lib/places";
import { kst } from "@/lib/time";
import { getTripBrief } from "@/lib/trip-brief";

export const maxDuration = 300;

const SMALL = /^(climb-|zzang-|funcity-|funnyland-|daebbang-|wadada-|gamepark-|cubezone-)/;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { lang?: string; part?: number; size?: number } | null;
  const lang = body?.lang;
  if (!isLang(lang)) return NextResponse.json({ error: "bad lang" }, { status: 400 });
  const ids = PLACES.filter((p) => p.category !== "event" && p.category !== "airport" && !SMALL.test(p.id)).map((p) => p.id);
  const size = Math.min(15, Math.max(1, Number(body?.size) || 10));
  const part = Math.max(0, Number(body?.part) || 0);
  const slice = ids.slice(part * size, (part + 1) * size);
  const results: Record<string, string> = {};
  for (let i = 0; i < slice.length; i += 5) {
    await Promise.all(
      slice.slice(i, i + 5).map(async (id) => {
        const place = await getLivePlace(id);
        if (!place) return;
        results[id] = await getTripBrief(place, lang, kst().date)
          .then((b) => b.source)
          .catch((e) => `error: ${e instanceof Error ? e.message : e}`);
      }),
    );
  }
  return NextResponse.json({ lang, total: ids.length, part, parts: Math.ceil(ids.length / size), results });
}
