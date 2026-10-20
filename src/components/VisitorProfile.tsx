import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { formatHour } from "@/i18n/translate";
import type { LocalPop } from "@/lib/crowd/busan-pop";
import { GenderDonut } from "@/components/GenderDonut";

/** 연령대 가로 막대: 가장 많은 연령대는 진하게 + 이름 굵게 */
function AgeBars({ ages, t }: { ages: { label: string; pct: number }[]; t: ReturnType<typeof getT> }) {
  const max = Math.max(...ages.map((a) => a.pct), 1);
  return (
    <ul className="mt-4 space-y-2">
      {ages.map((a) => {
        const top = a.pct === max;
        return (
          <li key={a.label} className="flex items-center gap-2.5 text-sm">
            <span className={`w-[4.5rem] shrink-0 whitespace-nowrap ${top ? "font-bold text-gray-900" : "text-gray-500"}`}>{t(a.label)}</span>
            <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${(a.pct / max) * 100}%`, background: top ? "linear-gradient(90deg,#818cf8,#4f46e5)" : "#c7d2fe" }}
              />
            </div>
            <span className={`w-10 shrink-0 text-right tabular-nums ${top ? "font-bold text-indigo-700" : "text-gray-600"}`}>{a.pct}%</span>
          </li>
        );
      })}
    </ul>
  );
}

const pct = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

/** 부산시 생활인구(통신데이터) 기반 방문자 특성: 성별·연령·평소 붐비는 시간 */
export function VisitorProfile({ pop, lang }: { pop: LocalPop; lang: Lang }) {
  const t = getT(lang);
  const gTotal = pop.gender.male + pop.gender.female;
  const aTotal = pop.ages.reduce((s, a) => s + a.value, 0);
  const busiest = pop.hourly.indexOf(Math.max(...pop.hourly));
  const month = t("{y}년 {m}월", { y: pop.stdYm.slice(0, 4), m: Number(pop.stdYm.slice(4)) });

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">{t("어떤 사람들이 올까요?")}</h2>
      <p className="mt-0.5 text-xs text-gray-500">
        {t("부산시 생활인구(통신데이터) · {month} 하루 평균 방문인구", { month })} · {t("평소 가장 붐비는 시간")}{" "}
        <b>{formatHour(busiest, lang)}</b>
      </p>

      {gTotal > 0 && (
        <div className="mt-4">
          <GenderDonut male={pop.gender.male} female={pop.gender.female} />
        </div>
      )}

      {aTotal > 0 && <AgeBars ages={pop.ages.map((x) => ({ label: x.label, pct: pct(x.value, aTotal) }))} t={t} />}
      <p className="mt-3 text-[11px] text-gray-400">{t("실시간이 아닌 월 평균이에요. 시간대 그래프는 이 패턴을 바탕으로 계산해요.")}</p>
    </section>
  );
}

/**
 * 서울시 실시간 도시데이터의 지금 있는 사람들: 성별·연령대·사는 사람/온 사람 비율 (서울 실시간 지역 화면·서울 장소 상세)
 * areaName: 장소 상세에서는 "주변 ○○" 기준이라고 밝힌다
 */
export function SeoulPeopleProfile({
  profile,
  lang,
  areaName,
  className = "mt-4 rounded-3xl border border-gray-100 p-4",
}: {
  profile: { male: number; female: number; ages: number[]; resident: number };
  lang: Lang;
  areaName?: string;
  className?: string;
}) {
  const t = getT(lang);
  return (
    <section className={className}>
      <h2 className="text-sm font-bold">{t("지금 이곳에 있는 사람들")}</h2>
      {areaName && <p className="mt-0.5 text-xs text-gray-500">{t("서울시 실시간 도시데이터 · 주변 {area} 기준", { area: t(areaName) })}</p>}
      <div className="mt-3">
        <GenderDonut male={profile.male} female={profile.female} />
      </div>
      <AgeBars
        ages={profile.ages.map((v, i) => ({ label: i === 0 ? "10대 미만" : i === 7 ? "70대 이상" : `${i}0대`, pct: Math.round(v) }))}
        t={t}
      />
      <p className="mt-3 text-xs text-gray-600">
        {t("이 동네에 사는 사람 {r}% · 다른 곳에서 온 사람 {v}%", {
          r: Math.round(profile.resident),
          v: Math.round(100 - profile.resident),
        })}
      </p>
    </section>
  );
}
