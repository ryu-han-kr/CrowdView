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
  // 광고 링크(myrealt.rip/…)를 풀면 나오는 "utm_source=mktpartner&t_scope=604800&mylink_id=…"
  myrealtrip: process.env.NEXT_PUBLIC_AFF_MYREALTRIP,
  getyourguide: process.env.NEXT_PUBLIC_AFF_GETYOURGUIDE,
};

/** 원래 주소를 업체 중계 주소로 감싸야 집계되는 곳 (10/26 마이리얼트립: 광고 링크가 bridge 주소로 감싼 형태) */
const WRAP: Record<string, (href: string) => string> = {
  myrealtrip: (href) => `https://www.myrealtrip.com/main/bridge/marketing?return_url=${encodeURIComponent(href)}`,
};

export const isAffiliate = (id: string) => !!PARAMS[id]?.trim();

/** 제휴 값이 있으면 주소 뒤에 붙이고, 중계 주소가 필요한 업체는 그걸로 감싼다 */
export function withAffiliate(id: string, href: string): string {
  const p = PARAMS[id]?.trim().replace(/^[?&]/, "");
  if (!p) return href;
  const tagged = `${href}${href.includes("?") ? "&" : "?"}${p}`;
  return WRAP[id] ? WRAP[id](tagged) : tagged;
}
