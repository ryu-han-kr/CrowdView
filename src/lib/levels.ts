// 혼잡도 5단계. 내부적으로는 0~100 점수로 다루고, 화면에는 단계로 보여준다.
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
  { key: 1, label: "쾌적", desc: "줄 없이 바로 이용", color: "#10b981", min: 0 },
  { key: 2, label: "원활", desc: "대기 짧고 이동 편함", color: "#84cc16", min: 20 },
  { key: 3, label: "보통", desc: "평소 주말 수준", color: "#eab308", min: 40 },
  { key: 4, label: "혼잡", desc: "대기·이동 불편", color: "#f97316", min: 60 },
  { key: 5, label: "매우 혼잡", desc: "방문 비추천", color: "#ef4444", min: 80 },
];

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
