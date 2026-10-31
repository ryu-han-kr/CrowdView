// 월 계절 지수 (실측 이력에서 뽑은 12칸, 연평균 = 1000). 원천·만드는 법은 src/data/history/README.md
// - 장소: 그 시군구 일별 방문자(관광공사 데이터랩 외지인+외국인, 2022-01 ~) → 월 평균
// - 서울 지역: 반경 500m 행정동 생활인구(서울시, 2023-01 ~) 낮 10~21시 → 월 평균
// 작은 파일(약 25KB)만 읽어 예측 모델에서 바로 쓴다. 큰 표(시간대·역·외국인)는 lib/history-profile
import seasonData from "@/data/history/season.json";

const SEASON = seasonData as { place: Record<string, number[]>; area: Record<string, number[]> };

const DAYS_IN = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** 순수 계산: 12칸 월 지수를 날짜에 맞게 이어 붙인 값 (각 달 15일 = 그 달 값, 사이는 직선). 연평균 = 1 */
export function monthIndexAt(months: number[], date: string): number {
  const y = +date.slice(0, 4);
  const m = +date.slice(5, 7) - 1;
  const d = +date.slice(8, 10);
  const pos = m + (d - 15) / DAYS_IN(y, m);
  const lo = Math.floor(pos);
  const frac = pos - lo;
  const at = (i: number) => months[((i % 12) + 12) % 12] / 1000;
  return at(lo) * (1 - frac) + at(lo + 1) * frac;
}

export function seasonMonths(kind: "place" | "area", id: string): number[] | undefined {
  return SEASON[kind][id];
}

/**
 * date가 ref(보통 오늘)보다 계절적으로 얼마나 붐비는지. 1 = 같음.
 * 오늘 기준 비율이라 오늘 예측은 그대로 두고(실측 보정·학습 모델과 겹치지 않게), 몇 주·몇 달 뒤 예측만 계절을 탄다.
 * 제곱근으로 반만 반영하고 0.85~1.2로 묶는다 (시군구·행정동 단위라 장소 하나보다 넓은 값)
 */
export function seasonFactor(kind: "place" | "area", id: string, date: string, ref: string): number {
  const months = SEASON[kind][id];
  if (!months || date === ref) return 1;
  const r = monthIndexAt(months, date) / monthIndexAt(months, ref);
  if (!(r > 0)) return 1;
  return Math.max(0.85, Math.min(1.2, Math.sqrt(r)));
}
