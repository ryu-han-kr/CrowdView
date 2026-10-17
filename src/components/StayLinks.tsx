import type { Lang } from "@/i18n/config";
import type { T } from "@/i18n/translate";

// 근처 숙소 찾기: 숙소 플랫폼마다 그 장소 이름으로 검색한 결과를 새 창으로 연다.
// 우리가 매물을 모으지 않고(제휴·API 승인 전) 각 사이트의 검색 화면으로 보낸다.
// 국내 서비스(야놀자·여기어때·네이버)는 한국어 화면에서만, 해외 서비스는 이용자 언어 사이트로.
// 아고다는 위치 검색 링크가 제휴(파트너) 계정이 있어야 동작해 아직 뺐다
const TRIP_HOST: Record<Lang, string> = { ko: "kr.trip.com", en: "www.trip.com", ja: "jp.trip.com", "zh-CN": "www.trip.com", "zh-TW": "tw.trip.com" };
const BOOKING_LANG: Record<Lang, string> = { ko: "ko", en: "en-us", ja: "ja", "zh-CN": "zh-cn", "zh-TW": "zh-tw" };

export function stayLinks(ko: string, en: string, lang: Lang): { id: string; label: string; href: string; color: string }[] {
  const k = encodeURIComponent(ko);
  // 해외 사이트는 영어 이름 + 나라로 (한국어 화면이면 한국어 이름)
  const g = encodeURIComponent(lang === "ko" ? ko : `${en}, South Korea`);
  const global = [
    { id: "trip", label: "Trip.com", href: `https://${TRIP_HOST[lang]}/hotels/list?keyword=${lang === "ko" ? k : encodeURIComponent(en)}`, color: "#287dfa" },
    { id: "booking", label: "Booking.com", href: `https://www.booking.com/searchresults.html?ss=${g}&lang=${BOOKING_LANG[lang]}`, color: "#003b95" },
    { id: "airbnb", label: "Airbnb", href: lang === "ko" ? `https://www.airbnb.co.kr/s/${k}/homes` : `https://www.airbnb.com/s/${g}/homes`, color: "#ff385c" },
  ];
  if (lang !== "ko") return global;
  return [
    { id: "yanolja", label: "놀(야놀자)", href: `https://nol.yanolja.com/discovery/list/search?q=${k}`, color: "#ff3478" },
    { id: "yeogi", label: "여기어때", href: `https://www.yeogi.com/domestic-accommodations?keyword=${k}`, color: "#e3132d" },
    { id: "naver", label: "네이버", href: `https://search.naver.com/search.naver?query=${encodeURIComponent(`${ko} 숙소`)}`, color: "#03c75a" },
    ...global.slice(2),
    ...global.slice(0, 2),
  ];
}

export function StayLinks({ ko, en, lang, t, className = "" }: { ko: string; en: string; lang: Lang; t: T; className?: string }) {
  return (
    <section className={`rounded-3xl border border-gray-100 p-4 ${className}`}>
      <p className="text-sm font-bold">🛏️ {t("근처 숙소 찾기")}</p>
      <p className="mt-0.5 text-xs text-gray-500">{t("‘{name}’ 근처 숙소를 각 예약 사이트에서 바로 검색해요. 가격·예약은 그 사이트에서 확인하세요.", { name: lang === "ko" ? ko : en })}</p>
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {stayLinks(ko, en, lang).map((s) => (
          <li key={s.id}>
            <a
              href={s.href}
              target="_blank"
              rel="noreferrer nofollow"
              className="flex items-center justify-center gap-1.5 rounded-xl bg-gray-50 px-2 py-2.5 text-xs font-semibold text-gray-800 hover:bg-gray-100"
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="truncate">{s.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
