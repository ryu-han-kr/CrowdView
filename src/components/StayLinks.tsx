import type { Lang } from "@/i18n/config";
import type { T } from "@/i18n/translate";
import type { LatLng } from "@/lib/geo";
import { Glyph } from "@/components/Glyph";
import { isAffiliate, withAffiliate } from "@/lib/affiliate";
import { COUPANG_LINKS, COUPANG_NOTICE } from "@/lib/coupang-links";

// 근처 숙소 찾기: 숙소 플랫폼마다 그 장소 이름(아고다는 좌표)으로 검색한 결과를 새 창으로 연다.
// 우리가 매물을 모으지 않고 각 사이트의 검색 화면으로 보낸다. 제휴 값이 있으면 꼬리표를 붙인다(lib/affiliate). 아이콘은 public/brands (각 사이트 파비콘)
// 국내 서비스(야놀자·여기어때·네이버)는 한국어 화면에서만, 해외 서비스는 이용자 언어 사이트로.
const TRIP_HOST: Record<Lang, string> = { ko: "kr.trip.com", en: "www.trip.com", ja: "jp.trip.com", "zh-CN": "www.trip.com", "zh-TW": "tw.trip.com" };
const BOOKING_LANG: Record<Lang, string> = { ko: "ko", en: "en-us", ja: "ja", "zh-CN": "zh-cn", "zh-TW": "zh-tw" };
const AGODA_LANG: Record<Lang, string> = { ko: "ko-kr", en: "en-us", ja: "ja-jp", "zh-CN": "zh-cn", "zh-TW": "zh-tw" };
const EXPEDIA_HOST: Record<Lang, string> = {
  ko: "www.expedia.co.kr",
  en: "www.expedia.com",
  ja: "www.expedia.co.jp",
  "zh-CN": "www.expedia.cn",
  "zh-TW": "www.expedia.com.tw",
};

type Tile = { id: string; label: string; href: string; icon?: string };

// 커미션 높은 순 (10/28 확인: Trip.com 숙소 5%·쿠폰 써도 유지·쿠키 30일 > 아고다 5.6%(쿠폰 쓰면 2.1%·1일) > 야놀자 2.8%(앱만) > 여기어때(승인 전, 되면 6%로 맨 앞)
// 투어: 클룩 3.5~10.5% > 마이리얼트립 2~4% > Trip.com 투어 > 쿠팡 약 3% > KKday 2.1% > GetYourGuide). 제휴 없는 곳은 그 뒤 원래 순서
const RANK = ["trip", "agoda", "yanolja", "yeogi", "klook", "myrealtrip", "trip-tour", "coupang", "kkday", "getyourguide"];

/**
 * 예약 사이트 검색어로 쓸 짧은 이름 (10/26 링크 점검: 'Myeongdong Tourism Special Zone'은 Klook 결과 0건·Trip.com 투어는 상하이가 나왔다).
 * 관광특구 꼬리, 괄호 설명, '·'로 이은 두 번째 이름을 뗀다
 */
export function searchName(name: string): string {
  const short = name
    .replace(/\s*\(.*?\)\s*/g, " ")
    .split("·")[0]
    .trim()
    .replace(/\s*(관광특구|특구)$/, "")
    .replace(/\s+(Tourist|Tourism)?\s*Special\s*(Tourist|Tourism)?\s*Zone$/i, "")
    .trim();
  return short || name;
}

