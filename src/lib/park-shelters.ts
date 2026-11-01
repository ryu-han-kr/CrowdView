// 국립공원 산장(대피소) 예약 (경수님 QA 11/1: 긴 종주는 대피소에서 자야 하는데 예약은 국립공원공단 사이트에서만 된다 → 바로 가게).
// 대피소 목록은 예약 사이트 공원별 탭에서 확인 (2026-11-01). 지금 예약 사이트에는 공원을 골라 여는 주소가 없어 대피소 예약 첫 화면으로 보낸다
export const SHELTER_RESERVATION_URL = "https://reservation.knps.or.kr/reservation/shelter/searchSimpleShelterReservation.do";
export const SHELTER_RESERVATION_EN_URL = "https://reservation.knps.or.kr/foreigner/main.do";

export interface ParkShelters {
  park: string;
  shelters: string[];
}

/** 키: 명소 id (src/data/korea/landmarks.json). 예약 사이트에 대피소가 있는 공원만 */
export const PARK_SHELTERS: Record<string, ParkShelters> = {
  jirisan: { park: "지리산", shelters: ["노고단대피소", "로타리대피소", "벽소령대피소", "세석대피소", "연하천대피소", "장터목대피소", "치밭목대피소"] },
  seoraksan: { park: "설악산", shelters: ["소청대피소", "수렴동대피소", "양폭대피소", "희운각대피소"] },
  deogyusan: { park: "덕유산", shelters: ["삿갓재대피소"] },
  sobaeksan: { park: "소백산", shelters: ["제2연화봉대피소"] },
};
