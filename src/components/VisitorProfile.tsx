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
  const maxAge = Math.max(...profile.ages, 1);
  return (
    <section className={className}>
      <h2 className="text-sm font-bold">{t("지금 이곳에 있는 사람들")}</h2>
      {areaName && <p className="mt-0.5 text-xs text-gray-500">{t("서울시 실시간 도시데이터 · 주변 {area} 기준", { area: t(areaName) })}</p>}
      <div className="mt-3 flex h-3 overflow-hidden rounded-full">
        <div className="bg-sky-400" style={{ width: `${profile.male}%` }} />
        <div className="bg-pink-400" style={{ width: `${profile.female}%` }} />
      </div>
      <p className="mt-1 flex justify-between text-xs text-gray-600">
        <span>
          {t("남성")} {profile.male}%
        </span>
        <span>
          {t("여성")} {profile.female}%
        </span>
      </p>
      <ul className="mt-4 flex h-24 items-end gap-1.5">
        {profile.ages.map((v, i) => (
          <li key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] text-gray-500">{Math.round(v)}%</span>
            <span className="w-full rounded-t bg-indigo-400" style={{ height: `${Math.max(4, (v / maxAge) * 56)}px` }} />
            <span className="text-[10px] text-gray-500">{i === 0 ? "0-9" : i === 7 ? "70+" : `${i}0s`}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-gray-600">
        {t("이 동네에 사는 사람 {r}% · 다른 곳에서 온 사람 {v}%", {
          r: Math.round(profile.resident),
          v: Math.round(100 - profile.resident),
        })}
      </p>
    </section>
  );
}
