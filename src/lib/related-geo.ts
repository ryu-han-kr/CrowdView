// '함께 가면 좋은 곳'(관광공사 연관 관광지)에는 이름·지역만 있어서, 우리 데이터(여행 가이드·관광공사 서울·전국 명소·대표 명소)에서
// 같은 이름을 찾아 좌표를 붙인다 → 이곳에서 거리, 근처 실시간 혼잡도, 우리 상세 페이지 링크
import spots from "@/data/korea/spots.json";
import { distanceKm, type LatLng } from "./geo";
import { LANDMARKS } from "./korea";
import { GUIDE } from "./seoul-guide";

interface Found extends LatLng {
  href?: string;
}

const norm = (s: string) => s.replace(/\(.*?\)|\[.*?\]|\s|·/g, "").toLowerCase();

// [contentid, 종류, 지역, 이름, 위도, 경도, 사진, 시군구]
type SpotRow = [string, string, string, string, number, number, string, string];
let index: Map<string, Found[]> | null = null;
function build(): Map<string, Found[]> {
  const m = new Map<string, Found[]>();
  const add = (name: string, f: Found) => {
    const k = norm(name);
    if (k.length >= 2) m.set(k, [...(m.get(k) ?? []), f]);
  };
  for (const g of GUIDE) if (g.lat && g.lng && g.t.ko?.n) add(g.t.ko.n, { lat: g.lat, lng: g.lng, href: `/guide/${g.id}` });
  for (const l of LANDMARKS) add(l.n.ko, { lat: l.lat, lng: l.lng, href: `/spot/${l.id}` });
  for (const s of spots as SpotRow[]) add(s[3], { lat: s[4], lng: s[5] });
  return m;
}

/** 이름이 같은(괄호·띄어쓰기 무시) 곳 중 기준점에서 30km 안 가장 가까운 곳 */
export function locateByName(name: string, near: LatLng): (Found & { km: number }) | undefined {
  index ??= build();
  const hits = (index.get(norm(name)) ?? []).map((f) => ({ ...f, km: distanceKm(near, f) })).filter((f) => f.km <= 30);
  return hits.sort((a, b) => a.km - b.km)[0];
}
