// 브라우저용 정적 JSON (/data/toilets.json 등). 빌드 때 한 번 만들어 CDN에서 내보낸다 → 이용자가 늘어도 서버 함수 실행 0.
// 원본은 src/data/seoul (scripts/seoul-data/sync.mjs), src/data/korea (scripts/korea-data/*.mjs), 주 1회
import { LANGS, type Lang } from "@/i18n/config";
import spots from "@/data/korea/spots.json";
import wifi from "@/data/seoul/wifi.json";
import { CULTURE, GUIDE, RESERVATIONS, TOILETS, guideText } from "@/lib/seoul-guide";

export const dynamic = "force-static";
export const dynamicParams = false;

const FILES: Record<string, () => unknown> = {
  "toilets.json": () => TOILETS,
  "wifi.json": () => wifi,
  // 지역별 명소 디렉터리: [contentid, 종류, 지역, 이름, 위도, 경도, 작은 사진, 시군구]
  "spots.json": () => spots,
  // 문화공간: [이름, 위도, 경도, 종류, 주소]
  "culture.json": () => CULTURE.map((c) => [c.n, c.lat, c.lng, c.k, c.a]),
  // 체험 예약: [이름, 위도, 경도, 분류, 장소, 링크, 접수 마감]
  "reservations.json": () => RESERVATIONS.filter((r) => r.lat && r.lng).map((r) => [r.n, r.lat, r.lng, r.cat, r.place, r.url, r.rcptEnd]),
  // 언어별 가이드 목록: [id, 종류, 이름, 위도, 경도, 구, 사진]
  ...Object.fromEntries(
    LANGS.map((l) => [`guide-${l}.json`, () => GUIDE.map((p) => [p.id, p.kind, guideText(p, l as Lang).text.n, p.lat ?? null, p.lng ?? null, p.gu ?? null, p.img ?? null])]),
  ),
};

export function generateStaticParams() {
  return Object.keys(FILES).map((file) => ({ file }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const make = FILES[(await params).file];
  if (!make) return new Response("not found", { status: 404 });
  return Response.json(make(), { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
