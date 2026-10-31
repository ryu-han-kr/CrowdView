// 적응형 수집 주기: 장소마다 '지금' 얼마나 자주 원천을 다시 부를지 (사용자 제안 10/21 — 시간대마다 이용자가 다르니 호출도 다르게).
// 수집기(Vercel Cron)는 5분마다 돌지만, 장소별 주기가 안 됐으면 건너뛴다 → 붐비는 시간엔 촘촘히, 문 닫은 시간엔 드물게.
// - 놀이공원·워터파크 실측(ThemeParks.wiki·Queue-Times, 원천 5분): 운영 중 5분
// - 서울시 지역 실측(원천 5분, 121곳 묶음 캐시 10분)·공항(원천 5~30분): 10분
// - 문 닫은 시간(개장 1시간 전~폐장 1시간 뒤 밖)·시즌 아님·오늘 휴무·실측 원천 없는 추정 장소: 30분
// 외부 호출·Redis 쓰기가 전체로는 줄고(10분 고정 192회/시 → 약 150회/시), 놀이공원은 두 배 자주 받는다
import type { Place } from "../types";
import { kst } from "../time";
import { inSeason } from "./model";

export const PEAK_MIN = 5;
export const NORMAL_MIN = 10;
export const IDLE_MIN = 30;
/** 개장 전·폐장 뒤에도 이만큼은 '운영 중'처럼 자주 받는다 (줄 서기 시작·마감 혼잡) */
const EDGE_HOURS = 1;

export const hasLiveSource = (p: Place) => !!(p.seoulArea || p.themeparksId || p.queueTimesId || p.airport);

/** 지금 운영 중(앞뒤 1시간 포함)인지 */
export function activeNow(p: Place, at = new Date()): boolean {
  const t = kst(at);
  if (!inSeason(p, t.date) || p.info?.closedToday) return false;
  const [open, close] = p.hours;
  if (close - open >= 24) return true;
  return t.hour >= open - EDGE_HOURS && t.hour < close + EDGE_HOURS;
}

/** 지금 이 장소를 다시 받기까지 분 */
export function cadenceMinutes(p: Place, at = new Date()): number {
  if (!hasLiveSource(p) || !activeNow(p, at)) return IDLE_MIN;
  if ((p.category === "themepark" || p.category === "waterpark") && (p.themeparksId || p.queueTimesId)) return PEAK_MIN;
  // 서울시 실측: 원천이 5분 단위 → 낮(7~23시)엔 5분 (11/1, lib/seoul-live seoulTtl과 같다)
  if (p.seoulArea) {
    const h = kst(at).hour;
    if (h >= 7 && h < 23) return PEAK_MIN;
  }
  return NORMAL_MIN;
}

/** 수집기에서: 마지막 수집 뒤 이만큼 지났으면 다시 받는다 (수집기 5분 간격의 흔들림을 1분 봐준다) */
export function isDue(p: Place, lastUpdatedAt: string | undefined, at = new Date()): boolean {
  if (!lastUpdatedAt) return true;
  const ageMin = (at.getTime() - Date.parse(lastUpdatedAt)) / 60_000;
  return ageMin >= cadenceMinutes(p, at) - 1;
}
