// 축제 일정과 혼잡 예측.
// 일정: 한국관광공사 TourAPI 행사(전국) + 서울시 문화행사 정보의 '축제' 분류. 6시간마다 새로 받는다.
// 혼잡: 실시간 공개 데이터가 없어서, 한국관광공사 데이터랩 시군구 일별 방문자로
//       '작년 같은 기간(같은 요일) 외지인·외국인 방문객 ÷ 그 전 4주 같은 요일 평균'을 계산한다 (추정).
import { APIS, beforeCall } from "./api-quota";
import { cached } from "./cached";
import { dataGoKr } from "./datagokr";
import { scoreFromValue, type LevelSteps } from "./levels";
import { PLACES, placeHref } from "./places";
import { getSeoulLive, nearestSeoulArea, type SeoulLive } from "./seoul-live";
import { addDays, kst } from "./time";

export interface Festival {
  /** kto-<contentid> | seoul-<해시> */
  id: string;
  title: string;
  start: string;
  end: string;
  place: string;
  /** 예: 서울 송파구 */
  region: string;
  lat?: number;
  lng?: number;
  image?: string;
  /** 행정구역 시군구 코드 (예: 11710 송파구). 2026 신설 행정구역은 데이터랩과 코드가 다를 수 있다 */
  signguCode?: string;
  /** 시군구 이름 (예: 송파구) */
  signguName?: string;
  source: "tourapi" | "seoul";
  category: FestivalCategory;
  tel?: string;
  fee?: string;
  link?: string;
}

export interface FestivalCrowd {
  /** 작년 축제 기간 방문객 ÷ 평소 */
  ratio: number;
  score: number;
  festivalAvg: number;
  baselineAvg: number;
  /** 비교한 작년 날짜 */
  days: string[];
  signguName: string;
}

export type FestivalCategory = "light" | "nature" | "food" | "tradition" | "music" | "expo" | "etc";

/** 축제 종류 (목록 필터 순서). 사진이 없을 때 이모지를 쓴다 */
export const FESTIVAL_CATEGORIES: { id: FestivalCategory; label: string; emoji: string }[] = [
  { id: "light", label: "불꽃·야경", emoji: "🎆" },
  { id: "nature", label: "꽃·자연", emoji: "🌸" },
  { id: "food", label: "먹거리", emoji: "🍜" },
  { id: "tradition", label: "전통·역사", emoji: "🏯" },
  { id: "music", label: "음악·공연", emoji: "🎵" },
  { id: "expo", label: "전시·박람회", emoji: "🖼️" },
  { id: "etc", label: "문화·체험", emoji: "🎪" },
];

// 제목 키워드가 먼저 (서울시 데이터는 분류 코드가 없다), 없으면 관광공사 분류 코드(lclsSystm3)
const CATEGORY_WORDS: [FestivalCategory, RegExp][] = [
  ["light", /불꽃|드론|빛|야행|라이트|미디어아트|야경|루미나리에|유등|등불|별빛|달빛|랜턴/],
  ["expo", /박람회|엑스포|전시|아트페어|비엔날레/],
  ["food", /맥주|커피|음식|푸드|김치|한우|젓갈|대추|유자|인삼|라면|김밥|국수|디저트|와인|특산|농산물|사과|전어|새우|대하|굴|김장|막걸리|빵|치맥|떡|한과|고구마|감자|버섯|꽃게|한돈|밥|미식|맛/],
  ["nature", /꽃|국화|억새|단풍|코스모스|핑크뮬리|갈대|생태|숲|자연|해바라기|장미|튤립|벚꽃|산수유|진달래|철쭉|정원|가든/],
  ["tradition", /국가유산|전통|역사|문화제|민속|궁중|궁|성곽|산성|향교|국악|선사|모양성|왕|유교|한옥|도자기|탈춤|농악|수문장|파수|의식|행궁|석조전/],
  ["music", /음악|뮤직|콘서트|재즈|버스킹|공연|마당극|연극|무용|댄스|오페라|영화|K-?POP|케이팝|힙합|락|록페/i],
];
const CATEGORY_CODES: [string, FestivalCategory][] = [
  ["EV010300", "food"],
  ["EV010400", "tradition"],
  ["EV020100", "tradition"],
  ["EV010500", "nature"],
  ["EV0301", "expo"],
  ["EV0302", "expo"],
  ["EV02", "music"],
];

