// 장소 날씨 카드에 붙는 글 정보: 기상청 단기예보 통보문(오늘 날씨 해설), 에어코리아 고농도 초미세먼지 예보.
import { dataGoKr } from "./datagokr";
import { kst } from "./time";
import type { Place } from "./types";

const HOUR = 3600;

// 기상청 통보문 지점 (광역 예보구역)
const STN: Record<string, number> = {
  서울: 109, 인천: 109, 경기: 109, 강원: 105, 충북: 131, 대전: 133, 세종: 133, 충남: 133,
  전북: 146, 광주: 156, 전남: 156, 전남광주: 156, 대구: 143, 경북: 143, 부산: 159, 울산: 159, 경남: 159, 제주: 184,
};

const sidoOf = (p: Place) => p.airStation?.sido ?? p.region.split(" ")[0];

/** 오늘 날씨 해설 한두 줄 (예: "(종합) 내일 낮과 밤의 기온차 큼 …"). 한국어 원문 */
export async function getWeatherSummary(place: Place): Promise<{ lines: string[]; issued: string } | undefined> {
  const stnId = STN[sidoOf(place)];
  if (!stnId) return undefined;
  try {
    // 하루 4번(05·11·17·23시) 발표 → 1시간 캐시면 충분 (지점 9개 × 24회)
    const [row] = await dataGoKr("/1360000/VilageFcstMsgService/getWthrSituation", { dataType: "JSON", stnId: String(stnId) }, HOUR);
    const text = String(row?.wfSv1 ?? "");
    if (!text) return undefined;
    const lines = text
      .split("\n")
      .map((l) => l.replace(/^[□○\s]+/, "").trim())
      .filter((l) => /^\((종합|오늘)/.test(l))
      .slice(0, 2);
    const tm = String(row.tmFc ?? "");
    return lines.length ? { lines, issued: tm.length >= 10 ? `${+tm.slice(8, 10)}시` : "" } : undefined;
  } catch (e) {
    console.warn(`[weather-notes] summary ${place.id}:`, e instanceof Error ? e.message : e);
    return undefined;
  }
}

// 에어코리아 예보 권역 (경기·강원은 남북·동서로 나뉜다)
function airRegion(p: Place): string | undefined {
  const sido = sidoOf(p);
  const map: Record<string, string> = {
    서울: "seoul", 인천: "incheon", 대전: "daejeon", 세종: "sejong", 충북: "chungbuk", 충남: "chungnam", 광주: "gwangju",
    전남광주: p.lng < 127.0 ? "jeonnam" : "gwangju", 전북: "jeonbuk", 전남: "jeonnam", 부산: "busan", 대구: "daegu",
    울산: "ulsan", 경북: "gyeongbuk", 경남: "gyeongnam", 제주: "jeju",
  };
  if (sido === "경기") return p.lat >= 37.65 ? "gyeonggibuk" : "gyeongginam";
  if (sido === "강원") return p.lng < 128.4 ? "youngseo" : "youngdong";
  return map[sido];
}

export interface Pm25High {
  /** 고농도(50㎍ 초과)가 예보된 날짜 */
  dates: string[];
  overall: string;
}

/** 오늘·내일 중 이 장소 권역에 초미세먼지 고농도(50㎍/㎥ 초과)가 예보되면 알려준다 */
export async function getPm25High(place: Place): Promise<Pm25High | undefined> {
  const region = airRegion(place);
  if (!region) return undefined;
  try {
    // 하루 4번 발표, 전국 한 번에 → 2시간 캐시 (하루 12회)
    const rows = await dataGoKr(
      "/B552584/MinuDustFrcstDspthSvc/getMinuDustFrcstDspth50Over",
      { returnType: "json", searchDate: kst().date, numOfRows: "10" },
      2 * HOUR,
    );
    const today = kst().date;
    const dates = rows
      .filter((r) => String(r.informData) >= today && r[`${region}50Over`] === "O")
      .map((r) => String(r.informData));
    if (!dates.length) return undefined;
    return { dates: [...new Set(dates)].sort(), overall: String(rows[0]?.informOverall ?? "").replace(/^○\s*/, "") };
  } catch (e) {
    console.warn(`[weather-notes] pm25 ${place.id}:`, e instanceof Error ? e.message : e);
    return undefined;
  }
}
