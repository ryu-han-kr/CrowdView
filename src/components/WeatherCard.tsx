import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { translateNames } from "@/lib/name-translate";
import type { Signals } from "@/lib/crowd/signals";
import { AIR_GRADE } from "@/lib/crowd/weather-air";
import { kst } from "@/lib/time";
import type { Place } from "@/lib/types";
import { getPm25High, getWeatherSummary } from "@/lib/weather-notes";
import { inkOf } from "@/lib/levels";
import { Glyph } from "@/components/Glyph";

const SKY: Record<number, string> = { 1: "맑음", 3: "구름많음", 4: "흐림" };
const PTY: Record<number, string> = { 1: "비", 2: "비/눈", 3: "눈", 4: "소나기" };
const ICON = (sky?: number, pty?: number) => (pty ? (pty === 3 ? "🌨️" : "🌧️") : sky === 1 ? "☀️" : sky === 3 ? "⛅" : sky === 4 ? "☁️" : "🌡️");
const AIR_COLOR = ["", "#10b981", "#84cc16", "#f97316", "#ef4444"];

/** 날씨 카드를 누르면 자세한 예보로: 한국어 화면은 네이버 날씨, 외국어 화면은 구글 날씨 (장소 이름으로 검색) */
export function weatherHref(lang: Lang, place?: Pick<Place, "name" | "region">): string {
  if (lang === "ko") return `https://search.naver.com/search.naver?query=${encodeURIComponent(`${place?.name ?? "서울"} 날씨`)}`;
  const name = place ? getT("en")(place.name) : "Seoul";
  return `https://www.google.com/search?hl=${lang}&q=${encodeURIComponent(`${name} weather`)}`;
}

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

  const sky = w ? t(w.pty ? PTY[w.pty] : (SKY[w.sky ?? 0] ?? "")) : "";

  // 날씨·강수·미세먼지·기상청 해설·고농도 예보를 한 카드에 모은다 (사용자 QA 10/22: 흩어진 글을 한곳에)
  return (
    <section className="card mt-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold">{t("오늘 날씨")}</h2>
        <a
          href={weatherHref(lang, place)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-indigo-600"
          title={t(lang === "ko" ? "네이버 날씨에서 자세히 보기" : "구글 날씨에서 자세히 보기")}
        >
          {t("자세히")} ›
        </a>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-sky-50 px-2 py-3">
          {w ? (
            <>
              <Glyph
                e={ICON(w.sky, w.pty)}
                className={`mx-auto h-9 w-9 ${w.pty ? "text-sky-600" : w.sky === 1 ? "text-amber-400" : "text-sky-500"}`}
              />
              <p className="mt-1 text-xl font-extrabold text-gray-900">{w.tmp !== undefined ? `${w.tmp}°` : "–"}</p>
              <p className="text-sm font-semibold text-gray-700">{sky}</p>
            </>
          ) : (
            <p className="py-4 text-sm text-gray-600">–</p>
          )}
        </div>
        <div className="rounded-2xl bg-indigo-50 px-2 py-3">
          <Glyph e="☔" className="mx-auto h-9 w-9 text-indigo-500" />
          <p className="mt-1 text-xl font-extrabold text-gray-900">{w ? `${w.pop ?? 0}%` : "–"}</p>
          <p className="text-sm font-semibold text-gray-700">{t("강수확률")}</p>
        </div>
        <div className="rounded-2xl px-2 py-3" style={{ background: air?.pm25Grade ? `${AIR_COLOR[air.pm25Grade]}1f` : "var(--color-gray-100)" }}>
          <Glyph e="😷" className="mx-auto h-9 w-9 text-gray-600" />
          <p className="mt-1 text-xl font-extrabold" style={{ color: air?.pm25Grade ? inkOf(AIR_COLOR[air.pm25Grade]) : undefined }}>
            {air?.pm25Grade ? t(AIR_GRADE[air.pm25Grade]) : "–"}
          </p>
          <p className="text-sm font-semibold text-gray-700">
            {t("초미세먼지")}
            {air?.pm25 !== undefined && <span className="ml-0.5 text-xs font-medium">{air.pm25}㎍</span>}
          </p>
        </div>
      </div>
      {pm25High && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
          <Glyph e="⚠️" className="mr-1 h-4 w-4" />
          {t("{days} 초미세먼지 고농도(50㎍ 초과) 예보 · 야외라면 마스크를 챙기세요", {
            days: pm25High.dates.map((d) => (d === kst().date ? t("오늘") : t("내일"))).join("·"),
          })}
        </p>
      )}
      {summary && (
        <div className="mt-3 rounded-xl bg-gray-100 px-3.5 py-3 text-sm leading-relaxed text-gray-800">
          {summary.lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-gray-600">
        {[
          w && t("기상청 단기예보"),
          air?.pm25Grade && t("{name} 측정소", { name: stations.get(air.station) ?? air.station }),
          summary && `기상청 통보문 ${summary.issued} 발표`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </section>
  );
}