export function festivalCategory(title: string, code?: string): FestivalCategory {
  for (const [id, re] of CATEGORY_WORDS) if (re.test(title)) return id;
  for (const [prefix, id] of CATEGORY_CODES) if (code?.startsWith(prefix)) return id;
  return "etc";
}

const HOUR = 3600;
const DAY = 24 * HOUR;
// 평소 대비 몇 배면 어느 단계인지: +5%까지 쾌적, +20% 원활, +50% 보통, 2배 혼잡, 그 이상 매우 혼잡
export const FESTIVAL_STEPS: LevelSteps = [1.05, 1.2, 1.5, 2.0];

// 서울 25개 구 → 행정구역 코드 (데이터랩 signguCode와 같다)
const SEOUL_GU: Record<string, string> = {
  종로구: "11110", 중구: "11140", 용산구: "11170", 성동구: "11200", 광진구: "11215", 동대문구: "11230",
  중랑구: "11260", 성북구: "11290", 강북구: "11305", 도봉구: "11320", 노원구: "11350", 은평구: "11380",
  서대문구: "11410", 마포구: "11440", 양천구: "11470", 강서구: "11500", 구로구: "11530", 금천구: "11545",
  영등포구: "11560", 동작구: "11590", 관악구: "11620", 서초구: "11650", 강남구: "11680", 송파구: "11710",
  강동구: "11740",
};

const SIDO_SHORT: Record<string, string> = {
  서울특별시: "서울", 부산광역시: "부산", 대구광역시: "대구", 인천광역시: "인천", 광주광역시: "광주", 대전광역시: "대전",
  울산광역시: "울산", 세종특별자치시: "세종", 경기도: "경기", 강원특별자치도: "강원", 충청북도: "충북", 충청남도: "충남",
  전북특별자치도: "전북", 전라남도: "전남", 경상북도: "경북", 경상남도: "경남", 제주특별자치도: "제주",
  전남광주통합특별시: "전남광주",
};

// 2026 신설 행정구역 → 데이터랩이 아직 쓰는 예전 코드
// - 전남광주통합특별시(12xxx): 시군구 이름이 그대로라 광주(29)·전남(46)에서 같은 이름을 찾는다
// - 인천 신설 구: 대부분을 차지하는 예전 구로 대신한다 (추정)
const LEGACY_SIDO: Record<string, string[]> = { "12": ["29", "46"] };
const LEGACY_SIGNGU: Record<string, string> = {
  "28125": "28140", // 제물포구 ← 동구 (중구 내륙 포함, 중구는 공항이 섞여 제외)
  "28155": "28110", // 영종구 ← 중구 (영종도가 중구 방문객 대부분)
  "28290": "28260", // 검단구 ← 서구
};

const ymdDash = (v: unknown) => {
  const s = String(v ?? "").replaceAll("-", "").slice(0, 8);
  return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : undefined;
};

const regionOf = (addr: string) => {
  const [sido, gu] = addr.split(/\s+/);
  return [SIDO_SHORT[sido] ?? sido, gu].filter(Boolean).join(" ");
};

// 제목 비교용: 연도·회차·괄호·공백 제거
const norm = (t: string) =>
  t.replace(/\[[^\]]*\]|\([^)]*\)|제?\d+회|\d{4}년?|\s|[^\p{L}\p{N}]/gu, "").toLowerCase();

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

