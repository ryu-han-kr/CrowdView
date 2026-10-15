// 테마파크 놀이기구 대기시간 (ThemeParks.wiki, 무료·상업 이용 가능, "Powered by ThemeParks.wiki" 표기 필수)
// 운영 중인 놀이기구의 평균 대기시간으로 혼잡도를 매기고, 대기가 긴 놀이기구를 구역(zones)으로 보여준다.
import { scoreFromValue } from "../levels";
import type { CrowdSnapshot, Place, Zone } from "../types";
import { modelSnapshot } from "./model";
import type { Signals } from "./signals";

const API = "https://api.themeparks.wiki/v1/entity";
// 몇 시간째 갱신이 없는 대기시간은 버린다 (운영 종료 후 마지막 값이 남아 있음)
const STALE_MS = 3 * 60 * 60 * 1000;

// 영문 이름 → 한국어 (자주 보이는 것만, 없으면 영문 그대로)
const KO: Record<string, string> = {
  "T Express": "T익스프레스",
  "Amazon Express": "아마존 익스프레스",
  "Thunder Falls": "썬더폴스",
  "Rolling X-Train": "롤링 엑스 트레인",
  "Shooting Ghost": "슈팅 고스트",
  "Flying Elephant": "플라잉 엘리펀트",
  "Sky Way(Bottom)": "스카이웨이",
  "Royal Jubilee Carousel": "로열 주빌리 캐로젤",
  "Space Tour (4D Attraction)": "스페이스 투어",
  "Peter Pan": "피터팬",
  "Safari World": "사파리 월드",
  "Lost Valley": "로스트밸리",
  "Hurricane": "허리케인",
  "Double Rock Spin": "더블 락스핀",
  "Columbus Adventure": "콜럼버스 대탐험",
};

interface LiveItem {
  name: string;
  entityType: string;
  status?: string;
  lastUpdated?: string;
  queue?: { STANDBY?: { waitTime?: number | null } };
}

/** 대기시간(분)을 장소 기준(예: 10·20·35·50분)으로 점수화 */
const waitScore = (min: number, place: Place) =>
  place.criteria?.unit === "분" ? scoreFromValue(min, place.criteria.steps) : Math.round(Math.min(95, 10 + min * 1.2));

export async function fetchThemePark(place: Place, s?: Signals): Promise<CrowdSnapshot> {
  // 대기시간은 5분 단위로 바뀌어 2분만 캐시한다
  const res = await fetch(`${API}/${place.themeparksId}/live`, { signal: AbortSignal.timeout(6000), next: { revalidate: 120 } });
  if (!res.ok) throw new Error(`themeparks ${res.status}`);
  const live = ((await res.json()).liveData ?? []) as LiveItem[];
  const now = Date.now();
  const rides = live
    .filter((i) => i.entityType === "ATTRACTION" && i.status === "OPERATING")
    .map((i) => ({ name: i.name, wait: i.queue?.STANDBY?.waitTime, at: Date.parse(i.lastUpdated ?? "") }))
    .filter((r): r is { name: string; wait: number; at: number } => typeof r.wait === "number" && now - r.at < STALE_MS);

  const base = modelSnapshot(place, new Date(), s);
  // 운영 중인 놀이기구가 없으면 폐장 시간
  if (rides.length === 0) return { ...base, open: false };

  const avg = rides.reduce((sum, r) => sum + r.wait, 0) / rides.length;
  const score = waitScore(avg, place);
  const zones: Zone[] = rides
    .sort((a, b) => b.wait - a.wait)
    .slice(0, 8)
    .map((r) => ({ id: r.name, label: KO[r.name] ?? r.name, score: waitScore(r.wait, place), waitMin: r.wait }));

  const hourly = base.hourly.map((p) => ({ ...p }));
  const current = hourly.filter((p) => !p.forecast).at(-1);
  if (current) current.score = score;
  return {
    ...base,
    score,
    open: true,
    hourly,
    zones,
    avgWaitMin: Math.round(avg),
    headcount: Math.round((place.capacity * score) / 100),
    source: "themeparks-wiki",
    updatedAt: new Date().toISOString(),
  };
}
