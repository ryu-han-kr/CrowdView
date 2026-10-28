import type { Weather } from "@/lib/crowd/signals";

/** 홈 배경 효과 종류 (경수님 10/28: 실제 날씨에 맞추고, 날씨 효과가 없으면 계절 기본) */
export type SeasonFx = "snow" | "rain" | "leaves" | "sprout" | "sun";

/**
 * 지금 서울 날씨(기상청 단기예보 이번 시각)와 달로 효과를 고른다.
 * 눈·비가 오면 그대로, 아니면 계절 기본: 겨울(12~2월) 눈, 봄(3~5월) 새싹, 여름(6~8월) 햇빛(강수확률 60% 이상이면 비), 가을 낙엽
 */
export function pickSeasonFx(month: number, w?: Weather): SeasonFx {
  if (w?.pty === 3 || w?.pty === 2) return "snow";
  if (w?.pty === 1 || w?.pty === 4) return "rain";
  if (month === 12 || month <= 2) return "snow";
  if (month <= 5) return "sprout";
  if (month <= 8) return (w?.pop ?? 0) >= 60 ? "rain" : "sun";
  return "leaves";
}
