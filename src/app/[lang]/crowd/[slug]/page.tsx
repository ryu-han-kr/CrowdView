import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/i18n/link";
import type { Lang } from "@/i18n/config";
import { formatHour } from "@/i18n/translate";
import { getT } from "@/i18n/server";
import { InlineAd } from "@/components/AdUnit";
import { CrowdMascot } from "@/components/place/CrowdMascot";
import { WeekdayHourHeatmap, dowName } from "@/components/history/HistoryViews";
import { StayLinks, TourLinks, searchName } from "@/components/StayLinks";
import { getDaily, type DailyRow } from "@/lib/archive-daily";
import { categoryCharacter } from "@/lib/characters";
import { getAllCrowd } from "@/lib/crowd/service";
import { CROWD_PAGES } from "@/lib/crowd-pages";
import { distanceKm } from "@/lib/geo";
import { inkOf, levelOf } from "@/lib/levels";
import { translateNames } from "@/lib/name-translate";
import { PLACES, placeHref } from "@/lib/places";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { getSeoulAreaLive } from "@/lib/seoul-live";
import { SITE, breadcrumbLd, jsonLd, pageMeta } from "@/lib/seo";
import { kst } from "@/lib/time";

// 질문형 검색 페이지 (사용자 10/26 차별화 전략 1번: "Is Myeongdong crowded right now?" "best time to visit Lotte World").
// 장소·서울 지역 상세와 겹치지 않게 '지금 붐비나 → 오늘 언제 한산 → 쌓인 기록으로 본 가기 좋은 때 → 자주 묻는 질문'으로 답 중심.
// 숫자와 기준 시각을 문장에 그대로 넣어 AI 검색이 인용하기 쉽게 (GEO). 10분마다 다시 만든다
export const revalidate = 600;

type Hour = { hour: number; score: number };
interface Answer {
  name: string;
  score: number;
  open: boolean;
  /** 사람 수 문장용 (예: 8,000–10,000) */
  people?: string;
  time?: string;
  /** 지금부터 오늘 남은 시간대 예상 */
  upcoming: Hour[];
  live: string;
  history: string;
  lat: number;
  lng: number;
  ko: string;
  en: string;
  character: ReturnType<typeof categoryCharacter>;
  isPlace: boolean;
  unit?: string;
}

async function load(slug: string, lang: Lang): Promise<Answer | null> {
  const page = CROWD_PAGES.find((p) => p.slug === slug);
  if (!page) return null;
  const t = getT(lang);
  const en = getT("en");
  const nowH = Math.floor(kst().hour);
  if (page.kind === "place") {
    const p = PLACES.find((x) => x.id === page.id);
    if (!p) return null;
    const c = (await getAllCrowd().catch(() => ({})) as Awaited<ReturnType<typeof getAllCrowd>>)[p.id];
    const range = c?.area?.range ?? c?.headcountRange;
    return {
      name: t(p.name),
      score: c?.score ?? 0,
      open: !!c?.open,
      people: range ? `${range[0].toLocaleString(lang)}–${range[1].toLocaleString(lang)}` : c?.headcount ? c.headcount.toLocaleString(lang) : undefined,
      time: c?.observedAt?.slice(11) ?? (c ? new Date(Date.parse(c.updatedAt) + 9 * 3600_000).toISOString().slice(11, 16) : undefined),
      upcoming: (c?.hourly ?? []).filter((h) => h.hour >= nowH && h.hour >= p.hours[0] && h.hour < Math.min(24, p.hours[1])).map((h) => ({ hour: h.hour, score: h.score })),
      live: placeHref(p),
      history: `/history/place/${p.id}`,
      lat: p.lat,
      lng: p.lng,
      ko: p.name,
      en: en(p.name),
      character: categoryCharacter(p.category),
      isPlace: true,
      unit: p.criteria?.unit,
    };
  }
  const a = SEOUL_AREAS.find((x) => x.code === page.id);
  if (!a) return null;
  const [live, names] = await Promise.all([getSeoulAreaLive(a.code).catch(() => undefined), translateNames([a.name], lang)]);
  return {
    // 검색하는 이름은 '명동'·'Myeongdong'이라 관광특구 꼬리는 뗀다
    name: searchName(lang === "ko" ? a.name : lang === "en" ? page.en : (names.get(a.name) ?? page.en)),
    score: live?.score ?? 0,
    open: !!live,
    people: live ? `${live.min.toLocaleString(lang)}–${live.max.toLocaleString(lang)}` : undefined,
    time: live?.time.slice(11),
    upcoming: (live?.forecast ?? []).map((f) => ({ hour: Number(f.time.slice(11, 13)), score: f.score })).filter((h) => h.hour >= 6),
    live: `/seoul/${a.code}`,
    history: `/history/seoul/${a.code}`,
    lat: a.lat,
    lng: a.lng,
    ko: a.name,
    en: page.en,
    character: "otter",
    isPlace: false,
  };
}

