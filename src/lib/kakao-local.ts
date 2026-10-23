// 카카오 로컬 키워드 검색 (코스 추천: 카페·백화점·애니 매장·플래그십, 가고 싶은 곳 검색).
// REST API 키 = 카카오 로그인 앱의 client id (KAKAO_REST_API_KEY가 따로 있으면 그것). 앱 설정에서 '카카오맵' 사용을 켜야 된다.
// 꺼져 있으면(401·403) 30분 동안 부르지 않고 빈 결과 → 화면은 우리 자료만으로 동작한다. 꺼진 이유(상태·카카오 메시지)는 OFF_KEY 값에 남는다
// (10/23: 한 번 받은 403이 6시간 동안 남아, 카카오맵을 켠 뒤에도 코스·검색에 카카오 결과가 안 나왔다)
// 한도: lib/api-quota 의 kakao-local (무료 쿼터의 1/5). 카카오가 429(쿼터 초과)를 주면 그날은 더 부르지 않는다
import { APIS, beforeCall, markExhausted } from "./api-quota";
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
export const OFF_KEY = "kakao:local:off";

/** 카카오 로컬을 지금 쓸 수 있는지 (키가 있고 최근에 403을 받지 않았으면) */
export async function kakaoLocalOn(): Promise<boolean> {
  if (!key()) return false;
  return !(await kv.get(OFF_KEY).catch(() => null));
}

/** 키워드 검색. near가 있으면 그 둘레(radius m) 안을 가까운 순으로 (sort "accuracy"면 둘레 안에서 정확도순) */
export function kakaoSearch(
  query: string,
  near?: { lat: number; lng: number; radius?: number; sort?: "distance" | "accuracy" },
  size = 10,
): Promise<KakaoPlace[]> {
  const k = key();
  if (!k || process.env.NEXT_PHASE === "phase-production-build") return Promise.resolve([]);
  const sort = near?.sort ?? "distance";
  const pos = near ? `${near.lat.toFixed(3)},${near.lng.toFixed(3)},${near.radius ?? 3000}${sort === "accuracy" ? ":acc" : ""}` : "-";
  return cached(
    `kl:${query}:${pos}:${size}`,
    24 * 3600,
    async () => {
      if (await kv.get(OFF_KEY).catch(() => null)) return [];
      await beforeCall(APIS.find((a) => a.id === "kakao-local"));
      const qs = new URLSearchParams({ query, size: String(size) });
      if (near) {
        qs.set("x", String(near.lng));
        qs.set("y", String(near.lat));
        qs.set("radius", String(Math.min(20000, near.radius ?? 3000)));
        qs.set("sort", sort);
      }
      const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?${qs}`, {
        headers: { Authorization: `KakaoAK ${k}` },
        signal: AbortSignal.timeout(6000),
      });
      if (res.status === 401 || res.status === 403) {
        const why = (await res.text().catch(() => "")).slice(0, 160);
        await kv.set(OFF_KEY, `${res.status} ${new Date().toISOString()} ${why}`, 30 * 60).catch(() => {});
        return [];
      }
      if (res.status === 429) {
        await markExhausted(APIS.find((a) => a.id === "kakao-local"));
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
