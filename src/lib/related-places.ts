// 한국관광공사 관광지별 연관 관광지 (data.go.kr 15128560): 티맵 내비 이동 데이터로 본 "이곳에 간 사람이 함께 간 곳".
// 장소가 붐빌 때 대신 갈 곳·함께 들를 곳으로 보여준다. 월 단위 데이터라 7일 캐시
import { cached } from "./cached";
import { dataGoKr } from "./datagokr";
import { addDays, kst } from "./time";
import type { Place } from "./types";

export interface RelatedPlace {
  name: string;
  region: string;
  /** 예: 음식 > 한식, 관광지 > 역사관광 */
  category: string;
  rank: number;
}

export function getRelatedPlaces(place: Place, limit = 6): Promise<RelatedPlace[]> {
  const kto = place.kto;
  if (!kto) return Promise.resolve([]);
  // 결과가 없어도 7일 저장 (없는 장소를 볼 때마다 다시 부르지 않게)
  return cached(`related:${place.id}`, 7 * 24 * 3600, async () => {
    // 이름을 정확히 못 찾으면 첫 낱말로 (예: "롯데월드 어드벤처" → "롯데월드"), 데이터는 1~3달 늦게 올라온다
    const keywords = [...new Set([kto.name, kto.name.replace(/\(.*?\)/g, "").trim().split(/\s+/)[0]])];
    for (const back of [30, 60, 90]) {
      const baseYm = addDays(kst().date, -back).slice(0, 7).replace("-", "");
      for (const keyword of keywords) {
        const rows = await dataGoKr("/B551011/TarRlteTarService1/searchKeyword1", {
          _type: "json",
          MobileOS: "WEB",
          MobileApp: "CrowdView",
          numOfRows: "100",
          baseYm,
          areaCd: kto.areaCd,
          signguCd: kto.signguCd,
          keyword,
        }).catch(() => []);
        // 같은 낱말이 든 다른 관광지(예: 롯데월드아쿠아리움)보다 이름이 가장 비슷한 곳의 연관 목록을 쓴다
        const target = rows.map((r) => String(r.tAtsNm)).sort((a, b) => a.length - b.length)[0];
        const own = rows.filter((r) => String(r.tAtsNm) === target);
        if (!own.length) continue;
        const seen = new Set<string>();
        return own
          .map((r) => ({
            name: String(r.rlteTatsNm ?? "").replace(/\/.*$/, ""),
            region: [String(r.rlteRegnNm ?? "").replace(/특별자치(시|도)$|(특별|광역)?(시|도)$/, ""), r.rlteSignguNm]
              .filter(Boolean)
              .join(" "),
            category: [r.rlteCtgryLclsNm, r.rlteCtgrySclsNm].filter(Boolean).join(" > "),
            rank: Number(r.rlteRank ?? 99),
          }))
          .filter((r) => r.name && !target.startsWith(r.name) && !seen.has(r.name) && seen.add(r.name))
          .sort((a, b) => a.rank - b.rank)
          .slice(0, limit);
      }
    }
    return [];
  });
}
