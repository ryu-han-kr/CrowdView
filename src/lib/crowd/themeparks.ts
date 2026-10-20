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
  Hurricane: "허리케인",
  "Double Rock Spin": "더블 락스핀",
  "Columbus Adventure": "콜럼버스 대탐험",
};

// 구역: ThemeParks.wiki에는 구역 정보가 없어서, 놀이기구 외부 ID 앞자리로 묶는다 (에버랜드: H100V02xxx = 아메리칸 어드벤처 등)
// 레퍼런스: Queue-Times가 놀이기구를 구역(land)별로 묶어 보여 준다
const AREAS: Record<string, Record<string, string>> = {
  "b4dd937f-a79d-4b82-922f-e8ab0fbf5b5b": {
    H100V01: "글로벌 페어",
    H100V02: "아메리칸 어드벤처",
    H100V03: "매직랜드",
    H100V05: "유러피언 어드벤처",
    H100V06: "주토피아",
  },
};
const areaOf = (place: Place, externalId?: string) => (externalId && AREAS[place.themeparksId ?? ""]?.[externalId.slice(0, 7)]) || undefined;

interface LiveItem {
  name: string;
  externalId?: string;
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
  const operating = live.filter((i) => i.entityType === "ATTRACTION" && i.status === "OPERATING");
  const rides = operating
    .map((i) => ({ name: i.name, wait: i.queue?.STANDBY?.waitTime, at: Date.parse(i.lastUpdated ?? ""), area: areaOf(place, i.externalId) }))
    .filter((r): r is { name: string; wait: number; at: number; area: string | undefined } => typeof r.wait === "number" && now - r.at < STALE_MS);

  const base = modelSnapshot(place, new Date(), s);
  // 운영 중인 놀이기구가 없으면 폐장 시간. 운영 중인데 대기시간을 안 주는 공원(일부 국내 공원)은 예측 모델 그대로
  if (operating.length === 0) return { ...base, open: false };
  if (rides.length === 0) return base;

  const avg = rides.reduce((sum, r) => sum + r.wait, 0) / rides.length;
  const score = waitScore(avg, place);
  // 대기 긴 순서 전체 (화면은 위 8개 + 구역별 보기). 구역을 아는 공원만 전체를 남긴다
  const sorted = rides.sort((a, b) => b.wait - a.wait);
  const zones: Zone[] = (sorted.some((r) => r.area) ? sorted : sorted.slice(0, 8)).map((r) => ({
    id: r.name,
    label: KO[r.name] ?? r.name,
    score: waitScore(r.wait, place),
    waitMin: r.wait,
    ...(r.area && { area: r.area }),
  }));

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
