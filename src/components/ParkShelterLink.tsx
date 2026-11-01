import { PARK_SHELTERS, SHELTER_RESERVATION_EN_URL, SHELTER_RESERVATION_URL } from "@/lib/park-shelters";

/** 국립공원 대피소 예약 바로 가기. 예약 사이트에 대피소가 있는 공원 화면에만 보인다 */
export function ParkShelterLink({ id, lang, t, className = "" }: { id: string; lang: string; t: (k: string, v?: Record<string, string | number>) => string; className?: string }) {
  const info = PARK_SHELTERS[id];
  if (!info) return null;
  return (
    <section className={`card p-4 ${className}`}>
      <h2 className="text-lg font-bold">{t("산장(대피소) 예약")}</h2>
      <p className="mt-1 text-sm text-gray-600">{t("오래 걷는 종주는 대피소에서 묵어요. 예약은 국립공원공단 예약 사이트에서 해요.")}</p>
      <p lang="ko" className="mt-2 text-sm font-medium text-gray-800">
        {info.shelters.join(" · ")}
      </p>
      <a
        href={lang === "ko" ? SHELTER_RESERVATION_URL : SHELTER_RESERVATION_EN_URL}
        target="_blank"
        rel="noopener"
        className="mt-3 block rounded-2xl bg-gray-900 py-3 text-center text-sm font-bold text-white"
      >
        {t("대피소 예약하러 가기")} ↗
      </a>
      <p className="mt-2 text-xs text-gray-500">{t("예약 사이트에서 '{park}' 탭을 눌러 주세요.", { park: t(info.park) })}</p>
    </section>
  );
}
