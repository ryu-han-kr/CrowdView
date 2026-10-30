// 지난 기록 히트맵 색 (경수님 10/30: 설정에서 원할 때 바꿀 수 있게, 기본은 사람들에게 익숙한 파·초·노·주·빨을 부드러운 톤으로)
// 칸 색은 CSS 변수 --heat-0~4 (혼잡 5단계 순서). html[data-heat]와 localStorage(cv:heat), 그리기 전에 layout 스크립트가 붙인다
import { LEVELS } from "./levels";

export interface HeatPalette {
  id: string;
  /** 설정에 보이는 이름 (번역 원본) */
  name: string;
  /** 쾌적 → 매우 혼잡 */
  colors: [string, string, string, string, string];
}

export const HEAT_PALETTES: HeatPalette[] = [
  // 기본: 한 단계 부드러운 파·초·노·주·빨, 노랑은 맑은 개나리색 (지인 QA 10/30: 원색은 너무 강하고 노랑이 칙칙했다)
  { id: "traffic", name: "파·초·노·주·빨", colors: ["#60a5fa", "#4ade80", "#ffe45c", "#fb923c", "#f87171"] },
  { id: "traffic-vivid", name: "파·초·노·주·빨 (선명)", colors: ["#3b82f6", "#22c55e", "#eab308", "#f97316", "#ef4444"] },
  { id: "traffic-muted", name: "파·초·노·주·빨 (차분하게)", colors: ["#7ba7e0", "#7fc79a", "#ecc94b", "#ef9f6b", "#e47c7c"] },
  { id: "traffic-pastel", name: "파·초·노·주·빨 (파스텔)", colors: ["#93c5fd", "#86efac", "#fde047", "#fdba74", "#fca5a5"] },
  { id: "coral", name: "코랄", colors: ["#ffedd5", "#fdba74", "#fb7185", "#dc2626", "#7f1d1d"] },
  { id: "level", name: "혼잡도 단계 색", colors: LEVELS.map((l) => l.color) as HeatPalette["colors"] },
  { id: "green", name: "초록", colors: ["#ecfccb", "#d9f99d", "#a3e635", "#65a30d", "#3f6212"] },
  { id: "pinkred", name: "분홍·빨강", colors: ["#fce7f3", "#fbcfe8", "#f472b6", "#e11d48", "#9f1239"] },
  { id: "rose", name: "로즈", colors: ["#fff1f2", "#fecdd3", "#fb7185", "#e11d48", "#881337"] },
  { id: "pinkviolet", name: "분홍·보라", colors: ["#fdf2f8", "#f5d0fe", "#e879f9", "#c026d3", "#701a75"] },
  { id: "blue", name: "파랑", colors: ["#e0f2fe", "#bae6fd", "#38bdf8", "#0284c7", "#0c4a6e"] },
  { id: "violet", name: "보라", colors: ["#ede9fe", "#c4b5fd", "#8b5cf6", "#6d28d9", "#4c1d95"] },
  { id: "teal", name: "청록", colors: ["#ccfbf1", "#5eead4", "#14b8a6", "#0f766e", "#134e4a"] },
  { id: "amber", name: "노랑·갈색", colors: ["#fef3c7", "#fcd34d", "#f59e0b", "#b45309", "#78350f"] },
  { id: "gray", name: "무채색", colors: ["#e2e8f0", "#94a3b8", "#64748b", "#334155", "#0f172a"] },
  // 색 구분이 어려운 분도 밝기만으로 읽히게 (viridis)
  { id: "cvd", name: "색약 배려", colors: ["#fde725", "#5ec962", "#21918c", "#3b528b", "#440154"] },
];

export const DEFAULT_HEAT = HEAT_PALETTES[0].id;

/** 점수(0~100) → 칸 색 변수. 자료 없음은 옅은 회색 */
export const heatVar = (score: number) => (score < 0 ? "var(--heat-none)" : `var(--heat-${Math.min(4, Math.max(0, Math.floor(score / 20)))})`);

/** :root(기본)과 html[data-heat=…] 마다 --heat-0~4 (layout의 <style>) */
export function heatCss(): string {
  const vars = (p: HeatPalette) => p.colors.map((c, i) => `--heat-${i}:${c}`).join(";");
  const def = HEAT_PALETTES.find((p) => p.id === DEFAULT_HEAT)!;
  return (
    // 자료 없음 칸은 회색 눈금을 따라 다크 모드에서 저절로 어두워진다 (dark.css)
    `:root{${vars(def)};--heat-none:var(--color-gray-100)}` +
    HEAT_PALETTES.filter((p) => p.id !== DEFAULT_HEAT)
      .map((p) => `html[data-heat="${p.id}"]{${vars(p)}}`)
      .join("")
  );
}