/** 쌓인 기록으로 본 요일×시간 가장 한산·붐빔 (칸마다 2일 이상) + 요일 평균 */
function bestTimes(rows: DailyRow[]) {
  const sum = Array.from({ length: 7 }, () => Array(24).fill(0));
  const n = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const r of rows)
    r.hourly?.forEach((v, h) => {
      if (v < 0) return;
      const w = new Date(`${r.date}T00:00:00Z`).getUTCDay();
      sum[w][h] += v;
      n[w][h]++;
    });
  const cells: { w: number; h: number; s: number }[] = [];
  for (let w = 0; w < 7; w++) for (let h = 8; h < 23; h++) if (n[w][h] >= 1) cells.push({ w, h, s: sum[w][h] / n[w][h] });
  if (cells.length < 10) return null;
  const calm = cells.reduce((a, b) => (b.s < a.s ? b : a));
  const busy = cells.reduce((a, b) => (b.s > a.s ? b : a));
  const dayAvg = Array.from({ length: 7 }, (_, w) => {
    const xs = cells.filter((c) => c.w === w);
    return xs.length ? xs.reduce((s, c) => s + c.s, 0) / xs.length : NaN;
  });
  const valid = dayAvg.map((v, w) => ({ v, w })).filter((x) => !Number.isNaN(x.v));
  const calmDay = valid.reduce((a, b) => (b.v < a.v ? b : a));
  const busyDay = valid.reduce((a, b) => (b.v > a.v ? b : a));
  return { calm, busy, calmDay: calmDay.w, busyDay: busyDay.w, days: rows.length };
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }): Promise<Metadata> {
  const { lang, slug } = await params;
  const t = getT(lang);
  const a = await load(slug, lang as Lang);
  if (!a) return {};
  const lv = levelOf(a.score);
  return pageMeta({
    lang,
    path: `/crowd/${slug}`,
    title: t("{name} 지금 붐비나요? 실시간 혼잡도와 한산한 시간", { name: a.name }),
    description: a.open
      ? t("{name} 혼잡도는 {time} 기준 ‘{level}’이에요. 오늘 시간대별 예상과 요일·시간대별 실제 기록으로 본 가장 한산한 때를 알려 드려요.", {
          name: a.name,
          time: a.time ?? "",
          level: t(lv.label),
        })
      : t("{name}의 실시간 혼잡도, 오늘 시간대별 예상, 요일·시간대별 실제 기록으로 본 가장 한산한 때.", { name: a.name }),
  });
}

