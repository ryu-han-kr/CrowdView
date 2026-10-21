import type { LevelSteps } from "./levels";

// 홈 상단 파트 탭 순서와 같다
export type Category = "landmark" | "street" | "themepark" | "waterpark" | "ski" | "beach" | "airport" | "event";

export const CATEGORY_LABEL: Record<Category, string> = {
  landmark: "명소",
  street: "핫플",
  themepark: "놀이공원",
  waterpark: "워터파크",
  ski: "스키장",
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

/** 장소별 혼잡 기준. 예: 홍대 인구 5만 미만 쾌적 … 14만 이상 매우 혼잡 */
export interface LevelCriteria {
  unit: "명" | "분";
  steps: LevelSteps;
  /** 어떤 수치에 대한 기준인지 (예: 서울시 실시간 인구, 놀이기구 평균 대기) */
  basis: string;
  /** 데이터가 쌓이기 전 임시로 정한 값인지 */
  provisional?: boolean;
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
  /** 지금 혼잡도 기준 (실제 단위). 단계 상한값: 쾌적·원활·보통·혼잡, 그 이상은 매우 혼잡 */
  criteria?: LevelCriteria;
  /** 공항: 시간당 출발 승객 수 기준 (시간대 그래프) */
  paxSteps?: LevelSteps;
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
  /** Queue-Times 공원 번호 (ThemeParks.wiki가 실패할 때 예비 원천) */
  queueTimesId?: number;
  /** 계절 영업: 여는 달 ~ 닫는 달 (1~12, 해를 넘기면 [12, 3]처럼). 그 밖의 달은 시즌 아님 */
  season?: [from: number, to: number];
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
  /** 놀이공원 구역 (에버랜드 '매직랜드' 등) */
  area?: string;
}

export interface HourPoint {
  hour: number;
  score: number;
  forecast: boolean;
  /** 그 시간의 인원(또는 시간당 승객). kind: real 실측·공식 예보, pattern 월평균 패턴 기반, est 점수로 환산한 추정 */
  people?: number;
  peopleKind?: "real" | "pattern" | "est" | "area";
}

export interface CrowdSnapshot {
  placeId: string;
  score: number;
  /** 운영 시간 여부 — 운영 외 시간엔 단계 대신 "운영 종료"로 표시 */
  open: boolean;
  headcount: number;
  trend: "up" | "down" | "flat";
  hourly: HourPoint[];
  source: "seoul-citydata" | "incheon-airport" | "kac-airport" | "themeparks-wiki" | "queue-times" | "model";
  zones?: Zone[];
  /** 원천이 주는 공식 단계 (예: 서울시 '보통'). 장소 기준과 다를 수 있어 참고로 보여준다 */
  officialLevel?: string;
  /** 계절 영업 장소의 시즌이 아닌 때 (스키장 여름 등) */
  offSeason?: boolean;
  /** 테마파크: 운영 중 놀이기구 평균 대기(분) */
  avgWaitMin?: number;
  /** headcount가 한국공항공사 시간대별 탑승객 수(이번 시간 출발 승객)인지 */
  paxHour?: boolean;
  /** 서울시 실시간 인구처럼 범위로만 주는 인원 [최소, 최대] */
  headcountRange?: [number, number];
  /**
   * 서울시 실시간 인구는 장소가 아니라 주변 지역(예: 잠실 관광특구) 전체 인원이다.
   * 이때 headcount는 그 인원을 장소 크기로 줄인 '명소 기준' 추정이고, 지역 실측은 여기에 따로 둔다
   */
  area?: { name: string; range: [number, number] };
  /** 주변 지역 인구가 평소 이 요일·시간보다 몇 배인지 (lib/crowd/baseline, 2주 넘게 쌓인 뒤부터) */
  vsUsual?: number;
  /** 원천의 관측 시각 (서울시 'YYYY-MM-DD HH:mm', KST). 화면의 '○시 기준'은 이 값 */
  observedAt?: string;
  updatedAt: string;
}

export interface CrowdResult extends CrowdSnapshot {
  /** 외부 API 장애 등으로 40분 넘게 갱신되지 못한 데이터 (화면에 '갱신 지연') */
  stale: boolean;
  ageMinutes: number;
}
