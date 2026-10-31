// 이미 아는 이름을 미리 번역해 둔다 (경수님 10/31: 11월 1일 크레딧이 새로 차기 전에 남은 Claude 크레딧으로 할 수 있는 일은 오늘).
// 축제(60일)·서울 지역·장소 주소·출발 거점·그 언어 글이 없는 서울 가이드 이름 → lib/name-translate (Claude Haiku, Redis 180일).
// 이미 번역된 이름은 건너뛴다. 손으로 가끔 부르는 일: POST {lang, part, size} — 한 번에 size개씩 끊어 시간 안에 끝낸다
import { NextResponse } from "next/server";
import { isLang } from "@/i18n/config";
import { getFestivals } from "@/lib/festivals";
import { translateNames } from "@/lib/name-translate";
import { PLACES } from "@/lib/places";
import { START_HUBS } from "@/lib/route-data";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { GUIDE, guideText } from "@/lib/seoul-guide";

export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { lang?: string; part?: number; size?: number } | null;
  const lang = body?.lang;
  if (!isLang(lang) || lang === "ko") return NextResponse.json({ error: "bad lang" }, { status: 400 });
  const festivals = await getFestivals(60).catch(() => []);
  const names = [
    ...new Set(
      [
        ...festivals.flatMap((f) => [f.title, f.region, f.place]),
        ...SEOUL_AREAS.map((a) => a.name),
        ...PLACES.map((p) => p.address),
        ...START_HUBS.map((h) => h.name),
        ...GUIDE.filter((g) => guideText(g, lang).lang === "ko").map((g) => g.t.ko!.n),
      ].filter((s): s is string => !!s),
    ),
  ];
  const size = Math.min(600, Math.max(60, Number(body?.size) || 300));
  const part = Math.max(0, Number(body?.part) || 0);
  const slice = names.slice(part * size, (part + 1) * size);
  const done = await translateNames(slice, lang);
  return NextResponse.json({ lang, total: names.length, part, parts: Math.ceil(names.length / size), sent: slice.length, translated: done.size });
}
