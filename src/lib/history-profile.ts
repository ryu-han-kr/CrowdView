// 과거 실측 이력 조회 (서버 전용, 약 1.1MB 표). 원천·기간·다시 만드는 법은 src/data/history/README.md
// - 서울 행정동 생활인구 (2023-01 ~ 2026-07, 시간대별): 지역(반경 500m)·장소(300m)·명소(400m) 안 사람 수 추정
// - 단기체류 외국인 (같은 기간): 월별 관광객 규모
// - 관광공사 데이터랩 시군구 일별 방문자 (2022-01 ~): 월×평일/휴일 지수, 연휴 효과, 해마다 추세
// - 서울 지하철 역별 승하차 (2023-01 ~): 월×평일/휴일 지수, 시간대 비중, 평소보다 크게 붐빈 날(행사)
// 칸 규칙: 월(0~11) × 일종류(0 평일, 1 주말·공휴일) [× 시 0~23]
import busanData from "@/data/history/busan-dong.json";
import seoulDongData from "@/data/history/seoul-dong.json";
import sigunguData from "@/data/history/sigungu.json";
import subwayData from "@/data/history/subway.json";
import targetsData from "@/data/history/targets.json";

type Weights = [code: string, weight: number][];
type Near = [station: string, meters: number][];
export type TargetKind = "area" | "place" | "landmark";

interface Sigungu {
  n?: string;
  /** 하루 평균 방문자 (외지인+외국인) */
  v: number;
  /** 월×일종류 방문자 지수 (24칸, 평균 1000) */
  i: number[];
  /** 현지인 포함 전체 지수 */
  t: number[];
  /** 평일 공휴일 ÷ 주말 */
  h?: number;
  /** 해마다 하루 평균 */
  y: Record<string, number>;
}
interface Station {
  v: number;
  i: number[];
  hr?: number[];
  top?: [date: string, ratio: number][];
}

const DONGS = (seoulDongData as unknown as { dongs: Record<string, { p: number[]; f?: number[] }> }).dongs;
const SGG = (sigunguData as unknown as { sgg: Record<string, Sigungu> }).sgg;
const STATIONS = (subwayData as unknown as { st: Record<string, Station> }).st;
const BUSAN = busanData as unknown as Record<string, number[][]>;
const TARGETS = targetsData as unknown as {
  area: Record<string, Weights>;
  place: Record<string, { g?: string; d?: Weights }>;
  landmark: Record<string, { g?: string; d?: Weights }>;
  spot: Record<string, string>;
  station: Record<TargetKind, Record<string, Near>>;
};

export const historyMeta = () => (seoulDongData as unknown as { meta: unknown }).meta;

/** 주말·공휴일이면 1 (holidays는 signals.holidays 같은 공휴일 표) */
export function dayType(date: string, holidays?: { has(d: string): boolean }): 0 | 1 {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6 || holidays?.has(date) ? 1 : 0;
}

const cell = (date: string, dt: 0 | 1) => (+date.slice(5, 7) - 1) * 2 + dt;

function weightsOf(kind: TargetKind, id: string): Weights | undefined {
  return kind === "area" ? TARGETS.area[id] : TARGETS[kind][id]?.d;
}

/** 순수 계산: 행정동 몫 × 동 프로필 합 → 576칸 (월×일종류×시) */
export function combineDongs(ws: Weights, dongs: Record<string, { p: number[] }> = DONGS): number[] | undefined {
  const out = Array<number>(576).fill(0);
  let any = false;
  for (const [code, w] of ws) {
    const p = dongs[code]?.p;
    if (!p) continue;
    any = true;
    for (let i = 0; i < 576; i++) out[i] += p[i] * w;
  }
  return any ? out : undefined;
}

const memo = new Map<string, number[] | undefined>();
function profile(kind: TargetKind, id: string): number[] | undefined {
  const k = `${kind}:${id}`;
  if (!memo.has(k)) {
    const ws = weightsOf(kind, id);
    memo.set(k, ws ? combineDongs(ws) : undefined);
  }
  return memo.get(k);
}

/**
 * 서울 지역·장소·명소 둘레의 시간대별 평소 사람 수 (그 달·그 일종류 평균, 0~23시).
 * 서울 밖이거나 표에 없으면 undefined. 지역은 반경 500m라 서울시 실시간 인구와 규모가 비슷하다
 */
export function seoulHourly(kind: TargetKind, id: string, date: string, dt: 0 | 1): number[] | undefined {
  const p = profile(kind, id);
  if (!p) return undefined;
  const b = cell(date, dt) * 24;
  return p.slice(b, b + 24).map((v) => Math.round(v));
}

/** 같은 대상의 시간대 곡선을 그 하루 최대 = 1로 (모양만 쓸 때) */
export function seoulShape(kind: TargetKind, id: string, date: string, dt: 0 | 1): number[] | undefined {
  const h = seoulHourly(kind, id, date, dt);
  const max = h && Math.max(...h);
  return h && max ? h.map((v) => Math.round((v / max) * 1000) / 1000) : undefined;
}

/** 단기체류 외국인(관광객) 낮 평균 인원, 1~12월 */
export function seoulForeignMonthly(kind: TargetKind, id: string): number[] | undefined {
  const ws = weightsOf(kind, id);
  if (!ws) return undefined;
  const out = Array<number>(12).fill(0);
  let any = false;
  for (const [code, w] of ws) {
    const f = DONGS[code]?.f;
    if (!f) continue;
    any = true;
    f.forEach((v, m) => (out[m] += v * w));
  }
  return any ? out.map(Math.round) : undefined;
}

/** 장소·명소·스팟(TourAPI contentid)의 시군구 코드 */
export function sigunguOf(kind: "place" | "landmark" | "spot", id: string): string | undefined {
  return kind === "spot" ? TARGETS.spot[id] : TARGETS[kind][id]?.g;
}

export const sigunguStats = (code: string): Sigungu | undefined => SGG[code];

/** 시군구 방문자 지수: 그 달·그 일종류 평균 ÷ 연평균 (1 = 평소). local=true면 현지인 포함 */
export function sigunguIndex(code: string, date: string, dt: 0 | 1, local = false): number | undefined {
  const s = SGG[code];
  return s ? (local ? s.t : s.i)[cell(date, dt)] / 1000 : undefined;
}

/** 대상 근처 지하철역 (가까운 순, 최대 3곳) */
export const stationsNear = (kind: TargetKind, id: string): Near => TARGETS.station[kind]?.[id] ?? [];

export const stationStats = (name: string): Station | undefined => STATIONS[name];

/** 역 승하차 지수: 그 달·그 일종류 평균 ÷ 전체 평균 */
export function stationIndex(name: string, date: string, dt: 0 | 1): number | undefined {
  const s = STATIONS[name];
  return s ? s.i[cell(date, dt)] / 1000 : undefined;
}

/** 부산 행정동 월 평균 시간대 방문인구 (busanDongs 이름, 2023-01 ~ 같은 달 평균) */
export function busanHourly(dong: string, month: number): number[] | undefined {
  return BUSAN[dong]?.[month - 1];
}
