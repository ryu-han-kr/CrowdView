// 카카오 로컬 키워드 검색 (코스 추천: 카페·백화점·애니 매장·플래그십, 가고 싶은 곳 검색).
// REST API 키 = 카카오 로그인 앱의 client id (KAKAO_REST_API_KEY가 따로 있으면 그것). 앱 설정에서 '카카오맵' 사용을 켜야 된다.
// 꺼져 있으면(403) 6시간 동안 부르지 않고 빈 결과 → 화면은 우리 자료만으로 동작한다
import { cached } from "./cached";
import { kv } from "./cache";

export interface KakaoPlace {
  id: string;
  name: string;
  /** 예: 음식점 > 카페 */
  category: string;
  address: string;
  lat: number;
  lng: number;
  url: string;
}

const key = () => process.env.KAKAO_REST_API_KEY || process.env.KAKAO_CLIENT_ID;
const OFF_KEY = "kakao:local:off";

/** 카카오 로컬을 지금 쓸 수 있는지 (키가 있고 최근에 403을 받지 않았으면) */
export async function kakaoLocalOn(): Promise<boolean> {
  if (!key()) return false;
  return !(await kv.get(OFF_KEY).catch(() => null));
}

/** 키워드 검색. near가 있으면 그 둘레(radius m) 안을 가까운 순으로 */
export function kakaoSearch(query: string, near?: { lat: number; lng: number; radius?: number }, size = 10): Promise<KakaoPlace[]> {
  const k = key();
  if (!k || process.env.NEXT_PHASE === "phase-production-build") return Promise.resolve([]);
  const pos = near ? `${near.lat.toFixed(3)},${near.lng.toFixed(3)},${near.radius ?? 3000}` : "-";
  return cached(
    `kl:${query}:${pos}:${size}`,
    24 * 3600,
    async () => {
      if (await kv.get(OFF_KEY).catch(() => null)) return [];
      const qs = new URLSearchParams({ query, size: String(size) });
      if (near) {
        qs.set("x", String(near.lng));
        qs.set("y", String(near.lat));
        qs.set("radius", String(Math.min(20000, near.radius ?? 3000)));
        qs.set("sort", "distance");
      }
      const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?${qs}`, {
        headers: { Authorization: `KakaoAK ${k}` },
        signal: AbortSignal.timeout(6000),
      });
      if (res.status === 401 || res.status === 403) {
        await kv.set(OFF_KEY, "1", 6 * 3600).catch(() => {});
        return [];
      }
      if (!res.ok) throw new Error(`kakao ${res.status}`);
      const j = (await res.json()) as {
        documents?: { id: string; place_name: string; category_name: string; road_address_name?: string; address_name?: string; x: string; y: string; place_url: string }[];
      };
      return (j.documents ?? []).map((d) => ({
        id: d.id,
        name: d.place_name,
        category: d.category_name,
        address: d.road_address_name || d.address_name || "",
        lat: Number(d.y),
        lng: Number(d.x),
        url: d.place_url,
      }));
    },
    // 빈 결과(꺼져 있을 때 등)는 30분만 기억 → 카카오맵을 켜면 곧 나온다
    (v) => v.length === 0,
  ).catch(() => []);
}