async function tourApiFestivals(from: string): Promise<Festival[]> {
  const rows = await dataGoKr(
    "/B551011/KorService2/searchFestival2",
    { eventStartDate: from.replaceAll("-", ""), numOfRows: "1000", arrange: "A", MobileOS: "WEB", MobileApp: "CrowdView", _type: "json" },
    6 * HOUR,
  );
  return rows.flatMap((r): Festival[] => {
    const start = ymdDash(r.eventstartdate);
    const end = ymdDash(r.eventenddate) ?? start;
    if (!start || !end) return [];
    const addr = String(r.addr1 ?? "");
    const code = r.lDongRegnCd && r.lDongSignguCd ? `${r.lDongRegnCd}${r.lDongSignguCd}` : undefined;
    return [
      {
        id: `kto-${r.contentid}`,
        title: String(r.title),
        start,
        end,
        place: [addr, r.addr2].filter(Boolean).join(" "),
        region: regionOf(addr),
        signguName: addr.split(/\s+/)[1],
        lat: r.mapy ? Number(r.mapy) : undefined,
        lng: r.mapx ? Number(r.mapx) : undefined,
        image: r.firstimage ? String(r.firstimage).replace(/^http:/, "https:") : undefined,
        signguCode: code,
        source: "tourapi",
        category: festivalCategory(String(r.title), r.lclsSystm3 ? String(r.lclsSystm3) : undefined),
        tel: r.tel ? String(r.tel) : undefined,
      },
    ];
  });
}

async function seoulFestivals(): Promise<Festival[]> {
  const key = process.env.SEOUL_OPENAPI_KEY;
  if (!key) return [];
  // 최근 등록 1000건 중 '축제' 분류만 (문화행사 전체는 약 2만 건). 6시간마다 한 번 (Redis 공유 캐시)
  const rows = await cached(
    "seoul:events:festivals",
    6 * HOUR,
    async () => {
      await beforeCall(APIS.find((a) => a.id === "seoul-events"));
      const res = await fetch(`http://openapi.seoul.go.kr:8088/${key}/json/culturalEventInfo/1/1000/`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`seoul culturalEventInfo ${res.status}`);
      const all = ((await res.json()).culturalEventInfo?.row ?? []) as Record<string, string>[];
      return all.filter((r) => String(r.CODENAME).startsWith("축제"));
    },
    (v) => v.length === 0,
  );
  return rows.flatMap((r): Festival[] => {
      const start = ymdDash(r.STRTDATE);
      const end = ymdDash(r.END_DATE) ?? start;
      if (!start || !end) return [];
      return [
        {
          id: `seoul-${hash(r.TITLE + start)}`,
          title: r.TITLE.trim(),
          start,
          end,
          place: r.PLACE,
          region: `서울 ${r.GUNAME}`,
          lat: Number(r.LAT) || undefined,
          lng: Number(r.LOT) || undefined,
          image: r.MAIN_IMG || undefined,
          signguCode: SEOUL_GU[r.GUNAME],
          signguName: r.GUNAME,
          source: "seoul",
          category: festivalCategory(r.TITLE),
          fee: r.USE_FEE || undefined,
          link: r.HMPG_ADDR || r.ORG_LINK || undefined,
        },
      ];
    });
}

