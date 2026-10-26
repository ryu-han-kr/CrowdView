// 이용 집계 비콘 (components/TrafficBeacon → lib/traffic). 봇·자동화 브라우저는 버린다. 응답 본문 없음
import { isBot, recordBeacon, type Beacon } from "@/lib/traffic";

export async function POST(req: Request) {
  if (isBot(req.headers.get("user-agent") ?? "")) return new Response(null, { status: 204 });
  const b = (await req.json().catch(() => null)) as Partial<Beacon> | null;
  if (!b || typeof b.vid !== "string") return new Response(null, { status: 400 });
  await recordBeacon({
    vid: b.vid,
    lang: String(b.lang ?? ""),
    mobile: !!b.mobile,
    plus: !!b.plus,
    session: !!b.session,
    pv: Number(b.pv ?? 0),
    ads: Array.isArray(b.ads) ? b.ads.map(String) : [],
    aff: Array.isArray(b.aff) ? b.aff.map(String) : [],
    pages: Array.isArray(b.pages) ? b.pages.map(String) : [],
    land: typeof b.land === "string" ? b.land : undefined,
    deep: typeof b.deep === "string" ? b.deep : undefined,
  }).catch(() => {});
  return new Response(null, { status: 204 });
}
