// 서울 여행 가이드 데이터 (scripts/seoul-data/sync.mjs 가 만든 src/data/seoul/*.json, 주 1회 갱신).
// 정적 데이터라 API 호출·Redis를 쓰지 않는다. 혼잡도는 가까운 서울시 실시간 지역(lib/seoul-live)에서 붙인다
import type { Lang } from "@/i18n/config";
import { PLACES, placeHref } from "./places";
import { heroImage } from "./place-photos";
import type { Place } from "./types";
import culture from "@/data/seoul/culture.json";
import guide from "@/data/seoul/guide.json";
import tour from "@/data/seoul/tour.json";
import meta from "@/data/seoul/meta.json";
import reservations from "@/data/seoul/reservations.json";
import toilets from "@/data/seoul/toilets.json";
import { distanceKm, type LatLng } from "./geo";
import { LANDMARKS } from "./korea";
import { SEOUL_AREAS, type SeoulArea } from "./seoul-areas";
import areaPhotos from "@/data/seoul/area-photos.json";
import guidePhotos from "@/data/seoul/guide-photos.json";

export type GuideKind = "attraction" | "food" | "shopping" | "nature" | "fun";
export const GUIDE_KINDS: { id: GuideKind; label: string; emoji: string }[] = [
  { id: "attraction", label: "명소", emoji: "🏛️" },
  { id: "food", label: "맛집", emoji: "🍽️" },
  { id: "shopping", label: "쇼핑", emoji: "🛍️" },
  { id: "nature", label: "자연", emoji: "🌳" },
  // 10/27 QA #16: 놀이공원·아쿠아리움·키즈·실내 액티비티 (우리 실시간 장소 + 관광공사 자료)
  { id: "fun", label: "놀이·체험", emoji: "🎢" },
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
  /** 사진 출처 (없으면 한국관광공사) */
  credit?: string;
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

// 관광공사 자료에 사진이 없는 대표 명소(경복궁·창덕궁·롯데월드타워 등)는 명소 대표 사진을 쓴다 (UI QA: 기본순 맨 위가 아이콘이었다).
// 같은 이름(괄호·영문 표기 차이만)일 때만 — '경복궁 집옥재'처럼 그 안의 작은 곳에는 쓰지 않는다
const sq = (s: string) => s.replace(/[\s()·]/g, "");
const LANDMARK_IMG = new Map(LANDMARKS.filter((l) => l.region === "서울").map((l) => [sq(l.n.ko), l.img]));
function landmarkImg(p: GuidePlace): string | undefined {
  const n = sq(p.t.ko?.n ?? "");
  if (n.length < 2) return undefined;
  for (const [name, img] of LANDMARK_IMG)
    if (name === n || (n.length >= 3 && name.startsWith(n) && name.length - n.length <= 6) || (n.startsWith(name) && /^[A-Za-z]+$/.test(n.slice(name.length))))
      return img;
  return undefined;
}

const GUIDE_PHOTOS = guidePhotos as Record<string, { src: string; credit?: string; page?: string }>;

const cleaned = (guide as GuidePlace[]).flatMap((p) => {
  const kind = cleanKind(p);
  if (!kind) return [];
  const hit = matchTour(p);
  const lm = hit ? undefined : landmarkImg(p);
  // 직접 고른 사진 (관광공사 갤러리는 credit 없음, 위키미디어 커먼즈는 출처 표시)
  const own = GUIDE_PHOTOS[p.id];
  return [
    {
      ...p,
      kind,
      ...(hit && { img: hit[5], imgL: hit[6], tourId: hit[0] }),
      ...(lm && { img: lm, imgL: lm }),
      ...(own && { img: own.src, imgL: own.src, credit: own.credit }),
    },
  ];
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

/**
 * 같은 곳 한 번만 (QA 10/21: 경교장 등 90곳이 두 번 보임 — 원본 자료에 같은 id가 두 번, 또는 다른 id로 같은 이름·좌표).
 * 같은 id, 또는 같은 종류·같은 이름(띄어쓰기 무시)이면서 200m 안이면 같은 곳. 사진 있는 쪽을 남긴다
 */
export function dedupeGuide(list: GuidePlace[]): GuidePlace[] {
  const out: GuidePlace[] = [];
  const ids = new Set<string>();
  const nameOf = (p: GuidePlace) => norm(p.t.ko?.n ?? Object.values(p.t)[0]?.n ?? "");
  for (const p of [...list].sort((a, b) => Number(!!b.img) - Number(!!a.img))) {
    if (ids.has(p.id)) continue;
    const n = nameOf(p);
    const same = out.some(
      (q) =>
        q.kind === p.kind &&
        nameOf(q) === n &&
        p.lat !== undefined &&
        q.lat !== undefined &&
        distanceKm({ lat: p.lat, lng: p.lng! }, { lat: q.lat, lng: q.lng! }) < 0.2,
    );
    if (same) continue;
    ids.add(p.id);
    out.push(p);
  }
  return out;
}

/** 사진 있는 곳을 앞으로 (기본 순서에서 사진 카드가 먼저 보이게) */
// 명소 '기본순'은 이름난 곳부터 (UI QA: 달마사·금선사처럼 덜 알려진 곳이 맨 위였다). 목록 화면과 /data/guide-{lang}.json이 같은 순서를 쓴다.
// 서울 대표 명소와 같은 이름(명소 목록 순서) → 그 안의 작은 곳(경복궁 집옥재 등) → 서울 실시간 지역 이름으로 시작 → 사진 있음 → 나머지.
// 사진이 없는 곳은 이름이 알려져 있어도 사진 있는 곳 뒤로 (목록 위쪽이 아이콘으로 차지 않게)
const FAMOUS = LANDMARKS.filter((l) => l.region === "서울").map((l) => sq(l.n.ko));
const AREA_NAMES = SEOUL_AREAS.map((a) => sq(a.name.replace(/관광특구|역$/g, ""))).filter((n) => n.length >= 3);
function fame(p: GuidePlace): number {
  if (p.kind !== "attraction") return 0;
  const n = sq(p.t.ko?.n ?? "");
  // 같은 곳의 다른 표기: '동대문디자인플라자(DDP)' ↔ '동대문디자인플라자', '롯데월드타워' ↔ '롯데월드타워 서울스카이'
  const exact = FAMOUS.findIndex(
    (f) => f === n || (n.length >= 3 && f.startsWith(n) && f.length - n.length <= 6) || (n.startsWith(f) && /^[A-Za-z]+$/.test(n.slice(f.length))),
  );
  if (n.length >= 2 && exact >= 0) return exact / 100;
  if (n.length >= 3 && FAMOUS.some((f) => n.startsWith(f) || f.includes(n))) return p.img ? 1 : 3.5;
  if (n.length >= 3 && AREA_NAMES.some((a) => n.startsWith(a))) return p.img ? 2 : 3.5;
  return p.img ? 3 : 4;
}

// 놀이·체험: 서울의 우리 실시간 장소(테마파크·워터파크·실내 액티비티) → 가이드 항목으로. 사진·주소·좌표는 장소 자료, 누르면 장소 상세
const FUN_NAMES: Partial<Record<Lang, (p: Place) => string>> = {};
const fun: GuidePlace[] = PLACES.filter((p) => p.region.startsWith("서울") && ["themepark", "waterpark", "indoor"].includes(p.category)).map((p) => ({
  id: `place-${p.id}`,
  kind: "fun" as const,
  gu: p.address.match(/서울(?:특별시)?\s+(\S+구)/)?.[1],
  lat: p.lat,
  lng: p.lng,
  exact: true,
  t: { ko: { n: p.name, a: p.address, url: placeHref(p), sub: p.description } },
  img: heroImage(p),
  imgL: heroImage(p),
}));
void FUN_NAMES;
// 관광공사 서울 자료 중 놀이·체험 성격(아쿠아리움·전망대·키즈)은 명소 대신 놀이·체험으로
const FUN_RE = /아쿠아리움|키자니아|놀이공원|놀이동산|테마파크|VR|트램폴린|키즈카페/;
export const GUIDE: GuidePlace[] = dedupeGuide([...cleaned, ...extra])
  .map((p) => (p.kind === "attraction" && FUN_RE.test(p.t.ko?.n ?? "") ? { ...p, kind: "fun" as const } : p))
  .concat(fun)
  .sort((a, b) => fame(a) - fame(b));
/**
 * 사진이 없는 곳(서울 실시간 지역 등)에 가이드 명소·자연·쇼핑의 관광공사 사진을 빌려 쓴다.
 * 이름이 겹치는 곳(1.5km 안, 예: 경복궁 지역 → 경복궁)이 먼저, 없으면 가장 가까운 곳(기본 600m 안). large면 큰 사진
 */
// 후보: 바깥 풍경 사진이 많은 곳만 — 가이드 명소·자연 + 관광공사 관광지·레포츠 (쇼핑·문화시설은 실내 사진이 많아 대표 사진으로 어색)
const PHOTO_SPOTS: {
  name: string;
  lat: number;
  lng: number;
  img: string;
  imgL: string;
}[] = [
  ...GUIDE.filter((g) => g.img && g.lat && g.lng && (g.kind === "attraction" || g.kind === "nature")).map((g) => ({
    name: norm(g.t.ko?.n ?? ""),
    lat: g.lat!,
    lng: g.lng!,
    img: g.img!,
    imgL: g.imgL ?? g.img!,
  })),
  ...TOUR.filter((r) => r[1] === 12 || r[1] === 28).map((r) => ({
    name: norm(r[2]),
    lat: r[3],
    lng: r[4],
    img: r[5],
    imgL: r[6],
  })),
  // 대표 명소(관광공사 대표 사진) — 경복궁처럼 서울 목록에서 빠진 곳
  ...LANDMARKS.map((l) => ({
    name: norm(l.n.ko),
    lat: l.lat,
    lng: l.lng,
    img: l.img,
    imgL: l.img,
  })),
];
// 서울 실시간 121곳 중 관광사진 갤러리에서 눈으로 고른 대표 사진 (UI QA 15차: 근처 가이드 사진이 매장 안·건물 근접처럼 일상적이었다)
// 관광공사 갤러리 사진은 license 없음(공공누리 제1유형), 위키미디어 커먼즈 사진은 license·page가 있다
const AREA_PHOTOS = areaPhotos as Record<string, { src: string; title: string; photographer: string; license?: string; page?: string }>;

/** 지역 사진 출처 문구 (고른 사진이 아니면 undefined → 화면은 '주변 사진 · 한국관광공사') */
export function areaPhotoCredit(code: string): string | undefined {
  const p = AREA_PHOTOS[code];
  if (!p) return undefined;
  return p.license ? `${p.photographer} · ${p.license}` : `한국관광공사 · ${p.photographer}`;
}

/** 역 이름인 지역 (seoul-live의 seoulGroup 'station'과 같은 규칙. 그 파일이 이 파일을 불러 순환이 생겨 여기 둔다) */
const isStation = (name: string) => !/관광특구|공원|한강/.test(name) && (/역(\(|$|·)|역\s|입구\(|사거리역|네거리역/.test(name) || name.endsWith("역"));

/**
 * 서울 지역 사진: 고른 사진이 있으면 그것, 없으면 근처 가이드 사진.
 * 역 주변은 근처 가이드 사진이 가게 간판·매장 안이라(교대역 다이빙 업체 로고 등) 사진 대신 아이콘을 보인다 (undefined)
 */
export function areaPhoto(a: LatLng & { name: string; code: string }, large = false): string | undefined {
  if (AREA_PHOTOS[a.code]) return AREA_PHOTOS[a.code].src;
  return isStation(a.name) ? undefined : photoNear(a, 0.8, large);
}

export function photoNear(p: LatLng & { name?: string }, maxKm = 0.6, large = false): string | undefined {
  const key = p.name ? norm(p.name.replace(/관광특구|역$|일대|거리$|공원$/g, "")) : "";
  type Hit = { s: (typeof PHOTO_SPOTS)[number]; km: number };
  let byName: Hit | undefined;
  let best: Hit | undefined;
  for (const s of PHOTO_SPOTS) {
    const km = distanceKm(p, s);
    // 이름이 겹치면 짧은(= 그 장소 자체에 가까운) 이름을 고른다 (경복궁 > 경복궁 돌담길)
    if (km < 1.5 && (s.name === key || (key.length >= 3 && s.name.includes(key))) && (!byName || s.name.length < byName.s.name.length))
      byName = { s, km };
    if (km < maxKm && (!best || km < best.km)) best = { s, km };
  }
  const hit = (byName ?? best)?.s;
  return hit && (large ? hit.imgL : hit.img);
}

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
export const TOILET_FLAG = {
  open24: 1,
  accessible: 2,
  diaper: 4,
  safety: 8,
  privateOpen: 16,
} as const;

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
