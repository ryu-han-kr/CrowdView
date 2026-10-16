import Link from "@/i18n/link";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { getT as getMetaT } from "@/i18n/server";
import { LevelBadge } from "@/components/Level";
import { PlaceThumb } from "@/components/PlaceRow";
import { getParking } from "@/lib/airport";
import { getAllCrowd } from "@/lib/crowd/service";
import { PLACES } from "@/lib/places";
import { headcountInfo } from "@/lib/format";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { fmtAge, fmtMinutes, trZone } from "@/i18n/patterns";

// ISR: CDN이 60초 동안 같은 HTML을 돌려주고, 만료 후 첫 요청에 백그라운드로 다시 렌더링한다
export const revalidate = 60;

const AIRPORTS = PLACES.filter((p) => p.category === "airport");

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = (await params).lang;
  const t = getMetaT(lang);
  return pageMeta({
    lang,
    path: "/airport",
    title: t("공항 혼잡도 · 출국장 대기시간"),
    description: t("인천공항 제1·2터미널, 김포·제주·김해공항의 실시간 출국장 혼잡도와 대기시간, 주차장 빈자리"),
  });
}

export default async function AirportListPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const [crowd, parking] = await Promise.all([getAllCrowd(), Promise.all(AIRPORTS.map(getParking))]);

  return (
    <main className="px-5 pt-6 md:px-0 md:pt-10">
      <h1 className="text-2xl font-bold md:text-3xl">{t("공항 혼잡도")}</h1>
      <p className="mt-1 text-sm text-gray-500">{t("출국장 대기·보안검색 구간·주차장까지 한눈에")}</p>

      <ul className="mt-5 space-y-3 md:grid md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] md:gap-4 md:space-y-0">
        {AIRPORTS.map((place, i) => {
          const c = crowd[place.id];
          const busiestZone = c.zones?.reduce((a, b) => (b.score > a.score ? b : a));
          const lots = parking[i];
          const fullLots = lots.filter((l) => l.rate >= 90).length;
          const freeSpaces = lots.reduce((sum, l) => sum + Math.max(0, l.total - l.occupied), 0);
          return (
            <li key={place.id} className="flex flex-col overflow-hidden rounded-3xl border border-gray-100">
              <Link href={`/airport/${place.id}`} className="block flex-1 p-4 active:bg-gray-50">
                <div className="flex items-center gap-3">
                  <PlaceThumb place={place} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{t(place.name)}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {c.source === "model" ? t("예측값") : t("{age} 실측", { age: fmtAge(c.ageMinutes, t) })}
                      {headcountInfo(c, { t, lang }) && !headcountInfo(c, { t, lang })!.kind && ` · ${headcountInfo(c, { t, lang })!.text}`}
                    </p>
                  </div>
                  <LevelBadge score={c.score} closed={!c.open} />
                </div>
                {busiestZone && (
                  <p className="mt-3 rounded-2xl bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
                    {t("가장 붐비는 곳")} <b>{trZone(busiestZone.label, t)}</b>
                    {busiestZone.waitMin !== undefined && ` · ${t("대기")} ${fmtMinutes(busiestZone.waitMin, t)}`}
                  </p>
                )}
              </Link>
              {/* 주차장 바로가기: 공항 상세의 주차 탭으로 */}
              {lots.length > 0 && (
                <Link
                  href={`/airport/${place.id}?tab=parking`}
                  className="flex items-center gap-2 border-t border-gray-100 bg-sky-50/60 px-4 py-3 text-sm hover:bg-sky-50 active:bg-sky-100"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-600 text-xs font-extrabold text-white">P</span>
                  <span className="flex-1">
                    <b>{t("주차장")}</b> {t("빈자리")} <b className="text-sky-700">{t("{n}면", { n: freeSpaces.toLocaleString() })}</b>
                    {fullLots > 0 && <span className="text-red-500"> · {t("{n}곳 만차 임박", { n: fullLots })}</span>}
                  </span>
                  <span className="text-gray-400">›</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-4 mb-6 text-center text-[11px] text-gray-400">
        {t("출처: 인천국제공항공사, 한국공항공사 (공공데이터포털)")}
      </p>
    </main>
  );
}
