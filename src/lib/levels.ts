// 혼잡도 5단계. 내부적으로는 0~100 점수로 다루고, 화면에는 단계로 보여준다.
// 11/1 경수님: 이름을 쾌적·원활 → 한산·여유 (지인 QA: 쾌적과 원활이 비슷하게 느껴진다)
// 7단계는 색만으로 구분이 어렵고, 원천 데이터(서울시 4단계 등)의 해상도보다 촘촘해서 5단계를 채택.

export type LevelKey = 1 | 2 | 3 | 4 | 5;

export interface Level {
  key: LevelKey;
  label: string;
  desc: string;
  color: string;
  min: number;
}

export const LEVELS: Level[] = [
  { key: 1, label: "한산", desc: "줄 없이 바로 이용", color: "#10b981", min: 0 },
  { key: 2, label: "여유", desc: "대기 짧고 이동 편함", color: "#84cc16", min: 20 },
  { key: 3, label: "보통", desc: "평소 주말 수준", color: "#eab308", min: 40 },
  { key: 4, label: "혼잡", desc: "대기·이동 불편", color: "#f97316", min: 60 },
  { key: 5, label: "매우 혼잡", desc: "방문 비추천", color: "#ef4444", min: 80 },
];

/**
 * 글자색 (QA 10/21 접근성: 단계 색을 그대로 글자에 쓰면 흰 바탕·옅은 바탕에서 대비가 1.8~2.8로 읽기 어렵다).
 * ink = 같은 색 계열의 진한 색 (흰·옅은 바탕 위 글자, 대비 4.5 이상), deep = 단계 색으로 칠한 칸 위 글자 (흰 글자 대신)
 */
const INK: Record<string, string> = {
  "#10b981": "#047857",
  "#84cc16": "#4d7c0f",
  "#eab308": "#854d0e",
  "#f97316": "#c2410c",
  "#ef4444": "#b91c1c",
  "#6366f1": "#4338ca",
  "#9ca3af": "#4b5563",
  "#6b7280": "#4b5563",
};
const DEEP: Record<string, string> = {
  "#10b981": "#022c22",
  "#84cc16": "#1a2e05",
  "#eab308": "#422006",
  "#f97316": "#431407",
  "#ef4444": "#000000",
};
// 단계 색을 옅게 깐 칸(약 17%) 위 글자: ink보다 한 단계 진하게 (Tailwind 800, 대비 6 이상. UI QA 10차 주간 표)
const TINT_INK: Record<string, string> = {
  "#10b981": "#065f46",
  "#84cc16": "#3f6212",
  "#eab308": "#713f12",
  "#f97316": "#9a3412",
  "#ef4444": "#991b1b",
};
export const inkOf = (color: string) => INK[color.toLowerCase()] ?? color;
export const tintInkOf = (color: string) => TINT_INK[color.toLowerCase()] ?? "#111827";
export const deepOf = (color: string) => DEEP[color.toLowerCase()] ?? "#111827";

export function levelOf(score: number): Level {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (score >= LEVELS[i].min) return LEVELS[i];
  }
  return LEVELS[0];
}

/** 쾌적·원활·보통·혼잡의 상한값. 이 값 이상이면 매우 혼잡 */
export type LevelSteps = [number, number, number, number];

/**
 * 실제 수치(인원·대기분)를 장소별 기준으로 0~100점에 맞춘다.
 * 기준 사이는 직선으로 이어 단계 경계(20·40·60·80점)와 정확히 맞물린다.
 */
export function scoreFromValue(value: number, steps: LevelSteps): number {
  const bounds = [0, ...steps, steps[3] * 1.5];
  for (let i = 0; i < 5; i++) {
    if (value < bounds[i + 1]) return Math.round(i * 20 + (20 * (value - bounds[i])) / (bounds[i + 1] - bounds[i]));
  }
  return 100;
}

/** 점수 → 같은 기준의 수치 (예측 점수를 인원으로 보여줄 때) */
export function valueFromScore(score: number, steps: LevelSteps): number {
  const bounds = [0, ...steps, steps[3] * 1.5];
  const i = Math.min(4, Math.floor(Math.max(0, score) / 20));
  return Math.round(bounds[i] + ((Math.min(score, 100) - i * 20) / 20) * (bounds[i + 1] - bounds[i]));
}