/** 진행 중이거나 앞으로 days일 안에 시작하는 축제 (시작일 순) */
export async function getFestivals(days = 60): Promise<Festival[]> {
  const today = kst().date;
  const until = addDays(today, days);
  const [kto, seoul] = await Promise.allSettled([tourApiFestivals(addDays(today, -60)), seoulFestivals()]);
  const all = [
    ...(kto.status === "fulfilled" ? kto.value : []),
    // 관광공사에 이미 있는 서울 축제는 빼고 더한다
    ...(seoul.status === "fulfilled" ? seoul.value : []),
  ];
  const seen = new Set<string>();
  return all
    .filter((f) => f.end >= today && f.start <= until)
    .filter((f) => {
      const k = norm(f.title) || f.title;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}

export async function getFestival(id: string): Promise<Festival | undefined> {
  return (await getFestivals(120)).find((f) => f.id === id);
}

/** 그날 시군구별 외지인+외국인 방문객 (데이터랩, 과거 날짜라 바뀌지 않아 30일 캐시) */
async function visitorsOn(date: string): Promise<DayVisitors> {
  const ymd = date.replaceAll("-", "");
  const rows = await dataGoKr(
    "/B551011/DataLabService/locgoRegnVisitrDDList",
    { startYmd: ymd, endYmd: ymd, numOfRows: "1000", MobileOS: "WEB", MobileApp: "CrowdView", _type: "json" },
    30 * DAY,
  );
  const map: DayVisitors = new Map();
  for (const r of rows) {
    if (r.touDivCd === "1") continue; // 현지인 제외: 축제 인파는 외지인·외국인
    const code = String(r.signguCode);
    const cur = map.get(code) ?? { name: String(r.signguNm), visitors: 0 };
    cur.visitors += Number(r.touNum ?? 0);
    map.set(code, cur);
  }
  return map;
}

type DayVisitors = Map<string, { name: string; visitors: number }>;

/** 축제 시군구의 그날 방문객. 데이터랩에 코드가 없으면 예전 행정구역 코드로 찾는다 */
function visitorsOf(day: DayVisitors, f: Festival) {
  const code = f.signguCode!;
  const direct = day.get(code);
  if (direct) return direct;
  if (LEGACY_SIGNGU[code]) return day.get(LEGACY_SIGNGU[code]);
  const prefixes = LEGACY_SIDO[code.slice(0, 2)];
  if (!prefixes || !f.signguName) return undefined;
  for (const [c, v] of day) if (prefixes.includes(c.slice(0, 2)) && v.name === f.signguName) return v;
  return undefined;
}

/** 한 달 넘게 이어지는 상설·장기 행사 (축제처럼 특정일에 몰리지 않아 혼잡 예측을 하지 않는다) */
export const isLongRunning = (f: Festival) => Date.parse(f.end) - Date.parse(f.start) > 31 * 86_400_000;

/** 작년 같은 기간(같은 요일, 최대 4일) 방문객이 평소(그 전 4주 같은 요일)보다 몇 배였는지 */
export async function getFestivalCrowd(f: Festival): Promise<FestivalCrowd | undefined> {
  if (!f.signguCode || isLongRunning(f)) return undefined;
  // 이미 시작한 축제는 오늘부터 남은 기간을 비교한다
  const from = f.start < kst().date ? kst().date : f.start;
  const span = Math.min(4, Math.round((Date.parse(f.end) - Date.parse(from)) / 86_400_000) + 1);
  const days = Array.from({ length: span }, (_, i) => addDays(addDays(from, i), -364));
  const base = days.flatMap((d) => [7, 14, 21, 28].map((w) => addDays(d, -w)));
  try {
    const value = async (d: string) => visitorsOf(await visitorsOn(d), f);
    const [fest, before] = await Promise.all([Promise.all(days.map(value)), Promise.all(base.map(value))]);
    const fv = fest.filter((v) => v !== undefined).map((v) => v!.visitors);
    const bv = before.filter((v) => v !== undefined).map((v) => v!.visitors);
    if (!fv.length || !bv.length) return undefined;
    const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    const ratio = avg(fv) / avg(bv);
    return {
      ratio,
      score: scoreFromValue(ratio, FESTIVAL_STEPS),
      festivalAvg: Math.round(avg(fv)),
      baselineAvg: Math.round(avg(bv)),
      days,
      signguName: (fest.find(Boolean) ?? before.find(Boolean))!.name,
    };
  } catch (e) {
    console.warn(`[festival] ${f.id} crowd:`, e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** 우리 장소(실시간·예측이 있는 곳)와 같은 축제면 그 장소 상세로, 아니면 축제 상세로 */
export function festivalHref(f: Festival): string {
  const id = f.id.startsWith("kto-") ? Number(f.id.slice(4)) : undefined;
  const place = id ? PLACES.find((p) => p.ktoContent?.id === id) : undefined;
  return place ? placeHref(place) : `/festival/${f.id}`;
}

/** 서울 축제이고 장소가 서울시 실시간 지역(800m 안)에 들어가는지 */
export function seoulAreaOf(f: Festival) {
  return f.region.startsWith("서울") && f.lat && f.lng ? nearestSeoulArea(f.lat, f.lng) : undefined;
}

/** 진행 중인 서울 축제의 실시간 인구 (서울시 실시간 도시데이터) */
export async function getFestivalLive(f: Festival): Promise<SeoulLive | undefined> {
  const today = kst().date;
  if (f.start > today || f.end < today || !seoulAreaOf(f)) return undefined;
  return getSeoulLive(f.lat!, f.lng!);
}