export function stayLinks(koName: string, enName: string, lang: Lang, at?: LatLng): Tile[] {
  const ko = searchName(koName);
  const en = searchName(enName);
  const k = encodeURIComponent(ko);
  // 해외 사이트는 영어 이름 + 나라로 (한국어 화면이면 한국어 이름)
  const q = lang === "ko" ? ko : `${en}, South Korea`;
  const g = encodeURIComponent(q);
  const global = [
    {
      id: "agoda",
      label: "Agoda",
      // 아고다는 이름 검색 링크가 동작하지 않아 좌표 반경 검색 (좌표가 없으면 이름)
      href: at
        ? `https://www.agoda.com/${AGODA_LANG[lang]}/search?latitude=${at.lat}&longitude=${at.lng}&radius=2`
        : `https://www.agoda.com/${AGODA_LANG[lang]}/search?textToSearch=${g}`,
    },
    { id: "booking", label: "Booking.com", href: `https://www.booking.com/searchresults.html?ss=${g}&lang=${BOOKING_LANG[lang]}` },
    // 숙소 목록(hotels/list?keyword=)은 이름을 못 알아듣고 엉뚱한 지역을 보여 줘서(10/26 '롯데월드' → 평창) 통합 검색으로
    { id: "trip", label: "Trip.com", href: `https://${TRIP_HOST[lang]}/global-search/searchlist/search?keyword=${lang === "ko" ? k : encodeURIComponent(en)}` },
    { id: "airbnb", label: "Airbnb", href: lang === "ko" ? `https://www.airbnb.co.kr/s/${k}/homes` : `https://www.airbnb.com/s/${g}/homes` },
    { id: "expedia", label: "Expedia", href: `https://${EXPEDIA_HOST[lang]}/Hotel-Search?destination=${g}` },
    { id: "hotels", label: "Hotels.com", href: `https://www.hotels.com/Hotel-Search?destination=${g}` },
    { id: "google", label: "Google Hotels", href: `https://www.google.com/travel/search?q=${encodeURIComponent(`${q} hotels`)}` },
  ];
  if (lang !== "ko") return global;
  return [
    { id: "yanolja", label: "놀(야놀자)", href: `https://nol.yanolja.com/discovery/list/search?q=${k}` },
    { id: "yeogi", label: "여기어때", href: `https://www.yeogi.com/domestic-accommodations?keyword=${k}` },
    { id: "naver", label: "네이버", href: `https://search.naver.com/search.naver?query=${encodeURIComponent(`${ko} 숙소`)}` },
    ...global,
  ];
}

// 투어·입장권 찾기 (사용자 10/24). 외국어 화면은 Klook·KKday·GetYourGuide·Trip.com, 한국어 화면은 마이리얼트립을 앞에.
// 검색 주소는 10/24 실제 브라우저로 확인 (마이리얼트립은 q=, Klook은 search/result/?query=)
const KLOOK_LANG: Record<Lang, string> = { ko: "ko", en: "en-US", ja: "ja", "zh-CN": "zh-CN", "zh-TW": "zh-TW" };
const KKDAY_LANG: Record<Lang, string> = { ko: "ko", en: "en", ja: "ja", "zh-CN": "zh-cn", "zh-TW": "zh-tw" };

export function tourLinks(ko: string, en: string, lang: Lang): Tile[] {
  const q = encodeURIComponent(searchName(lang === "ko" ? ko : en));
  const global: Tile[] = [
    { id: "klook", label: "Klook", href: `https://www.klook.com/${KLOOK_LANG[lang]}/search/result/?query=${q}` },
    // KKday는 대행사를 거쳐야 제휴가 돼서 보류 중 — 제휴 값이 들어오기 전엔 안 보인다 (사용자 10/26)
    ...(isAffiliate("kkday") ? [{ id: "kkday", label: "KKday", href: `https://www.kkday.com/${KKDAY_LANG[lang]}/product/productlist?keyword=${q}` }] : []),
    { id: "trip-tour", label: "Trip.com", icon: "trip", href: `https://${TRIP_HOST[lang]}/things-to-do/list?keyword=${q}` },
  ];
  // 쿠팡 파트너스(10/27): 입장권 할인 상품이 많은 곳만 장소별 링크, 한국어 화면에서만
  const coupang: Tile[] = COUPANG_LINKS[ko] ? [{ id: "coupang", label: "쿠팡", href: COUPANG_LINKS[ko] }] : [];
  if (lang === "ko") return [{ id: "myrealtrip", label: "마이리얼트립", href: `https://www.myrealtrip.com/search?q=${q}` }, ...coupang, ...global];
  return [...global, { id: "getyourguide", label: "GetYourGuide", href: `https://www.getyourguide.com/s/?q=${q}` }];
}

/**
 * 예약 사이트 칸 (10/28 경수님: 외국인·한국인이 더 잘 쓰게 예쁘게). 맨 위에 추천 업체 큰 버튼 하나, 아래에 이름이 붙은 비교 버튼들.
 * 아이콘만으로는 아는 사람만 알아서 이름을 다 보이게, 테두리로 강조 (경수님 10/28). 커미션 높은 순(RANK), 맨 앞 하나를 추천으로 크게. 누르면 이용 집계(data-aff)에 잡힌다
 */
