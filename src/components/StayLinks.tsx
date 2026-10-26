import type { Lang } from "@/i18n/config";
import type { T } from "@/i18n/translate";
import type { LatLng } from "@/lib/geo";
import { Glyph } from "@/components/Glyph";
import { isAffiliate, withAffiliate } from "@/lib/affiliate";

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
    { id: "kkday", label: "KKday", href: `https://www.kkday.com/${KKDAY_LANG[lang]}/product/productlist?keyword=${q}` },
    { id: "trip-tour", label: "Trip.com", icon: "trip", href: `https://${TRIP_HOST[lang]}/things-to-do/list?keyword=${q}` },
  ];
  if (lang === "ko") return [{ id: "myrealtrip", label: "마이리얼트립", href: `https://www.myrealtrip.com/search?q=${q}` }, ...global];
  return [...global, { id: "getyourguide", label: "GetYourGuide", href: `https://www.getyourguide.com/s/?q=${q}` }];
}

/** 플랫폼 아이콘 타일 (이름은 마우스를 올리거나 화면 낭독기로). 누르면 이용 집계(data-aff)에 잡힌다 */
function LinkTiles({ title, glyph, desc, links, t, className }: { title: string; glyph: string; desc: string; links: Tile[]; t: T; className: string }) {
  const aff = links.some((s) => isAffiliate(s.id));
  return (
    <section className={`rounded-3xl border border-gray-100 p-4 ${className}`}>
      <p className="flex items-center gap-1.5 text-sm font-bold">
        <Glyph e={glyph} className="h-4 w-4 text-indigo-500" /> {title}
      </p>
      <p className="mt-0.5 text-xs text-gray-500">{desc}</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {links.map((s) => (
          <li key={s.id}>
            <a
              href={withAffiliate(s.id, s.href)}
              target="_blank"
              rel={isAffiliate(s.id) ? "sponsored noopener" : "noreferrer nofollow"}
              title={s.label}
              aria-label={s.label}
              data-aff={s.id}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-100 bg-white shadow-sm transition-transform hover:-translate-y-0.5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/brands/${s.icon ?? s.id}.png`} alt="" width={26} height={26} className="h-[26px] w-[26px] rounded-md" />
            </a>
          </li>
        ))}
      </ul>
      {/* 공정위 추천·보증 심사지침: 대가를 받는 링크임을 알린다 */}
      {aff && <p className="mt-2 text-[11px] text-gray-400">{t("일부는 제휴 링크라, 예약하면 CrowdView가 수수료를 받을 수 있어요 (가격은 같아요)")}</p>}
    </section>
  );
}

export function StayLinks({ ko, en, lang, t, at, className = "" }: { ko: string; en: string; lang: Lang; t: T; at?: LatLng; className?: string }) {
  return (
    <LinkTiles
      title={t("근처 숙소 찾기")}
      glyph="🛏️"
      desc={t("‘{name}’ 근처 숙소를 각 예약 사이트에서 바로 검색해요. 가격·예약은 그 사이트에서 확인하세요.", { name: lang === "ko" ? ko : en })}
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
      desc={t("‘{name}’ 입장권·투어를 각 예약 사이트에서 바로 검색해요. 할인가가 있는지 비교해 보세요.", { name: lang === "ko" ? ko : en })}
      links={tourLinks(ko, en, lang)}
      t={t}
      className={className}
    />
  );
}
