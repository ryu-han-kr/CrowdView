export type Category = "themepark" | "tourist" | "event";

export const CATEGORY_LABEL: Record<Category, string> = {
  themepark: "테마파크",
  tourist: "관광지",
  event: "이벤트",
};

export interface Place {
  id: string;
  name: string;
  category: Category;
  region: string;
  address: string;
  lat: number;
  lng: number;
  /** 수용 가능 인원 (추정 인원 계산용) */
  capacity: number;
  /** 0~1, 평소 인기도 */
  popularity: number;
  /** 피크 시각 (KST, 소수 가능) */
  peakHour: number;
  hours: [open: number, close: number];
  emoji: string;
  /** 히어로 그라데이션 색상 (hue) */
  hue: number;
  tags: string[];
  description: string;
  /** 서울시 실시간 도시데이터 장소명 (있으면 실데이터 사용) */
  seoulArea?: string;
  /** 이벤트 개최일 YYYY-MM-DD (KST) */
  eventDate?: string;
}

export interface HourPoint {
  hour: number;
  score: number;
  forecast: boolean;
}

export interface CrowdSnapshot {
  placeId: string;
  score: number;
  /** 운영 시간 여부 — 운영 외 시간엔 단계 대신 "운영 종료"로 표시 */
  open: boolean;
  headcount: number;
  trend: "up" | "down" | "flat";
  hourly: HourPoint[];
  source: "seoul-citydata" | "model";
  updatedAt: string;
}

export interface CrowdResult extends CrowdSnapshot {
  /** 외부 API 장애 등으로 갱신되지 못한 데이터 */
  stale: boolean;
  ageMinutes: number;
}