function LinkTiles({ title, glyph, desc, links, t, className }: { title: string; glyph: string; desc: string; links: Tile[]; t: T; className: string }) {
  // 쿠팡 링크는 주소 자체가 파트너스 링크라 꼬리표 없이도 제휴
  const paid = (id: string) => isAffiliate(id) || id === "coupang";
  const aff = links.some((s) => paid(s.id));
  const coupang = links.some((s) => s.id === "coupang");
  const rank = (s: Tile) => (paid(s.id) ? (RANK.indexOf(s.id) + 1 || 50) : 100);
  const sorted = [...links].sort((a, b) => rank(a) - rank(b));
  const top = sorted.find((s) => paid(s.id));
  const rest = sorted.filter((s) => s !== top);
  const attrs = (s: Tile) => ({
    href: withAffiliate(s.id, s.href),
    target: "_blank",
    rel: paid(s.id) ? "sponsored noopener" : "noreferrer nofollow",
    "data-aff": s.id,
  });
  const icon = (s: Tile, size: number, round: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/brands/${s.icon ?? s.id}.png`} alt="" width={size} height={size} className={`shrink-0 ${round}`} style={{ width: size, height: size }} />
  );
  return (
    <section className={`rounded-3xl border border-gray-100 bg-gradient-to-b from-indigo-50/70 to-white p-4 ${className}`}>
      <p className="flex items-center gap-2 text-base font-extrabold">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-indigo-600 shadow-sm">
          <Glyph e={glyph} className="h-[18px] w-[18px]" />
        </span>
        {title}
      </p>
      <p className="mt-1.5 text-[13px] text-gray-600">{desc}</p>
      {top && (
        <a
          {...attrs(top)}
          className="group mt-3 flex items-center gap-3 rounded-2xl border-2 border-indigo-500 bg-white p-3 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          {icon(top, 40, "rounded-xl")}
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-indigo-700">{t("추천 예약처")}</span>
            <span className="block truncate text-base font-extrabold text-gray-900">{top.label}</span>
          </span>
          <span className="shrink-0 rounded-full bg-indigo-600 px-3.5 py-2 text-sm font-bold text-white transition group-hover:bg-indigo-700">
            {t("보러 가기")} ›
          </span>
        </a>
      )}
      {rest.length > 0 && (
        <>
          <p className="mt-3 text-xs font-semibold text-gray-600">{t("다른 사이트와 비교")}</p>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {rest.map((s) => (
              <li key={s.id}>
                <a
                  {...attrs(s)}
                  className={`flex h-10 items-center gap-2 rounded-xl border-2 bg-white pr-3.5 pl-2 text-sm font-bold text-gray-900 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-400 ${paid(s.id) ? "border-indigo-200" : "border-gray-200"}`}
                >
                  {icon(s, 24, "rounded-md")}
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      {/* 공정위 추천·보증 심사지침: 대가를 받는 링크임을 알린다. 10/28 경수님이 문구를 빼자 했지만 법·약관상 필수라 짧게 한 줄로만 */}
      {/* 쿠팡 파트너스 약관: 고지 문구를 링크 가까이에 그대로 (한국어 화면에서만 쿠팡 링크가 나온다) */}
      {aff && <p className="mt-2.5 text-[11px] leading-snug text-gray-500">{coupang ? COUPANG_NOTICE : t("광고 · 제휴 링크")}</p>}
    </section>
  );
}

export function StayLinks({ ko, en, lang, t, at, className = "" }: { ko: string; en: string; lang: Lang; t: T; at?: LatLng; className?: string }) {
  return (
    <LinkTiles
      title={t("근처 숙소 찾기")}
      glyph="🛏️"
      desc={t("‘{name}’ 근처 숙소, 특가·할인 상품으로 만나보세요", { name: lang === "ko" ? ko : en })}
      links={stayLinks(ko, en, lang, at)}
      t={t}
      className={className}
    />
  );
}

export function TourLinks({ ko, en, lang, t, className = "" }: { ko: string; en: string; lang: Lang; t: T; className?: string }) {
  return (
    <LinkTiles
      title={t("투어·입장권 찾기")}
      glyph="🎟️"
      desc={t("‘{name}’ 입장권·투어, 특가·할인 상품으로 만나보세요", { name: lang === "ko" ? ko : en })}
      links={tourLinks(ko, en, lang)}
      t={t}
      className={className}
    />
  );
}
