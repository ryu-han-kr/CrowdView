import type { Lang } from "@/i18n/config";
import type { T } from "@/i18n/translate";
import type { LatLng } from "@/lib/geo";
import { Glyph } from "@/components/Glyph";

// 근처 숙소 찾기: 숙소 플랫폼마다 그 장소 이름(아고다는 좌표)으로 검색한 결과를 새 창으로 연다.
// 우리가 매물을 모으지 않고(제휴·API 승인 전) 각 사이트의 검색 화면으로 보낸다. 아이콘은 public/brands (각 사이트 파비콘)
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

export function stayLinks(ko: string, en: string, lang: Lang, at?: LatLng): { id: string; label: string; href: string }[] {
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
    { id: "trip", label: "Trip.com", href: `https://${TRIP_HOST[lang]}/hotels/list?keyword=${lang === "ko" ? k : encodeURIComponent(en)}` },
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

/** 플랫폼 아이콘만 작게 (이름은 마우스를 올리거나 화면 낭독기로) */
export function StayLinks({ ko, en, lang, t, at, className = "" }: { ko: string; en: string; lang: Lang; t: T; at?: LatLng; className?: string }) {
  return (
    <section className={`rounded-3xl border border-gray-100 p-4 ${className}`}>
      <p className="flex items-center gap-1.5 text-sm font-bold">
        <Glyph e="🛏️" className="h-4 w-4 text-indigo-500" /> {t("근처 숙소 찾기")}
      </p>
      <p className="mt-0.5 text-xs text-gray-500">
        {t("‘{name}’ 근처 숙소를 각 예약 사이트에서 바로 검색해요. 가격·예약은 그 사이트에서 확인하세요.", { name: lang === "ko" ? ko : en })}
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {stayLinks(ko, en, lang, at).map((s) => (
          <li key={s.id}>
            <a
              href={s.href}
              target="_blank"
              rel="noreferrer nofollow"
              title={s.label}
              aria-label={s.label}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-100 bg-white shadow-sm transition-transform hover:-translate-y-0.5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/brands/${s.id}.png`} alt="" width={26} height={26} className="h-[26px] w-[26px] rounded-md" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
