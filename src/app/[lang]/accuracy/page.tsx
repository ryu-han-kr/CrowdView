import type { Metadata } from "next";
import Link from "@/i18n/link";
import type { Lang } from "@/i18n/config";
import { HORIZONS, getAccuracy, type DayStat } from "@/lib/accuracy";
import { pageMeta } from "@/lib/seo";

// 예측 정확도 공개: 서울 119곳에서 매시간 예측과 실제를 비교한 결과 (lib/accuracy, 수집기가 기록)
export const revalidate = 3600;

const COPY = {
  ko: {
    title: "예측 정확도",
    lead: "서울 실시간 119곳에서 매시간 예측을 저장해 두고, 그 시각이 되면 서울시 실제 값과 비교해요. ‘단계 일치’는 화면의 5단계가 맞은 비율, ‘평균 오차’는 0~100점 기준 점수 차이예요.",
    horizon: { "official-1h": "서울시 공식 예측 · 1시간 뒤", "official-3h": "서울시 공식 예측 · 3시간 뒤", "pattern-24h": "CrowdView 패턴 예측 · 24시간 뒤" },
    week: "최근 7일",
    match: "단계 일치",
    err: "평균 오차",
    n: "비교 수",
    date: "날짜",
    empty: "2026-10-17부터 기록을 시작했어요. 몇 시간 뒤부터 숫자가 쌓여요.",
    method: "계산 방식 보기",
    pts: "점",
  },
  en: {
    title: "Forecast accuracy",
    lead: "Every hour we store forecasts for 119 Seoul areas and compare them with Seoul's actual values when that hour arrives. ‘Level match’ is the share of correct five-level predictions; ‘mean error’ is the score difference on a 0–100 scale.",
    horizon: { "official-1h": "Seoul official forecast · 1 h ahead", "official-3h": "Seoul official forecast · 3 h ahead", "pattern-24h": "CrowdView pattern forecast · 24 h ahead" },
    week: "Last 7 days",
    match: "Level match",
    err: "Mean error",
    n: "Comparisons",
    date: "Date",
    empty: "Tracking started on 2026-10-17. Numbers appear after a few hours.",
    method: "How it is calculated",
    pts: "pt",
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
  const rows = await getAccuracy(14);
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

      {any ? (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-gray-100 bg-white">
          <table className="w-full text-left text-sm">
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
                              <b>{pct(s)}</b> <span className="text-xs text-gray-500">· {err(s)} · {s.n}</span>
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
        <p className="mt-8 rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">{c.empty}</p>
      )}
      <Link href="/methodology" className="mt-6 inline-block text-sm font-semibold text-indigo-600">
        {c.method} ›
      </Link>
    </main>
  );
}
