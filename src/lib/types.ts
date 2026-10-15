// 홈 상단 파트 탭 순서와 같다
export type Category = "landmark" | "street" | "themepark" | "beach" | "airport" | "event";

export const CATEGORY_LABEL: Record<Category, string> = {
  landmark: "명소",
  street: "핫플",
  themepark: "놀이공원",
  beach: "해변",
  airport: "공항",
  event: "축제",
};

export interface PlaceInfo {
  /** TourAPI 이용 시간 원문 (줄바꿈 정리) */
  hoursText?: string;
  restText?: string;
  infocenter?: string;
  /** 오늘 적용되는 운영 시간을 원문에서 찾았는지 */
  hoursVerified: boolean;
  closedToday?: boolean;
  /** 행사 일정이 TourAPI 올해 값인지. false면 작년 일정에서 1년 뒤로 추정 */
  eventVerified?: boolean;
  eventPlayTime?: string;
}

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
  /** 공항 IATA 코드 (있으면 공항 혼잡도 API 사용) */
  airport?: AirportCode;
  /** 공항: 시간당 출발 승객 수가 이 값이면 '매우 혼잡'(90점) */
  paxCapacity?: number;
  /** 0(실내)~1(야외). 비·폭염 영향 계산용. 없으면 카테고리 기본값 */
  outdoor?: number;
  /** 대표 사진 (public/places). 기본 출처는 한국관광공사 TourAPI(공공누리) */
  image?: string;
  /** 한국관광공사가 아닌 사진의 출처 (위키미디어 공용 등, CC 라이선스는 작성자·라이선스 표기 필수) */
  imageCredit?: { author: string; license: string; url: string };
  /** 한국관광공사 관광지 집중률 예측의 관광지 식별 정보 */
  kto?: { areaCd: string; signguCd: string; name: string };
  /** 이벤트 개최일 YYYY-MM-DD (KST) */
  eventDate?: string;
  /** 이벤트 종료일 (여러 날 행사) */
  eventEndDate?: string;
  /** 한국관광공사 TourAPI 콘텐츠 (운영 시간·행사 일정 원천). type 12 관광지, 15 행사 */
  ktoContent?: { id: number; type: number };
  /** 기상청 중기예보 구역 (land: 육상예보 광역, temp: 기온 도시) */
  midRegion?: { land: string; temp: string };
  /** 에어코리아 대기질 측정소 */
  airStation?: { sido: string; name: string };
  /** 부산시 생활인구 행정동 (예: "해운대구 우1동"). 시간대·성별·연령 패턴 */
  busanDongs?: string[];
  /** ThemeParks.wiki 엔티티 (놀이기구 대기시간) */
  themeparksId?: string;
  /** TourAPI에서 받아 붙인 정보 (getLivePlaces) */
  info?: PlaceInfo;
}

// ICN1·ICN2: 인천공항 제1·2터미널(인천국제공항공사), 나머지: 한국공항공사 국내선
export type AirportCode = "ICN1" | "ICN2" | "GMP" | "CJU" | "PUS" | "TAE" | "CJJ";

/** 공항 출국장·보안검색 구간 등 장소 안의 세부 구역 */
export interface Zone {
  id: string;
  label: string;
  score: number;
  waitMin?: number;
  people?: number;
  hours?: string;
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
  source: "seoul-citydata" | "incheon-airport" | "kac-airport" | "themeparks-wiki" | "model";
  zones?: Zone[];
  /** 테마파크: 운영 중 놀이기구 평균 대기(분) */
  avgWaitMin?: number;
  /** headcount가 한국공항공사 시간대별 탑승객 수(이번 시간 출발 승객)인지 */
  paxHour?: boolean;
  /** 서울시 실시간 인구처럼 범위로만 주는 인원 [최소, 최대] */
  headcountRange?: [number, number];
  updatedAt: string;
}

export interface CrowdResult extends CrowdSnapshot {
  /** 외부 API 장애 등으로 갱신되지 못한 데이터 */
  stale: boolean;
  ageMinutes: number;
}
