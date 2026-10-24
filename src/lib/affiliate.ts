// 제휴(어필리에이트) 링크 꼬리표 (사용자 10/24). 업체마다 가입 후 받은 추적 값을 Vercel 환경변수에 '쿼리 문자열'로 넣는다
// 예) NEXT_PUBLIC_AFF_AGODA="cid=1234567" · NEXT_PUBLIC_AFF_TRIP="Allianceid=123&SID=456" · NEXT_PUBLIC_AFF_KLOOK="aid=12345"
// 값이 없으면 지금처럼 일반 검색 링크. 수수료는 클릭이 아니라 실제 이용한 예약에만 붙는다 (lib/revenue)
const PARAMS: Record<string, string | undefined> = {
  agoda: process.env.NEXT_PUBLIC_AFF_AGODA,
  booking: process.env.NEXT_PUBLIC_AFF_BOOKING,
  trip: process.env.NEXT_PUBLIC_AFF_TRIP,
  "trip-tour": process.env.NEXT_PUBLIC_AFF_TRIP,
  expedia: process.env.NEXT_PUBLIC_AFF_EXPEDIA,
  hotels: process.env.NEXT_PUBLIC_AFF_EXPEDIA,
  klook: process.env.NEXT_PUBLIC_AFF_KLOOK,
  kkday: process.env.NEXT_PUBLIC_AFF_KKDAY,
  myrealtrip: process.env.NEXT_PUBLIC_AFF_MYREALTRIP,
  getyourguide: process.env.NEXT_PUBLIC_AFF_GETYOURGUIDE,
};

export const isAffiliate = (id: string) => !!PARAMS[id]?.trim();

/** 제휴 값이 있으면 주소 뒤에 붙인다 */
export function withAffiliate(id: string, href: string): string {
  const p = PARAMS[id]?.trim().replace(/^[?&]/, "");
  return p ? `${href}${href.includes("?") ? "&" : "?"}${p}` : href;
}
