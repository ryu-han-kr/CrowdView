import type { Metadata } from "next";
import Link from "@/i18n/link";
import type { Lang } from "@/i18n/config";
import { HORIZONS, MIN_PICK_N, getAccuracy, getMethod24, type DayStat } from "@/lib/accuracy";
import { pageMeta } from "@/lib/seo";
import { getCalibrationStats } from "@/lib/crowd/calibration";
import { PLACES } from "@/lib/places";
import { getT } from "@/i18n/server";

// 예측 정확도 공개: 서울 121곳에서 매시간 예측과 실제를 비교한 결과 (lib/accuracy, 수집기가 기록)
export const revalidate = 3600;

const COPY = {
  ko: {
    title: "예측 정확도",
    lead: "서울 실시간 121곳에서 매시간 예측을 저장해 두고, 그 시각이 되면 서울시 실제 값과 비교해요. ‘단계 일치’는 화면의 5단계가 맞은 비율, ‘평균 오차’는 0~100점 기준 점수 차이예요.",
    horizon: {
      "official-1h": "서울시 공식 예측 · 1시간 뒤",
      "official-3h": "서울시 공식 예측 · 3시간 뒤",
      "pattern-24h": "CrowdView 패턴 예측 · 24시간 뒤",
      "naive-24h": "기준선 · 지금 값 그대로 24시간 뒤",
      "median-24h": "기준선 · 최근 4주 같은 요일·시각 중앙값",
      "weekly-24h": "기준선 · 지난주 같은 요일·시각",
      "hybrid-24h": "CrowdView 혼합 · 같은 종류의 날이면 지금 값, 평일↔주말이 바뀌면 지난주 같은 시각",
    },
    week: "최근 7일",
    using:
      "지금 24시간 뒤 예측(한산한 코스의 내일·주말 점수)에 쓰는 방법: {m}. 기준선·혼합 방법이 최근 7일 단계 일치와 평균 오차를 둘 다 패턴 예측보다 잘 맞출 때만(비교 수 {n} 이상) 자동으로 바꿔요.",
    match: "단계 일치",
    err: "평균 오차",
    n: "비교 수",
    date: "날짜",
    empty: "2026-10-17부터 기록을 시작했어요. 몇 시간 뒤부터 숫자가 쌓여요.",
    method: "계산 방식 보기",
    pts: "점",
    model: "장소별 CrowdView 모델 · 실측과 비교 (최근 7일)",
    modelLead:
      "실측이 들어오는 장소(서울 지역·놀이공원 대기·공항)에서 매시간 ‘모델만으로 냈을 점수’와 실제를 비교하고, 평일/주말 × 시간대별로 차이를 배워 예측을 고쳐요. 배운 보정은 실측이 없는 같은 종류 장소에도 절반만 써요.",
    place: "장소",
    raw: "보정 전 오차",
    cal: "보정 후 오차",
    bias: "모델 치우침",
    modelEmpty: "2026-10-21부터 기록을 시작했어요. 몇 시간 뒤부터 숫자가 쌓여요.",
  },
  en: {
    title: "Forecast accuracy",
    lead: "Every hour we store forecasts for 121 Seoul areas and compare them with Seoul's actual values when that hour arrives. ‘Level match’ is the share of correct five-level predictions; ‘mean error’ is the score difference on a 0–100 scale.",
    horizon: {
      "official-1h": "Seoul official forecast · 1 h ahead",
      "official-3h": "Seoul official forecast · 3 h ahead",
      "pattern-24h": "CrowdView pattern forecast · 24 h ahead",
      "naive-24h": "Baseline · current value carried 24 h ahead",
      "median-24h": "Baseline · median of the same weekday and hour, last 4 weeks",
      "weekly-24h": "Baseline · same weekday and hour last week",
      "hybrid-24h": "CrowdView blend · current value if tomorrow is the same kind of day, last week's same hour when weekday↔weekend changes",
    },
    week: "Last 7 days",
    using:
      "Method currently used for 24-hour-ahead forecasts (tomorrow/weekend scores in quiet routes): {m}. A baseline or blend replaces the pattern forecast only when it beats it on both level match and mean error over the last 7 days (at least {n} comparisons).",
    match: "Level match",
    err: "Mean error",
    n: "Comparisons",
    date: "Date",
    empty: "Tracking started on 2026-10-17. Numbers appear after a few hours.",
    method: "How it is calculated",
    pts: "pt",
    model: "CrowdView model vs. measured, by place (last 7 days)",
    modelLead:
      "Where live measurements exist (Seoul areas, theme park waits, airports), every hour we compare what the model alone would have said with the actual value, learn the gap by weekday/weekend × hour, and correct the forecast. Places of the same kind without live data get half of that correction.",
    place: "Place",
    raw: "Error before",
    cal: "Error after",
    bias: "Model bias",
    modelEmpty: "Tracking started on 2026-10-21. Numbers appear after a few hours.",
  },
};