export default async function CrowdQuestionPage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { slug } = await params;
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const a = await load(slug, lang);
  if (!a) notFound();
  const page = CROWD_PAGES.find((p) => p.slug === slug)!;
  const rows = await getDaily(page.kind, page.id, 90);
  const best = bestTimes(rows);
  const lv = levelOf(a.score);
  const verdict = !a.open
    ? a.isPlace
      ? t("지금은 운영 시간이 아니에요.")
      : t("지금은 서울시 자료를 받지 못했어요.")
    : lv.key >= 4
      ? t("네, 지금 붐벼요.")
      : lv.key === 3
        ? t("보통이에요. 붐비는 편은 아니에요.")
        : t("아니요, 지금 한산해요.");
  const calmToday = a.upcoming.length ? a.upcoming.reduce((x, y) => (y.score < x.score ? y : x)) : undefined;
  const busyToday = a.upcoming.length ? a.upcoming.reduce((x, y) => (y.score > x.score ? y : x)) : undefined;

  // 자주 묻는 질문: 화면 문장과 같은 내용을 구조화 데이터로도 (검색 결과·AI 답변에 그대로 인용되게)
  const faq: { q: string; a: string }[] = [
    {
      q: t("{name} 지금 붐비나요?", { name: a.name }),
      a: a.open
        ? `${verdict} ${t("{time} 기준 ‘{level}’", { time: a.time ?? "", level: t(lv.label) })}${a.people ? ` · ${t("약 {n}명", { n: a.people })}` : ""}.`
        : verdict,
    },
    ...(best
      ? [
          {
            q: t("{name}, 언제 가면 한산한가요?", { name: a.name }),
            a: t("지금까지 {days}일 기록으로는 {day} {hour}쯤이 가장 한산했고, 요일로는 {calmDay}요일이 가장 여유로웠어요.", {
              days: best.days,
              day: dowName(best.calm.w, lang),
              hour: formatHour(best.calm.h, lang),
              calmDay: dowName(best.calmDay, lang),
            }),
          },
          {
            q: t("{name}, 가장 붐비는 때는 언제인가요?", { name: a.name }),
            a: t("기록상 {day} {hour}쯤이 가장 붐볐고, 요일로는 {busyDay}요일이 가장 붐볐어요.", {
              day: dowName(best.busy.w, lang),
              hour: formatHour(best.busy.h, lang),
              busyDay: dowName(best.busyDay, lang),
            }),
          },
        ]
      : calmToday
        ? [
            {
              q: t("{name}, 언제 가면 한산한가요?", { name: a.name }),
              a: t("오늘은 {hour}쯤이 가장 한산할 것으로 예상돼요. 날짜별 기록이 더 쌓이면 요일·시간대별로 알려 드려요.", { hour: formatHour(calmToday.hour, lang) }),
            },
          ]
        : []),
    {
      q: t("혼잡도는 어떻게 재나요?", {}),
      a: a.isPlace
        ? t("공식 실시간 자료(서울시 실시간 인구·공항 출국장 대기·놀이기구 대기 등)가 있으면 그것으로, 없으면 요일·시간·날씨·공휴일 패턴 모델로 추정해 5단계(한산~매우 혼잡)로 보여 줘요. 10분마다 갱신해요.")
        : t("서울시 실시간 도시데이터(통신 기반 실시간 인구)를 5분마다 받아 5단계로 보여 줘요. 인원은 서울시가 주는 범위예요."),
    },
  ];

  const nearby = CROWD_PAGES.filter((p) => p.slug !== slug)
    .map((p) => {
      const pos = p.kind === "place" ? PLACES.find((x) => x.id === p.id) : SEOUL_AREAS.find((x) => x.code === p.id);
      return pos ? { p, d: distanceKm(pos, a) } : null;
    })
    .filter((x): x is { p: (typeof CROWD_PAGES)[number]; d: number } => !!x && x.d < 30)
    .sort((x, y) => x.d - y.d)
    .slice(0, 6);
  const nearbyNames = await translateNames(
    nearby.map(({ p }) => (p.kind === "place" ? undefined : SEOUL_AREAS.find((x) => x.code === p.id)?.name)),
    lang,
  );
  const nameOf = (p: (typeof CROWD_PAGES)[number]) => {
    if (p.kind === "place") return t(PLACES.find((x) => x.id === p.id)!.name);
    const ko = SEOUL_AREAS.find((x) => x.code === p.id)!.name;
    return lang === "ko" ? ko : lang === "en" ? p.en : (nearbyNames.get(ko) ?? p.en);
  };

  return (
    <main className="px-5 pt-6 pb-10 md:px-0 md:pt-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            },
            {
              "@context": "https://schema.org",
              "@type": "TouristAttraction",
              name: a.name,
              alternateName: [a.ko, a.en].filter((x) => x !== a.name),
              url: `${SITE}${lang === "ko" ? "" : `/${lang}`}${a.live}`,
              geo: { "@type": "GeoCoordinates", latitude: a.lat, longitude: a.lng },
              address: { "@type": "PostalAddress", addressCountry: "KR" },
            },
            breadcrumbLd(lang, [
              { name: "CrowdView", path: "/" },
              { name: t("지금 붐비나요?"), path: "/crowd" },
              { name: a.name, path: `/crowd/${slug}` },
            ]),
          ]),
        }}
      />
      <Link href="/crowd" className="text-sm text-gray-500">
        ← {t("지금 붐비나요?")}
      </Link>
      <h1 className="mt-2 text-2xl leading-tight font-extrabold md:text-3xl">{t("{name} 지금 붐비나요?", { name: a.name })}</h1>

      {/* 답부터: 지금 단계·인원·기준 시각 */}
      <section className="mascot-host mt-4 rounded-3xl px-4 py-4" style={{ background: `${a.open ? lv.color : "#6b7280"}24` }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[22px] leading-snug font-extrabold" style={{ color: a.open ? inkOf(lv.color) : undefined }}>
              {verdict}
            </p>
            {a.open && a.people && <p className="mt-1 text-[17px] font-semibold text-gray-900">{t("약 {n}명", { n: a.people })}</p>}
            {a.time && <p className="mt-1 text-sm text-gray-600">{t("{time} 기준 (한국 시간) · 10분마다 갱신", { time: a.time })}</p>}
          </div>
          <CrowdMascot score={a.score} closed={!a.open} character={a.character} size={96} className="-my-1 shrink-0" />
        </div>
        <Link href={a.live} className="mt-3 inline-block text-sm font-semibold text-indigo-700">
          {t("실시간 상세 보기")} ›
        </Link>
      </section>

      {/* 오늘 남은 시간 */}
      {a.upcoming.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-bold">{t("오늘 시간대별 예상")}</h2>
          {calmToday && busyToday && (
            <p className="mt-1 text-[15px] text-gray-700">
              {t("오늘은 {calm}쯤이 가장 한산하고, {busy}쯤이 가장 붐빌 것으로 예상돼요.", {
                calm: formatHour(calmToday.hour, lang),
                busy: formatHour(busyToday.hour, lang),
              })}
            </p>
          )}
          <ul className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1" tabIndex={0} aria-label={t("오늘 시간대별 예상")}>
            {a.upcoming.map((h) => {
              const l = levelOf(h.score);
              return (
                <li key={h.hour} className="min-w-14 shrink-0 rounded-xl px-2 py-2 text-center" style={{ background: `${l.color}26` }}>
                  <span className="block text-xs text-gray-600">{formatHour(h.hour, lang)}</span>
                  <span className="block text-[13px] font-bold" style={{ color: inkOf(l.color) }}>
                    {t(l.label)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 쌓인 기록으로 본 가기 좋은 때 */}
      <section className="mt-6">
        <h2 className="text-lg font-bold">{t("{name} 가기 좋은 때", { name: a.name })}</h2>
        {best ? (
          <ul className="mt-2 space-y-1.5 text-[15px]">
            <li>
              ✅ {t("가장 한산했던 때")}: <b>{dowName(best.calm.w, lang)} {formatHour(best.calm.h, lang)}</b> ({t(levelOf(best.calm.s).label)})
            </li>
            <li>
              ⚠️ {t("가장 붐빈 때")}: <b>{dowName(best.busy.w, lang)} {formatHour(best.busy.h, lang)}</b> ({t(levelOf(best.busy.s).label)})
            </li>
            <li className="text-sm text-gray-500">{t("최근 {n}일 실제 기록 기준", { n: best.days })}</li>
          </ul>
        ) : (
          <p className="mt-1 text-sm text-gray-600">{t("날짜별 기록이 쌓이는 중이에요. 며칠 뒤부터 요일·시간대별로 알려 드려요.")}</p>
        )}
        {rows.length > 0 && <WeekdayHourHeatmap rows={rows} lang={lang} t={t} />}
        <Link href={a.history} className="mt-2 inline-block text-sm font-semibold text-indigo-600">
          {t("지난 날짜 실제 기록 보기")} ›
        </Link>
      </section>

      {/* 예약: 투어·입장권(장소만)·숙소 */}
      {a.isPlace && <TourLinks ko={a.ko} en={a.en} lang={lang} t={t} className="mt-6" />}
      <StayLinks ko={a.ko} en={a.en} lang={lang} t={t} at={a} className="mt-4" />

      <section className="mt-8">
        <h2 className="text-lg font-bold">{t("자주 묻는 질문")}</h2>
        <dl className="mt-2 divide-y divide-gray-100 rounded-2xl border border-gray-100">
          {faq.map((f) => (
            <div key={f.q} className="px-4 py-3">
              <dt className="font-semibold">{f.q}</dt>
              <dd className="mt-1 text-[15px] leading-relaxed text-gray-700">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {nearby.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold">{t("근처도 지금 붐비는지 보기")}</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {nearby.map(({ p }) => (
              <li key={p.slug}>
                <Link href={`/crowd/${p.slug}`} className="inline-block rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold">
                  {nameOf(p)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <InlineAd className="mt-8" />
    </main>
  );
}
