// 서울 여행 가이드 데이터 (scripts/seoul-data/sync.mjs 가 만든 src/data/seoul/*.json, 주 1회 갱신).
// 정적 데이터라 API 호출·Redis를 쓰지 않는다. 혼잡도는 가까운 서울시 실시간 지역(lib/seoul-live)에서 붙인다
import type { Lang } from "@/i18n/config";
import culture from "@/data/seoul/culture.json";
import guide from "@/data/seoul/guide.json";
import tour from "@/data/seoul/tour.json";
import meta from "@/data/seoul/meta.json";
import reservations from "@/data/seoul/reservations.json";
import toilets from "@/data/seoul/toilets.json";
import { distanceKm, type LatLng } from "./geo";
import { SEOUL_AREAS, type SeoulArea } from "./seoul-areas";

export type GuideKind = "attraction" | "food" | "shopping" | "nature";
export const GUIDE_KINDS: { id: GuideKind; label: string; emoji: string }[] = [
  { id: "attraction", label: "명소", emoji: "🏛️" },
  { id: "food", label: "맛집", emoji: "🍽️" },
  { id: "shopping", label: "쇼핑", emoji: "🛍️" },
  { id: "nature", label: "자연", emoji: "🌳" },
];

export interface GuideText {
  n: string;
  a: string;
  h?: string;
  off?: string;
  tel?: string;
  sub?: string;
  menu?: string;
  tags?: string;
  url: string;
  web?: string;
}

export interface GuidePlace {
  id: string;
  kind: GuideKind;
  gu?: string;
  lat?: number;
  lng?: number;
  station?: string;
  /** 주소로 찾은 정확한 좌표면 true (아니면 가까운 역 좌표) */
  exact?: boolean;
  t: Partial<Record<Lang, GuideText>>;
  /** 관광공사 사진 (작은·큰) — 이름·위치가 맞는 관광공사 장소가 있을 때 */
  img?: string;
  imgL?: string;
  /** 관광공사 contentid */
  tourId?: string;
}

// Visit Seoul '명소'에는 짐 보관소·관광안내소·지하철역·학교·세탁소 같은 곳이 섞여 있다 (QA: '수서역이 명소?').
// 여행지가 아닌 곳은 빼고, 식당·가게는 맛집·쇼핑으로 옮긴다. 한국어 이름(없으면 영어) 기준
const NOT_PLACE =
  /물품보관|보관소|러기지|luggage|locker|락커|미니창고|짐프리|관광정보센터|관광안내|안내소|안내센터|tourist information|antenna ?shop|안테나숍|^[^ ]+역$|고등학교|중학교|초등학교|세탁|한의원$|이용원|미용실|barber|우체국|당구장|안경|자하문터널|^$/i;
const FOOD =
  /분식|칼국수|국밥|면옥|냉면|식당|다방|제과|베이커리|bakery|치킨|떡집|반찬|감자국|삼계탕|아구찜|떡볶이|수제비|닭한마리|묵집|김밥|과자점|라칸티나|청진옥|진아춘|휘가로|터방내|학림|독수리다방|sonkalguksu|감자탕|순대|만두|족발|cafe|카페/i;
const SHOP =
  /양복점|수제화|구두|슈즈|필방|표구사|화방|슈퍼|(?<!길)상사|유통|꽃집|공방|대장간|옹기|매듭|한복|자수|이화명주|명장|서점|문고|books?\b|레코드|record/i;

function cleanKind(p: GuidePlace): GuideKind | null {
  const name = (p.t.ko?.n || p.t.en?.n || "").trim();
  if (NOT_PLACE.test(name)) return null;
  // 박물관·미술관·궁·절·성당은 이름에 '자수'·'상사' 같은 말이 있어도 명소
  if (/박물관|미술관|기념관|궁|성당|교회|사찰/.test(name)) return p.kind;
  if (p.kind === "attraction" || p.kind === "nature") {
    if (FOOD.test(name)) return "food";
    if (SHOP.test(name)) return "shopping";
  }
  return p.kind;
}

// 관광공사 서울 자료 (scripts/seoul-data/tour.mjs): [contentid, 종류(12 관광지·14 문화시설·28 레포츠·38 쇼핑·39 음식점), 이름, 위도, 경도, 작은 사진, 큰 사진, 주소]
type TourRow = [string, number, string, number, number, string, string, string];
const TOUR = tour as TourRow[];
const norm = (s: string) => s.replace(/\(.*?\)|\[.*?\]|\s|·|서울/g, "").toLowerCase();

/**
 * Visit Seoul 장소에 사진이 없어서, 이름이 같거나(포함) 200m 안에서 이름이 겹치는 관광공사 장소의 사진을 붙인다.
 * 이름이 완전히 같으면 1km 안까지 (Visit Seoul 좌표가 가까운 역 좌표인 곳이 있어서)
 */
function matchTour(p: GuidePlace): TourRow | undefined {
  const name = norm(p.t.ko?.n ?? "");
  if (name.length < 2 || p.lat === undefined || p.lng === undefined) return undefined;
  let best: { row: TourRow; km: number } | undefined;
  for (const r of TOUR) {
    const rn = norm(r[2]);
    const km = distanceKm({ lat: p.lat, lng: p.lng! }, { lat: r[3], lng: r[4] });
    const same = rn === name && km < 1;
    const overlap = km < 0.2 && Math.min(rn.length, name.length) >= 3 && (rn.includes(name) || name.includes(rn));
    if ((same || overlap) && (!best || km < best.km)) best = { row: r, km };
  }
  return best?.row;
}

