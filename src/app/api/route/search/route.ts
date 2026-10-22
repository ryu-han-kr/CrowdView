// 코스 추천 '가고 싶은 곳' 검색 (사용자 10/22: 5곳 툭 던지지 말고 내가 찾아 넣게).
// 우리 자료(장소·명소·관광지·여행 가이드·문화공간·서울 지역) 먼저, 카카오 장소 검색이 켜져 있으면 카페·매장도
import { NextResponse } from "next/server";
import { isLang } from "@/i18n/config";
import { kakaoSearch } from "@/lib/kakao-local";
import { LANDMARKS } from "@/lib/korea";
import { PLACES, placeHref } from "@/lib/places";
import { rateLimit } from "@/lib/ratelimit";
import { CULTURE, GUIDE } from "@/lib/seoul-guide";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import spots from "@/data/korea/spots.json";

interface Hit {
  name: string;
  sub: string;
  lat: number;
  lng: number;
  href?: string;
  /** 정확히 같은 이름 0, 앞부분 1, 포함 2 */
  rank: number;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

export async function GET(req: Request) {
  const limited = await rateLimit(req, "search");
  if (limited) return limited;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 40);
  const lang = url.searchParams.get("lang") ?? "ko";
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (q.length < 1) return NextResponse.json({ hits: [] });
  const nq = norm(q);
  const out: Hit[] = [];
  const add = (names: (string | undefined)[], h: Omit<Hit, "rank" | "name"> & { name: string }) => {
    let best = 9;
    for (const n of names) {
      if (!n) continue;
      const x = norm(n);
      const r = x === nq ? 0 : x.startsWith(nq) ? 1 : x.includes(nq) ? 2 : 9;
      best = Math.min(best, r);
    }
    if (best < 9) out.push({ ...h, rank: best });
  };
  const l = isLang(lang) ? lang : "ko";
  for (const p of PLACES) add([p.name, p.region], { name: p.name, sub: p.region, lat: p.lat, lng: p.lng, href: placeHref(p) });
  for (const m of LANDMARKS) add(Object.values(m.n), { name: m.n[l] ?? m.n.ko, sub: m.region, lat: m.lat, lng: m.lng });
  for (const a of SEOUL_AREAS) add([a.name], { name: a.name, sub: "서울", lat: a.lat, lng: a.lng, href: `/seoul/${a.code}` });
  for (const g of GUIDE) if (g.lat && g.lng) add([g.t.ko?.n, g.t.en?.n, g.t[l]?.n], { name: g.t[l]?.n ?? g.t.ko?.n ?? g.id, sub: g.gu ?? "서울", lat: g.lat, lng: g.lng, href: `/guide/${g.id}` });
  for (const c of CULTURE) if (c.lat && c.lng) add([c.n], { name: c.n, sub: `${c.gu ?? ""} ${c.k}`.trim(), lat: c.lat, lng: c.lng });
  for (const s of spots as [string, string, string, string, number, number, string, string][]) add([s[3]], { name: s[3], sub: [s[2], s[7]].filter(Boolean).join(" "), lat: s[4], lng: s[5] });

  // 카카오 (켜져 있을 때): 카페·매장·식당 등 우리 자료에 없는 곳. 출발지가 있으면 그 둘레부터
  const near = lat > 33 && lat < 39 && lng > 124 && lng < 132 ? { lat, lng, radius: 20000 } : undefined;
  for (const k of await kakaoSearch(q, near, 10)) {
    if (out.some((h) => norm(h.name) === norm(k.name) && Math.abs(h.lat - k.lat) < 0.002)) continue;
    out.push({ name: k.name, sub: k.category.split(" > ").slice(-1)[0] + (k.address ? ` · ${k.address.split(" ").slice(0, 3).join(" ")}` : ""), lat: k.lat, lng: k.lng, href: k.url, rank: 1.5 });
  }
  const hits = out
    .sort((a, b) => a.rank - b.rank || a.name.length - b.name.length)
    .filter((h, i, arr) => arr.findIndex((x) => norm(x.name) === norm(h.name)) === i)
    .slice(0, 12)
    .map(({ rank: _rank, ...h }) => h);
  return NextResponse.json({ hits }, { headers: { "cache-control": "private, max-age=300" } });
}
