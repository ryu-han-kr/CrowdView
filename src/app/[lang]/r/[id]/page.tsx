import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/i18n/link";
import { RouteResult } from "@/components/RoutePlanner";
import { CopyRouteButton } from "@/components/CopyRouteButton";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { getSharedRoute } from "@/lib/route-share";

// 공유된 코스 (코스 추천에서 만든 결과를 30일 보관). 혼잡 예측은 만든 시점 기준이라 검색엔진에는 올리지 않는다
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string; id: string }> }): Promise<Metadata> {
  const { lang, id } = await params;
  const t = getT(lang);
  const r = await getSharedRoute(id);
  const names = r?.plan.stops.filter((s) => !s.meal).map((s) => s.name) ?? [];
  return {
    title: t("한산한 코스"),
    description: names.length ? names.join(" → ") : t("붐비는 시간을 피해 도는 코스"),
    robots: { index: false, follow: true },
  };
}

export default async function SharedRoutePage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  const t = getT(lang as Lang);
  const r = await getSharedRoute(id);
  if (!r) notFound();
  return (
    <main className="px-5 pt-6 pb-10 md:px-0 md:pt-10">
      <p className="text-xs font-semibold text-indigo-500">{t("공유된 코스")}</p>
      <h1 className="mt-1 text-2xl font-bold md:text-3xl">{t("한산한 코스")}</h1>
      <p className="mt-1 text-sm text-gray-500">{t("{name}에서 출발 · 혼잡 예측은 코스를 만든 때 기준이에요", { name: r.start.name })}</p>
      <div className="mt-6 max-w-2xl">
        <RouteResult start={r.start} plan={r.plan} locked={r.locked} beta={false} createdOn={r.createdOn} />
        <CopyRouteButton stops={r.plan.stops.filter((s) => !s.meal).map((s) => ({ id: s.id, label: s.name, href: s.href }))} />
        <Link href="/route" className="mt-6 block rounded-2xl bg-indigo-600 py-3.5 text-center text-sm font-bold text-white">
          🧭 {t("나도 한산한 코스 짜기")}
        </Link>
      </div>
    </main>
  );
}
