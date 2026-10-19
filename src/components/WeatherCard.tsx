import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { translateNames } from "@/lib/name-translate";
import type { Signals } from "@/lib/crowd/signals";
import { AIR_GRADE } from "@/lib/crowd/weather-air";
import { kst } from "@/lib/time";
import type { Place } from "@/lib/types";
import { getPm25High, getWeatherSummary } from "@/lib/weather-notes";
import { Glyph } from "@/components/Glyph";

const SKY: Record<number, string> = { 1: "맑음", 3: "구름많음", 4: "흐림" };
const PTY: Record<number, string> = { 1: "비", 2: "비/눈", 3: "눈", 4: "소나기" };
const ICON = (sky?: number, pty?: number) => (pty ? (pty === 3 ? "🌨️" : "🌧️") : sky === 1 ? "☀️" : sky === 3 ? "⛅" : sky === 4 ? "☁️" : "🌡️");
const AIR_COLOR = ["", "#10b981", "#84cc16", "#f97316", "#ef4444"];

/** 지금 날씨(기상청 단기예보)와 미세먼지(에어코리아 실시간). place를 주면 고농도 미세먼지 예보·기상청 해설도 */
export async function WeatherCard({ signals, lang, place }: { signals: Signals; lang: Lang; place?: Place }) {
  const t = getT(lang);
  const [stations, pm25High, summary] = await Promise.all([
    translateNames([signals.air?.station], lang),
    place ? getPm25High(place) : undefined,
    // 해설은 기상청 원문(긴 한국어 문장)이라 한국어 화면에만
    place && lang === "ko" ? getWeatherSummary(place) : undefined,
  ]);
  const now = kst();
  const hh = Math.floor(now.hour);
  // 이번 시간 예보가 없으면 가장 가까운 다음 시간
  let w;
  for (let h = hh; h < hh + 3 && !w; h++) w = signals.weather?.get(`${now.date} ${String(h % 24).padStart(2, "0")}`);
  const air = signals.air;
  if (!w && !air) return null;

  return (
    <>
      {pm25High && (
        <p className="mt-3 rounded-2xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">
          <Glyph e="😷" className="mr-1 h-4 w-4" />
          {t("{days} 초미세먼지 고농도(50㎍ 초과) 예보 · 야외라면 마스크를 챙기세요", {
            days: pm25High.dates.map((d) => (d === kst().date ? t("오늘") : t("내일"))).join("·"),
          })}
        </p>
      )}
      <section className="card mt-3 flex items-center gap-3">
        {w && (
          <>
            <Glyph e={ICON(w.sky, w.pty)} className={`h-10 w-10 ${w.pty ? "text-sky-600" : w.sky === 1 ? "text-amber-400" : "text-sky-500"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-2xl font-bold text-gray-900">
                {w.tmp !== undefined && `${w.tmp}°`}{" "}
                <span className="text-base font-semibold text-gray-800">{t(w.pty ? PTY[w.pty] : (SKY[w.sky ?? 0] ?? ""))}</span>
              </p>
              <p className="text-xs font-medium text-gray-600">
                {t("강수확률 {n}%", { n: w.pop ?? 0 })} · {t("기상청 단기예보")}
              </p>
            </div>
          </>
        )}
        {air?.pm25Grade && (
          <div className="shrink-0 text-right">
            <p className="text-xs font-medium text-gray-600">{t("초미세먼지")}</p>
            <p className="text-lg font-bold" style={{ color: AIR_COLOR[air.pm25Grade] }}>
              {t(AIR_GRADE[air.pm25Grade])}
              {air.pm25 !== undefined && <span className="ml-1 text-xs font-semibold text-gray-700">{air.pm25}㎍</span>}
            </p>
            <p className="text-[11px] text-gray-500">{t("{name} 측정소", { name: stations.get(air.station) ?? air.station })}</p>
          </div>
        )}
      </section>
      {summary && (
        <div className="mt-2 rounded-2xl bg-gray-50 px-4 py-2.5 text-xs leading-relaxed text-gray-600">
          {summary.lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
          <p className="mt-1 text-[11px] text-gray-400">기상청 통보문 · {summary.issued} 발표</p>
        </div>
      )}
    </>
  );
}
