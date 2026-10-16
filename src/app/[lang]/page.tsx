import Link from "@/i18n/link";
import { DataTag } from "@/components/DataTag";
import { HomeList } from "@/components/HomeList";
import { LevelBadge } from "@/components/Level";
import { PlaceThumb } from "@/components/PlaceRow";
import { getAllCrowd } from "@/lib/crowd/service";
import { festivalHref, getFestivals, isLongRunning } from "@/lib/festivals";
import { translateNames } from "@/lib/name-translate";
import { getLivePlaces } from "@/lib/place-info";
import { placeHref } from "@/lib/places";
import { isEstimated } from "@/lib/format";
import { daysUntil, kst } from "@/lib/time";
import { LangSwitcher } from "@/components/LangSwitcher";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { fmtAge, trRegion } from "@/i18n/patterns";

// ISR: CDN이 60초 동안 같은 HTML을 돌려주고, 만료 후 첫 요청에 백그라운드로 다시 렌더링한다
import { SEOUL_AREAS } from "@/lib/seoul-areas";
export const revalidate = 60;

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const [crowd, places] = await Promise.all([getAllCrowd(), getLivePlaces()]);
  const live = Object.values(crowd).filter((c) => c.source !== "model");
  const newest = live.length ? Math.min(...live.map((c) => c.ageMinutes)) : null;

  const calm = places.filter((p) => crowd[p.id].open && p.category !== "event" && crowd[p.id].score < 40)
    .sort((a, b) => crowd[a.id].score - crowd[b.id].score)
    .slice(0, 3);

  // 다가오는 축제: 한국관광공사·서울시 실제 일정 (진행 중 먼저)
  const festivals = (await getFestivals(30)).filter((f) => !isLongRunning(f)).slice(0, 4);
  const names = await translateNames(festivals.flatMap((f) => [f.title, f.region]), lang);
  const today = kst().date;

  return (
    <main className="px-5 pt-6 pb-4 md:px-0 md:pt-10">
      {/* 모바일: 글자 헤더 그대로 / 태블릿·PC: 파란 배너 (가운데 정렬) */}
      <header className="relative flex items-end justify-between gap-3 md:flex-col md:items-center md:overflow-hidden md:rounded-3xl md:bg-gradient-to-br md:from-indigo-600 md:via-blue-600 md:to-sky-500 md:px-8 md:py-12 md:text-center md:text-white">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 md:justify-center">
            <p className="text-xs font-semibold tracking-wide text-indigo-500 md:text-white/80">CrowdView</p>
            <div className="md:hidden">
              <LangSwitcher compact />
            </div>
          </div>
          <h1 className="mt-1 text-2xl font-bold md:text-4xl">{t("지금 어디가 한산할까?")}</h1>
          <p className="mt-2 hidden text-gray-500 md:block md:text-white/85">{t("공항·놀이공원·명소·축제의 실시간 혼잡도와 AI 예측을 한눈에")}</p>
          <ul className="mt-5 hidden items-center justify-center gap-4 text-sm font-medium text-white/90 md:flex">
            {[
              ["📡", t("공공데이터 실시간")],
              ["📈", t("시간대별 혼잡 예측")],
              ["🌏", t("5개 언어")],
            ].map(([icon, label], i) => (
              <li key={label} className="flex items-center gap-1.5">
                {i > 0 && <span className="mr-2.5 h-3 w-px bg-white/40" />}
                <span>{icon}</span>
                {label}
              </li>
            ))}
          </ul>
        </div>
        {newest !== null && (
          <span className="flex items-center gap-1.5 text-xs text-gray-500 md:absolute md:top-4 md:right-5 md:rounded-full md:bg-white/15 md:px-2.5 md:py-1 md:text-white">
            <span className="relative flex h-2 w-2">
              <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {t("{age} 갱신", { age: fmtAge(newest, t) })}
          </span>
        )}
      </header>

      <HomeList places={places} crowd={crowd}>
        <div className="md:mt-6 md:grid md:grid-cols-2 md:items-start md:gap-6">
        {calm.length > 0 && (
          <section className="mt-4 rounded-3xl bg-emerald-50 p-4">
            <h2 className="font-bold text-emerald-900">🌿 {t("지금 가면 쾌적해요")}</h2>
            <ul className="mt-3 space-y-2">
              {calm.map((p) => (
                <li key={p.id}>
                  <Link href={placeHref(p)} className="flex items-center gap-3 rounded-2xl bg-white p-2.5 active:opacity-70">
                    <PlaceThumb place={p} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{t(p.name)}</span>
                      <span className="block text-xs text-gray-500">{t(p.region)}</span>
                    </span>
                    <span className="flex flex-col items-end">
                      <LevelBadge score={crowd[p.id].score} />
                      {isEstimated(crowd[p.id]) && <DataTag className="mt-0.5" />}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {festivals.length > 0 && (
          <section className="mt-6 md:mt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">🎆 {t("다가오는 축제")}</h2>
              <Link href="/events" className="text-sm text-gray-500">
                {t("전체 보기")} ›
              </Link>
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {festivals.map((f) => (
                <li key={f.id}>
                  <Link href={festivalHref(f)} className="block overflow-hidden rounded-2xl border border-gray-100 active:bg-gray-50">
                    <div className="relative h-20 bg-gray-100">
                      {f.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-3xl">🎪</div>
                      )}
                      <span className="absolute top-1.5 right-1.5 rounded-full bg-gray-900/85 px-2 py-0.5 text-[11px] font-bold text-white">
                        {f.start <= today ? t("진행 중") : `D-${daysUntil(f.start)}`}
                      </span>
                    </div>
                    <div className="p-2.5">
                      <p className="truncate text-sm font-semibold">{names.get(f.title) ?? f.title}</p>
                      <p className="truncate text-xs text-gray-500">
                        {f.start.slice(5).replace("-", "/")} · {names.get(f.region) ?? trRegion(f.region, t)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        </div>
        <Link
          href="/seoul"
          className="mt-6 flex items-center gap-3 rounded-3xl bg-gradient-to-r from-indigo-50 to-sky-50 px-4 py-3.5"
        >
          <span className="text-2xl">📍</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{t("서울 실시간 인구 {n}곳", { n: SEOUL_AREAS.length })}</span>
            <span className="block truncate text-xs text-gray-500">{t("강남역·성수·홍대·한강공원… 지금 몇 명이 있을까?")}</span>
          </span>
          <span className="text-sm font-semibold text-indigo-600">{t("보기")} ›</span>
        </Link>
      </HomeList>
    </main>
  );
}
