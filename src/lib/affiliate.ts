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

// 링크프라이스(10/27 가입, 어필리에이트 ID는 NEXT_PUBLIC_LINKPRICE_ID): 직접 제휴가 없는 곳은 링크프라이스 딥링크로 감싼다.
// 승인 완료(10/27): KKday·호텔스컴바인·제주패스. 익스피디아·호텔스닷컴은 승인 대기
// NOL(야놀자, 10/27 승인): 앱 예약만 실적(웹 X), 클릭 후 24시간. 링크는 앱스플라이어(onelink)로 넘어가 앱 홈이 열린다(검색어는 안 넘어감)
const LINKPRICE_ID = process.env.NEXT_PUBLIC_LINKPRICE_ID?.trim();
/** 우리 링크 id → 링크프라이스 머천트 id (승인 완료된 것만) */
export const LINKPRICE_MERCHANTS: Record<string, string> = { kkday: "kkday", yanolja: "yanolja" };
const linkprice = (merchant: string, href: string) =>
  `https://newtip.net/click.php?m=${merchant}&a=${LINKPRICE_ID}&l=9999&l_cd1=3&l_cd2=0&tu=${encodeURIComponent(href)}`;

/** 원래 주소를 업체 중계 주소로 감싸야 집계되는 곳 (10/26 마이리얼트립: 광고 링크가 bridge 주소로 감싼 형태) */
const WRAP: Record<string, (href: string) => string> = {
  myrealtrip: (href) => `https://www.myrealtrip.com/main/bridge/marketing?return_url=${encodeURIComponent(href)}`,
};

export const isAffiliate = (id: string) => !!PARAMS[id]?.trim() || (!!LINKPRICE_ID && !!LINKPRICE_MERCHANTS[id]);

/** 제휴 값이 있으면 주소 뒤에 붙이고, 중계 주소가 필요한 업체는 그걸로 감싼다 */
export function withAffiliate(id: string, href: string): string {
  const p = PARAMS[id]?.trim().replace(/^[?&]/, "");
  // 직접 제휴 값이 없고 링크프라이스 머천트면 딥링크로
  if (!p && LINKPRICE_ID && LINKPRICE_MERCHANTS[id]) return linkprice(LINKPRICE_MERCHANTS[id], href);
  if (!p) return href;
  const tagged = `${href}${href.includes("?") ? "&" : "?"}${p}`;
  return WRAP[id] ? WRAP[id](tagged) : tagged;
}
