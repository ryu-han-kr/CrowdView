// 서로 다른 자료(대표 명소·축제·AI 화제 행사·뉴스) → 우리 장소(PLACES)·서울 실시간 지역을 잇는 규칙 한곳.
// 11/1 지인 QA: 광안리해수욕장 카드를 누르면 '짱오락실 부산광안리점'(오락실)이 열렸고(이름 '광안리'가 들어 있어서),
// 해동용궁사 혼잡도가 1.3km 떨어진 롯데월드 어드벤처 부산 값을 빌려 썼다 → 이름은 '같은 것'일 때만, 거리 빌려 쓰기는 '같은 종류'일 때만.
import type { Category } from "./types";

/** 이름 비교용: 띄어쓰기·괄호·기호와 '해수욕장·공원·역·타워·관광특구' 같은 일반 꼬리를 뗀다 */
export const nameKey = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")
    .replace(/[\s·()\-,]/g, "")
    .replace(/(서울)?(해수욕장|해변|공원|역|타워|관광특구|일대)$/g, "");

/** 두 이름이 같은 곳을 가리키는지: 2 = 같음, 1 = 한쪽이 다른 쪽을 품음(2글자 이상), 0 = 다름. 괄호 안 이름(DDP(동대문디자인플라자))도 본다 */
export function sameName(a: string, b: string): 0 | 1 | 2 {
  const parts = (n: string) => [n, ...(n.match(/\((.*?)\)/g) ?? []).map((p) => p.slice(1, -1))].map(nameKey).filter((k) => k.length >= 2);
  let best: 0 | 1 | 2 = 0;
  for (const x of parts(a)) for (const y of parts(b)) best = Math.max(best, x === y ? 2 : x.includes(y) || y.includes(x) ? 1 : 0) as 0 | 1 | 2;
  return best;
}

/** 바깥에 있는 '그 자리' 자체의 혼잡을 재는 우리 장소 분류 (명소·축제가 이름이 달라도 거리로 빌려 쓸 수 있는 곳) */
export const OUTDOOR_AREA: readonly Category[] = ["landmark", "street", "beach"];
/** 어떤 이름으로도 바깥 명소·해변·축제와 이어지면 안 되는 분류 (실내 매장, 공항, 하루짜리 행사 화면) */
export const NEVER_FOR_OUTDOOR: readonly Category[] = ["indoor", "airport", "event"];
