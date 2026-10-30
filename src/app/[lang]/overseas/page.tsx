import type { Metadata } from "next";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { fmtMinutes } from "@/i18n/patterns";
import { inkOf } from "@/lib/levels";
import { allParksNow, type ParkNow } from "@/lib/overseas-parks";
import { pageMeta } from "@/lib/seo";

// 해외 테마파크 지금 대기시간 (경수님 10/30). ThemeParks.wiki 대기시간이 5분마다라 ISR도 5분
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = (await params).lang;
  const t = getT(lang as Lang);
  return pageMeta({
    lang,
    path: "/overseas",
    title: t("해외 테마파크 지금 혼잡도 · 놀이기구 대기시간"),
    description: t("도쿄 디즈니랜드·디즈니씨, 유니버설 스튜디오 재팬, 상하이·홍콩 디즈니랜드의 지금 평균 대기시간과 혼잡도"),
  });
}

/** 현지 시각 HH:mm (공원 시간대) */
const clock = (iso: string, tz: string | undefined, lang: Lang) =>
  new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz ?? "Asia/Seoul" }).format(new Date(iso));

function ParkCard({ p, lang, t }: { p: ParkNow; lang: Lang; t: ReturnType<typeof getT> }) {
  const lv = p.open !== false ? p.level : undefined;
  return (
    <li className="rounded-3xl border border-gray-100 p-4" style={lv ? { background: `${lv.color}14` } : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[17px] font-bold">
            <span aria-hidden>{p.park.flag}</span> {t(p.park.name)}
          </p>
          <p className="text-xs text-gray-600">
            {t(p.park.city)}
            {p.hours && ` · ${t("운영 {from}~{to} (현지)", { from: clock(p.hours.open, p.timezone, lang), to: clock(p.hours.close, p.timezone, lang) })}`}
          </p>
        </div>
        {p.open === false ? (
          <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">{t("운영 종료")}</span>
        ) : lv ? (
          <span className="shrink-0 text-2xl font-black" style={{ color: inkOf(lv.color) }}>
            {t(lv.label)}
          </span>
        ) : (
          <span className="shrink-0 text-xs text-gray-600">{t("대기시간 정보 없음")}</span>
        )}
      </div>
      {p.open !== false && p.avgWait !== undefined && (
        <>
          <p className="mt-2 text-sm">
            {t("놀이기구 평균 대기")} <b>{fmtMinutes(p.avgWait, t)}</b>
            <span className="text-gray-600"> · {t("운영 중 {n}개 기준", { n: p.rides })}</span>
          </p>
          <ul className="mt-2 space-y-1 text-[13px]">
            {p.top.map((r) => (
              <li key={r.name} className="flex justify-between gap-3">
                <span className="min-w-0 truncate text-gray-700">{r.name}</span>
                <b className="shrink-0 tabular-nums">{fmtMinutes(r.wait, t)}</b>
              </li>
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

export default async function OverseasPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const parks = await allParksNow();
  // 운영 중인 곳을 위로, 그 안에서는 한산한 순
  const sorted = [...parks].sort((a, b) => Number(b.open !== false) - Number(a.open !== false) || (a.avgWait ?? 999) - (b.avgWait ?? 999));
  return (
    <main className="px-5 pt-6 pb-8 md:px-0 md:pt-10">
      <h1 className="text-2xl font-bold md:text-3xl">{t("해외 테마파크 지금 혼잡도")}</h1>
      <p className="mt-1 text-sm text-gray-600">{t("운영 중인 놀이기구의 평균 대기시간으로 매겨요. 5분마다 갱신돼요.")}</p>
      <ul className="mt-5 space-y-3 md:grid md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] md:gap-4 md:space-y-0">
        {sorted.map((p) => (
          <ParkCard key={p.park.id} p={p} lang={lang} t={t} />
        ))}
      </ul>
      <p className="mt-4 text-xs text-gray-600">
        {t("대기시간")}:{" "}
        <a href="https://themeparks.wiki" target="_blank" rel="noreferrer" className="underline">
          Powered by ThemeParks.wiki
        </a>
      </p>
    </main>
  );
}
