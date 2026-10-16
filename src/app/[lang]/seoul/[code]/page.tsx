import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/i18n/link";
import { LevelBadge } from "@/components/Level";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { pageMeta } from "@/lib/seo";
import { compactNumber } from "@/lib/format";
import { levelOf } from "@/lib/levels";
import { translateNames } from "@/lib/name-translate";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { SEOUL_GROUPS, getSeoulAreaLive, seoulGroup } from "@/lib/seoul-live";

export const revalidate = 600;

export function generateStaticParams() {
  return SEOUL_AREAS.map((a) => ({ code: a.code }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; code: string }> }): Promise<Metadata> {
  const { lang, code } = await params;
  const t = getT(lang);
  const area = SEOUL_AREAS.find((a) => a.code === code);
  if (!area) return {};
  const name = (await translateNames([area.name], lang as Lang)).get(area.name) ?? area.name;
  return pageMeta({
    lang,
    path: `/seoul/${code}`,
    title: t("{name} 실시간 인구·혼잡도", { name }),
    description: t("{name}에 지금 몇 명이 있는지, 앞으로 12시간 혼잡 예측과 성별·연령대 (서울시 실시간 도시데이터)", { name }),
  });
}

export default async function SeoulAreaPage({ params }: { params: Promise<{ lang: string; code: string }> }) {
  const { code } = await params;
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const area = SEOUL_AREAS.find((a) => a.code === code);
  if (!area) notFound();
  const [live, names] = await Promise.all([getSeoulAreaLive(area.code), translateNames([area.name], lang)]);
  const name = names.get(area.name) ?? area.name;
  const group = SEOUL_GROUPS.find((g) => g.id === seoulGroup(area.name))!;
  const level = live && levelOf(live.score);
  const people = (min: number, max: number) => t("{min}~{max}명", { min: compactNumber(min, lang), max: compactNumber(max, lang) });
  const maxAge = live?.profile ? Math.max(...live.profile.ages, 1) : 1;

  return (
    <main className="px-5 pt-4 pb-10 md:px-0 md:pt-8">
      <Link href="/seoul" className="text-sm text-gray-500">
        ← {t("서울 실시간 인구")}
      </Link>
      <p className="mt-3 text-xs font-medium text-gray-500">
        {group.emoji} {t(group.label)} · {t("서울")}
      </p>
      <h1 className="mt-1 text-2xl font-bold md:text-3xl">{name}</h1>

      <div className="mt-4 lg:grid lg:grid-cols-2 lg:gap-8">
        <div>
          {live && level ? (
            <section className="rounded-3xl px-4 py-3.5" style={{ background: `${level.color}14` }}>
              <p className="text-xs font-medium text-gray-500">{t("지금 인구")}</p>
              <p className="text-2xl font-extrabold" style={{ color: level.color }}>
                {people(live.min, live.max)}
              </p>
              <p className="mt-0.5 text-sm text-gray-600">
                {t("서울시 단계")}: <b>{t(live.level)}</b>
              </p>
              {live.message && lang === "ko" && <p className="mt-2 text-xs leading-relaxed text-gray-600">{live.message}</p>}
              <p className="mt-2 text-[11px] text-gray-400">{t("{time} 기준", { time: live.time.slice(11) })}</p>
            </section>
          ) : (
            <p className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">
              {t("지금은 서울시 데이터를 받지 못했어요. 잠시 후 다시 확인해 주세요.")}
            </p>
          )}

          {live?.profile && (
            <section className="mt-4 rounded-3xl border border-gray-100 p-4">
              <h2 className="text-sm font-bold">{t("지금 이곳에 있는 사람들")}</h2>
              <div className="mt-3 flex h-3 overflow-hidden rounded-full">
                <div className="bg-sky-400" style={{ width: `${live.profile.male}%` }} />
                <div className="bg-pink-400" style={{ width: `${live.profile.female}%` }} />
              </div>
              <p className="mt-1 flex justify-between text-xs text-gray-600">
                <span>
                  {t("남성")} {live.profile.male}%
                </span>
                <span>
                  {t("여성")} {live.profile.female}%
                </span>
              </p>
              <ul className="mt-4 flex h-24 items-end gap-1.5">
                {live.profile.ages.map((v, i) => (
                  <li key={i} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] text-gray-500">{Math.round(v)}%</span>
                    <span className="w-full rounded-t bg-indigo-400" style={{ height: `${Math.max(4, (v / maxAge) * 56)}px` }} />
                    <span className="text-[10px] text-gray-500">{i === 0 ? "0-9" : i === 7 ? "70+" : `${i}0s`}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-gray-600">
                {t("이 동네에 사는 사람 {r}% · 다른 곳에서 온 사람 {v}%", {
                  r: Math.round(live.profile.resident),
                  v: Math.round(100 - live.profile.resident),
                })}
              </p>
            </section>
          )}
          <a
            href={`https://map.naver.com/p/search/${encodeURIComponent(area.name)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-sm font-semibold text-indigo-600"
          >
            {t("지도 보기")} ›
          </a>
        </div>

        {live && live.forecast.length > 0 && (
          <section className="mt-6 lg:mt-0">
            <h2 className="text-lg font-bold">{t("앞으로 12시간")}</h2>
            <p className="text-xs text-gray-500">{t("서울시 AI 예측 인구")}</p>
            <ul className="mt-3 divide-y divide-gray-100 rounded-2xl border border-gray-100">
              {live.forecast.map((f) => (
                <li key={f.time} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="w-14 shrink-0 font-semibold">{f.time.slice(11, 16)}</span>
                  <span className="min-w-0 flex-1 text-gray-600">{people(f.min, f.max)}</span>
                  <LevelBadge score={f.score} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <p className="mt-8 text-center text-[11px] text-gray-400">{t("서울시 실시간 도시데이터 (통신사 기지국 기반 추정 인구)")}</p>
    </main>
  );
}
