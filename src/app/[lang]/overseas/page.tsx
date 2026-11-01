import type { Metadata } from "next";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { fmtMinutes } from "@/i18n/patterns";
import { inkOf } from "@/lib/levels";
import { allParksNow, OVERSEAS_PARKS, type ParkNow } from "@/lib/overseas-parks";
import { pageMeta } from "@/lib/seo";
import { PageHeader } from "@/components/PageHeader";

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
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t(p.park.name))}`}
            target="_blank"
            rel="noreferrer"
            className="-my-1 inline-block py-1 text-xs font-semibold text-indigo-700"
          >
            {t("Google 지도 ↗")}
          </a>
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
  // 11/1 경수님 '나라별로': 나라 칩(누르면 그 구역으로) + 나라별 구역. 나라 순서는 목록에 처음 나온 순
  const countries = [...new Set(OVERSEAS_PARKS.map((p) => p.country))].map((c) => ({
    name: c,
    flag: OVERSEAS_PARKS.find((p) => p.country === c)!.flag,
    id: `c-${OVERSEAS_PARKS.find((p) => p.country === c)!.id}`,
    parks: sorted.filter((p) => p.park.country === c),
  }));
  return (
    <main className="px-5 pt-6 pb-8 md:px-0 md:pt-10">
      {/* 11/1 UX 점검: 홈 아이콘으로 오는 화면 — 다른 탭과 같은 PageHeader 머리로 */}
      <PageHeader title={t("해외 테마파크 지금 혼잡도")}>
        <p className="mt-1 text-gray-500">{t("놀이기구 평균 대기시간 · 5분마다 갱신")}</p>
      </PageHeader>
      <nav className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0">
        {countries.map((c) => (
          <a key={c.id} href={`#${c.id}`} className="shrink-0 rounded-full bg-gray-100 px-3.5 py-1.5 text-sm font-semibold text-gray-700">
            <span aria-hidden>{c.flag}</span> {t(c.name)} <span className="text-gray-500">{c.parks.length}</span>
          </a>
        ))}
      </nav>
      {countries.map((c) => (
        <section key={c.id} id={c.id} className="mt-7 scroll-mt-20">
          <h2 className="text-lg font-bold">
            <span aria-hidden>{c.flag}</span> {t(c.name)}
          </h2>
          <ul className="mt-3 space-y-3 md:grid md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] md:gap-4 md:space-y-0">
            {c.parks.map((p) => (
              <ParkCard key={p.park.id} p={p} lang={lang} t={t} />
            ))}
          </ul>
        </section>
      ))}
      <p className="mt-4 text-xs text-gray-600">
        {t("대기시간")}:{" "}
        <a href="https://themeparks.wiki" target="_blank" rel="noreferrer" className="underline">
          Powered by ThemeParks.wiki
        </a>
      </p>
    </main>
  );
}
