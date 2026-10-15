// 부산광역시 행정동 생활인구 (통신데이터, 월별 일평균). 실시간은 아니지만 실제 측정된 시간대·성별·연령 패턴이다.
// data.go.kr 15164444(시간), 15164442(성별), 15164376(연령). 한 달에 한 번 바뀌므로 하루 1번만 호출한다.
import { dataGoKr } from "../datagokr";
import { kst } from "../time";
import type { Place } from "../types";

export interface LocalPop {
  /** 사용한 기준년월 YYYYMM (같은 달 최신 해) */
  stdYm: string;
  /** 0~23시 방문인구 (행정동 합계) */
  hourly: number[];
  gender: { male: number; female: number };
  ages: { label: string; value: number }[];
}

const DAY = 24 * 60 * 60;
const AGE_ORDER = ["20대미만", "20대", "30대", "40대", "50대", "60대이상"];

async function rows(service: string, hname: string) {
  return dataGoKr(`/6260000/${service}`, { hname, numOfRows: "2000", resultType: "json" }, DAY);
}

/** 오늘과 같은 달 중 가장 최근 해. 없으면 가장 최근 달 */
function pickMonth(months: string[]): string {
  const mm = kst().date.slice(5, 7);
  const sorted = [...new Set(months)].sort();
  return sorted.filter((m) => m.endsWith(mm)).at(-1) ?? sorted.at(-1)!;
}

export async function getLocalPop(place: Place): Promise<LocalPop | undefined> {
  const dongs = place.busanDongs;
  if (!dongs?.length) return undefined;
  const [times, genders, ages] = await Promise.all(
    ["DongPopTimeService/getDongPopTime", "DongPopGenderService/getDongPopGender", "DongPopAgeService/getDongPopAge"].map((svc) =>
      Promise.all(dongs.map((d) => rows(svc, d))).then((r) => r.flat()),
    ),
  );
  if (!times.length) return undefined;
  const stdYm = pickMonth(times.map((r) => String(r.stdYm)));

  const hourly = Array<number>(24).fill(0);
  for (const r of times) {
    if (r.stdYm !== stdYm) continue;
    const h = parseInt(String(r.times), 10);
    if (h >= 0 && h < 24) hourly[h] += Number(r.vpopAvg ?? 0);
  }

  const gender = { male: 0, female: 0 };
  const gMonth = pickMonth(genders.map((r) => String(r.stdYm)));
  for (const r of genders) {
    if (r.stdYm !== gMonth) continue;
    if (r.gender === "남성") gender.male += Number(r.vpopAvg ?? 0);
    if (r.gender === "여성") gender.female += Number(r.vpopAvg ?? 0);
  }

  const ageMap = new Map<string, number>();
  const aMonth = pickMonth(ages.map((r) => String(r.stdYm)));
  for (const r of ages) {
    if (r.stdYm !== aMonth) continue;
    const label = String(r.ages);
    ageMap.set(label, (ageMap.get(label) ?? 0) + Number(r.vpopAvg ?? 0));
  }
  const ageList = [...ageMap]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => AGE_ORDER.indexOf(a.label) - AGE_ORDER.indexOf(b.label));

  return { stdYm, hourly, gender, ages: ageList };
}
