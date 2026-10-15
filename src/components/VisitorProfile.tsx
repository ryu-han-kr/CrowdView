import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { formatHour } from "@/i18n/translate";
import type { LocalPop } from "@/lib/crowd/busan-pop";

const pct = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

/** 부산시 생활인구(통신데이터) 기반 방문자 특성: 성별·연령·평소 붐비는 시간 */
export function VisitorProfile({ pop, lang }: { pop: LocalPop; lang: Lang }) {
  const t = getT(lang);
  const gTotal = pop.gender.male + pop.gender.female;
  const aTotal = pop.ages.reduce((s, a) => s + a.value, 0);
  const aMax = Math.max(...pop.ages.map((a) => a.value), 1);
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
          <div className="flex h-3 overflow-hidden rounded-full">
            <div className="bg-sky-400" style={{ width: `${pct(pop.gender.male, gTotal)}%` }} />
            <div className="bg-rose-400" style={{ width: `${pct(pop.gender.female, gTotal)}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs">
            <span className="text-sky-600">
              {t("남성")} {pct(pop.gender.male, gTotal)}%
            </span>
            <span className="text-rose-500">
              {t("여성")} {pct(pop.gender.female, gTotal)}%
            </span>
          </div>
        </div>
      )}

      {aTotal > 0 && (
        <ul className="mt-4 space-y-1.5">
          {pop.ages.map((a) => (
            <li key={a.label} className="flex items-center gap-2 text-xs">
              <span className="w-14 shrink-0 text-gray-500">{t(a.label)}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-indigo-400" style={{ width: `${(a.value / aMax) * 100}%` }} />
              </div>
              <span className="w-9 shrink-0 text-right font-medium">{pct(a.value, aTotal)}%</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-gray-400">{t("실시간이 아닌 월 평균이에요. 시간대 그래프는 이 패턴을 바탕으로 계산해요.")}</p>
    </section>
  );
}