const sum = (stats: (DayStat | null)[]): DayStat =>
  stats.reduce<DayStat>((a, s) => (s ? { n: a.n + s.n, match: a.match + s.match, absErr: a.absErr + s.absErr } : a), { n: 0, match: 0, absErr: 0 });
const pct = (s: DayStat) => (s.n ? `${Math.round((s.match / s.n) * 100)}%` : "–");

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  const c = lang === "ko" ? COPY.ko : COPY.en;
  return pageMeta({ lang, path: "/accuracy", title: c.title, description: c.lead });
}

export default async function AccuracyPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const c = lang === "ko" ? COPY.ko : COPY.en;
  const [rows, calib, { method }] = await Promise.all([getAccuracy(14), getCalibrationStats(7), getMethod24()]);
  const t = getT(lang);
  const calibRows = PLACES.filter((p) => calib[p.id]?.n).map((p) => ({ place: p, s: calib[p.id] }));
  const avg = (v: number, n: number) => `${(v / n).toFixed(1)}${c.pts}`;
  const any = rows.some((r) => HORIZONS.some((h) => r.stats[h.id]?.n));
  const err = (s: DayStat) => (s.n ? `${(s.absErr / s.n).toFixed(1)}${c.pts}` : "–");

  return (
    <main className="px-5 pt-6 pb-10 md:px-0 md:pt-10">
      <h1 className="text-2xl font-bold md:text-3xl">{c.title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">{c.lead}</p>

      <h2 className="mt-8 text-lg font-bold">{c.week}</h2>
      <ul className="mt-3 grid gap-3 md:grid-cols-3">
        {HORIZONS.map((h) => {
          const s = sum(rows.slice(0, 7).map((r) => r.stats[h.id]));
          return (
            <li key={h.id} className="rounded-2xl border border-gray-100 bg-white p-4">
              <p className="text-xs font-semibold text-gray-500">{c.horizon[h.id]}</p>
              <p className="mt-1 text-3xl font-extrabold text-indigo-600">{pct(s)}</p>
              <p className="text-xs text-gray-500">
                {c.match} · {c.err} {err(s)} · {c.n} {s.n.toLocaleString()}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 max-w-3xl text-xs leading-relaxed text-gray-600">
        {c.using.replace("{m}", c.horizon[method]).replace("{n}", MIN_PICK_N.toLocaleString())}
      </p>

      {any ? (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-gray-100 bg-white">
          <table className="w-full min-w-[560px] text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2">{c.date}</th>
                {HORIZONS.map((h) => (
                  <th key={h.id} className="px-3 py-2">
                    {c.horizon[h.id]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) => HORIZONS.some((h) => r.stats[h.id]?.n))
                .map((r) => (
                  <tr key={r.date} className="border-t border-gray-100">
                    <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                    {HORIZONS.map((h) => {
                      const s = r.stats[h.id];
                      return (
                        <td key={h.id} className="px-3 py-2">
                          {s?.n ? (
                            <>
                              <b>{pct(s)}</b>{" "}
                              <span className="text-xs text-gray-500">
                                · {err(s)} · {s.n}
                              </span>
                            </>
                          ) : (
                            "–"
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-8 empty-note p-5">{c.empty}</p>
      )}
      <h2 className="mt-10 text-lg font-bold">{c.model}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">{c.modelLead}</p>
      {calibRows.length ? (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-100 bg-white">
          <table className="w-full min-w-[560px] text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2">{c.place}</th>
                <th className="px-3 py-2">{c.raw}</th>
                <th className="px-3 py-2">{c.cal}</th>
                <th className="px-3 py-2">{c.bias}</th>
                <th className="px-3 py-2">{c.n}</th>
              </tr>
            </thead>
            <tbody>
              {calibRows.map(({ place, s }) => (
                <tr key={place.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 whitespace-nowrap">{t(place.name)}</td>
                  <td className="px-3 py-2">{avg(s.raw, s.n)}</td>
                  <td className="px-3 py-2">
                    <b>{avg(s.cal, s.n)}</b>
                  </td>
                  <td className="px-3 py-2">{`${s.bias >= 0 ? "+" : ""}${avg(s.bias, s.n)}`}</td>
                  <td className="px-3 py-2">{s.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 empty-note p-5">{c.modelEmpty}</p>
      )}
      <Link href="/methodology" className="mt-6 inline-block text-sm font-semibold text-indigo-600">
        {c.method} ›
      </Link>
    </main>
  );
}
