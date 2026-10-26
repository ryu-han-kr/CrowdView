import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/i18n/link";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { DailyTable, WeekdayHourHeatmap } from "@/components/history/HistoryViews";
import { getDaily } from "@/lib/archive-daily";
import { translateNames } from "@/lib/name-translate";
import { PLACES, placeHref } from "@/lib/places";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { pageMeta } from "@/lib/seo";

// 한 곳의 지난 혼잡 기록: 요일·시간대별 평균(가기 좋은 시간) + 날짜별 띠 (최근 90일)
export const revalidate = 3600;

async function target(kind: string, id: string, lang: Lang) {
  const t = getT(lang);
  if (kind === "place") {
    const p = PLACES.find((x) => x.id === id);
    return p ? { name: t(p.name), live: placeHref(p), unit: p.criteria?.unit } : null;
  }
  if (kind === "seoul") {
    const a = SEOUL_AREAS.find((x) => x.code === id);
    return a ? { name: (await translateNames([a.name], lang)).get(a.name) ?? a.name, live: `/seoul/${a.code}`, unit: undefined } : null;
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; kind: string; id: string }> }): Promise<Metadata> {
  const { lang, kind, id } = await params;
  const t = getT(lang);
  const x = await target(kind, id, lang as Lang);
  if (!x) return {};
  return pageMeta({
    lang,
    path: `/history/${kind}/${id}`,
    title: t("{name} 지난 혼잡 기록", { name: x.name }),
    description: t("{name}의 날짜별 실제 혼잡과 요일·시간대별 평균. 언제 가면 한산했는지 확인하세요.", { name: x.name }),
  });
}

export default async function HistoryDetail({ params }: { params: Promise<{ lang: string; kind: string; id: string }> }) {
  const { kind, id } = await params;
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const x = await target(kind, id, lang);
  if (!x) notFound();
  const rows = await getDaily(kind as "place" | "seoul", id, 90);
  return (
    <main className="px-5 pt-6 pb-10 md:px-0 md:pt-10">
      <Link href="/history" className="text-sm text-gray-500">
        ← {t("지난 혼잡 기록")}
      </Link>
      <h1 className="mt-2 text-2xl font-bold md:text-3xl">{t("{name} 지난 혼잡 기록", { name: x.name })}</h1>
      <p className="mt-1 text-sm text-gray-600">
        {t("5분마다 모은 실제 값이에요.")}{" "}
        <Link href={x.live} className="font-semibold text-indigo-600">
          {t("지금 혼잡도 보기")} ›
        </Link>
      </p>
      {rows.length ? (
        <>
          <WeekdayHourHeatmap rows={rows} lang={lang} t={t} />
          <DailyTable rows={rows} lang={lang} t={t} unit={x.unit} />
        </>
      ) : (
        <p className="mt-6 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">{t("아직 정리된 기록이 없어요. 내일부터 날짜별로 보여요.")}</p>
      )}
    </main>
  );
}
