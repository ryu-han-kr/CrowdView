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
