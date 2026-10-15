import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { translateNames } from "@/lib/name-translate";
import type { Signals } from "@/lib/crowd/signals";
import { AIR_GRADE } from "@/lib/crowd/weather-air";
import { kst } from "@/lib/time";

const SKY: Record<number, string> = { 1: "맑음", 3: "구름많음", 4: "흐림" };
const PTY: Record<number, string> = { 1: "비", 2: "비/눈", 3: "눈", 4: "소나기" };
const ICON = (sky?: number, pty?: number) =>
  pty ? (pty === 3 ? "🌨️" : "🌧️") : sky === 1 ? "☀️" : sky === 3 ? "⛅" : sky === 4 ? "☁️" : "🌡️";
const AIR_COLOR = ["", "#10b981", "#84cc16", "#f97316", "#ef4444"];

/** 지금 날씨(기상청 단기예보)와 미세먼지(에어코리아 실시간) */
export async function WeatherCard({ signals, lang }: { signals: Signals; lang: Lang }) {
  const t = getT(lang);
  const stations = await translateNames([signals.air?.station], lang);
  const now = kst();
  const hh = Math.floor(now.hour);
  // 이번 시간 예보가 없으면 가장 가까운 다음 시간
  let w;
  for (let h = hh; h < hh + 3 && !w; h++) w = signals.weather?.get(`${now.date} ${String(h % 24).padStart(2, "0")}`);
  const air = signals.air;
  if (!w && !air) return null;

  return (
    <section className="mt-3 flex items-center gap-3 rounded-3xl border border-sky-100 bg-sky-50 px-4 py-3.5">
      {w && (
        <>
          <span className="text-4xl leading-none">{ICON(w.sky, w.pty)}</span>
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
  );
}