const cleaned = (guide as GuidePlace[]).flatMap((p) => {
  const kind = cleanKind(p);
  if (!kind) return [];
  const hit = matchTour(p);
  return [{ ...p, kind, ...(hit && { img: hit[5], imgL: hit[6], tourId: hit[0] }) }];
});

// 가이드에 없는 관광공사 서울 관광지·문화시설(사진 있는 곳)은 명소로 더한다 (QA: '명소라고 할 곳이 더 있을 텐데')
const used = new Set(cleaned.map((p) => p.tourId).filter(Boolean));
const NATURE = /공원|숲|산$|산 |한강|호수|천$|섬$|수목원|생태|정원|둘레길|습지/;
// 가이드에 이미 비슷한 이름이 300m 안에 있으면 같은 곳으로 보고 더하지 않는다 (예: 롯데월드타워 / 롯데월드타워 서울스카이)
const dupOfGuide = (r: TourRow) =>
  cleaned.some((p) => {
    if (p.lat === undefined || p.lng === undefined) return false;
    const a = norm(p.t.ko?.n ?? "");
    const b = norm(r[2]);
    return (
      Math.min(a.length, b.length) >= 2 && (a.includes(b) || b.includes(a)) && distanceKm({ lat: p.lat, lng: p.lng }, { lat: r[3], lng: r[4] }) < 0.3
    );
  });
const extra: GuidePlace[] = TOUR.filter((r) => (r[1] === 12 || r[1] === 14) && !used.has(r[0]) && !NOT_PLACE.test(r[2]) && !dupOfGuide(r)).map(
  (r) => ({
    id: `kt-${r[0]}`,
    kind: r[1] === 12 && NATURE.test(r[2]) ? "nature" : "attraction",
    gu: r[7].match(/서울(?:특별시)?\s+(\S+구)/)?.[1],
    lat: r[3],
    lng: r[4],
    exact: true,
    img: r[5],
    imgL: r[6],
    tourId: r[0],
    t: { ko: { n: r[2], a: r[7], url: "" } },
  }),
);

/** 사진 있는 곳을 앞으로 (기본 순서에서 사진 카드가 먼저 보이게) */
export const GUIDE: GuidePlace[] = [...cleaned, ...extra].sort((a, b) => Number(!!b.img) - Number(!!a.img));
export const GUIDE_SYNCED_AT = (meta as { syncedAt: string }).syncedAt;

/** 그 언어 글이 없으면 영어 → 한국어 → 아무거나 */
export function guideText(p: GuidePlace, lang: Lang): { text: GuideText; lang: Lang } {
  for (const l of [lang, "en", "ko", ...(Object.keys(p.t) as Lang[])] as Lang[]) {
    const text = p.t[l];
    if (text) return { text, lang: l };
  }
  throw new Error(`no text: ${p.id}`);
}

export const getGuidePlace = (id: string) => GUIDE.find((p) => p.id === id);

/** 화장실: [이름, 위도, 경도, flags, 개방시간, 휴무, 구] — flags 1 24시간 · 2 장애인 · 4 기저귀 교환대 · 8 비상벨/CCTV · 16 민간 개방 */
export type Toilet = [string, number, number, number, string, string, string];
export const TOILETS = toilets as Toilet[];
export const TOILET_FLAG = { open24: 1, accessible: 2, diaper: 4, safety: 8, privateOpen: 16 } as const;

export interface CultureSpace {
  n: string;
  k: string;
  a: string;
  gu: string;
  lat: number;
  lng: number;
  tel?: string;
  web?: string;
  h?: string;
  off?: string;
  fee?: string;
  img?: string;
}
export const CULTURE = culture as CultureSpace[];

export interface Reservation {
  id: string;
  n: string;
  cat: string;
  place: string;
  gu: string;
  fee: string;
  who: string;
  url: string;
  img?: string;
  lat?: number;
  lng?: number;
  from: string;
  to: string;
  rcptEnd: string;
  status: string;
}
export const RESERVATIONS = reservations as Reservation[];

/** 가까운 순 (최대 n개, 반경 km 안) */
export function nearest<T>(items: T[], at: LatLng, pos: (x: T) => LatLng | undefined, n = 5, radiusKm = 1.5): { item: T; km: number }[] {
  const out: { item: T; km: number }[] = [];
  for (const item of items) {
    const p = pos(item);
    if (!p) continue;
    const km = distanceKm(at, p);
    if (km <= radiusKm) out.push({ item, km });
  }
  return out.sort((a, b) => a.km - b.km).slice(0, n);
}

/** 가장 가까운 서울시 실시간 지역 (1km 안) — 이 동네 지금 혼잡도 */
export function areaNear(at: LatLng, maxKm = 1): (SeoulArea & { km: number }) | undefined {
  let best: (SeoulArea & { km: number }) | undefined;
  for (const a of SEOUL_AREAS) {
    const km = distanceKm(at, a);
    if (km <= maxKm && (!best || km < best.km)) best = { ...a, km };
  }
  return best;
}
