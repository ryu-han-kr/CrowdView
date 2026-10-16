import { MePanel } from "@/components/MePanel";
import { AccountCard } from "@/components/AccountCard";
import { PlusPanel } from "@/components/PlusPanel";
import { authEnabled } from "@/lib/auth";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { getT as getMetaT } from "@/i18n/server";
import { getAllCrowd } from "@/lib/crowd/service";
import { PLACES } from "@/lib/places";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { LangSwitcher } from "@/components/LangSwitcher";
import { SiteFooter } from "@/components/SiteFooter";
import Link from "@/i18n/link";
import { PLUS } from "@/lib/business";

// ISR: CDN이 60초 동안 같은 HTML을 돌려주고, 만료 후 첫 요청에 백그라운드로 다시 렌더링한다
export const revalidate = 60;



export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = (await params).lang;
  return pageMeta({ lang, path: "/me", title: getMetaT(lang)("마이페이지"), noindex: true });
}

export default async function MePage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const crowd = await getAllCrowd();
  return (
    <main className="px-5 pt-6 md:px-0 md:pt-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold md:text-3xl">{t("마이페이지")}</h1>
        <LangSwitcher compact />
      </div>

      <div className="mt-5">
        <AccountCard enabled={authEnabled} plusSlot={<PlusPanel />} />
      </div>

      <div className="mt-6">
        <MePanel places={PLACES} crowd={crowd} />
      </div>

      <Link href="/pricing" className="mt-10 mb-6 block rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 p-5 text-white">
        <p className="text-xs font-semibold opacity-80">{PLUS.name}</p>
        <p className="mt-1 text-lg font-bold">{t("광고 제거 · 혼잡 알림")}</p>
        <p className="mt-2 text-2xl font-extrabold">{t("월 {n}원", { n: PLUS.priceKrw.toLocaleString() })}</p>
        <p className="mt-1 text-[11px] opacity-80">{t("혼잡도와 예측은 계속 무료예요")} · {t("요금 안내")} ›</p>
      </Link>

      <p className="mb-6 text-center text-[11px] leading-relaxed text-gray-400">
        {t("혼잡도: 서울시, 인천국제공항공사, 한국공항공사, 한국관광공사, 기상청 (공공데이터포털)")}
        <br />
        {t("놀이기구 대기시간: Powered by ThemeParks.wiki · 운영 시간·행사 일정: 한국관광공사 TourAPI")}
        <br />
        {t("장소 사진: 한국관광공사 (공공누리)")}
        {PLACES.filter((p) => p.imageCredit).map((p) => (
          <span key={p.id}>
            <br />
            {t(p.name)}:{" "}
            <a href={p.imageCredit!.url} target="_blank" rel="noreferrer" className="underline">
              {p.imageCredit!.author}, {p.imageCredit!.license}
            </a>{" "}
            (Wikimedia Commons)
          </span>
        ))}
      </p>
      <SiteFooter lang={lang} className="md:hidden" />
    </main>
  );
}
