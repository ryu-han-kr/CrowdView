"use client";

import Link from "@/i18n/link";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { currentPosition, kakaoDirections, type LatLng, type Transport } from "@/lib/geo";
import { levelOf } from "@/lib/levels";
import { INTERESTS, type Interest, type RoutePlan } from "@/lib/route";
import { LevelBadge } from "./Level";

interface Hub {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/** 노선 이름 ("2호선" → "Line 2" 등) */
function lineName(t: ReturnType<typeof useI18n>["t"], line: string) {
  const n = line.match(/^(\d)호선$/)?.[1];
  return n ? t("{n}호선", { n }) : t(line);
}

const clock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** 추천 코스 만들기: 출발지(내 위치·주요 장소) · 출발 시각 · 일정 길이 · 관심사 · 이동 수단 → 혼잡을 피하는 순서 */
export function RoutePlanner({ hubs, names = {} }: { hubs: Hub[]; names?: Record<string, string> }) {
  const { t, lang } = useI18n();
  const tr = (ko: string) => names[ko] ?? t(ko);
  const [start, setStart] = useState<(LatLng & { name: string }) | null>(null);
  const [locating, setLocating] = useState(false);
  const [offset, setOffset] = useState(0);
  const [duration, setDuration] = useState(240);
  const [interests, setInterests] = useState<Interest[]>(["history", "shopping", "nature"]);
  const [transport, setTransport] = useState<Transport>("transit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ plan: RoutePlan; locked: number; beta: boolean } | null>(null);

  const locate = async () => {
    setLocating(true);
    setError(null);
    try {
      const p = await currentPosition();
      setStart({ ...p, name: t("내 위치") });
    } catch (e) {
      setError(
        e instanceof Error && e.message === "denied"
          ? t("위치 권한이 꺼져 있어요. 브라우저 설정에서 허용하거나 아래에서 출발지를 골라 주세요.")
          : t("위치를 찾지 못했어요. 아래에서 출발지를 골라 주세요."),
      );
    } finally {
      setLocating(false);
    }
  };

  const plan = async () => {
    if (!start) return setError(t("출발지를 먼저 정해 주세요"));
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ start, offsetMin: offset, durationMin: duration, interests, transport, lang }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const chip = (on: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${on ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-10">
      <section className="space-y-5">
        <div>
          <p className="text-sm font-bold">{t("출발지")}</p>
          <button
            onClick={locate}
            disabled={locating}
            className={`mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold ${
              start?.name === t("내 위치") ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700"
            }`}
          >
            📍 {locating ? t("위치 찾는 중…") : start?.name === t("내 위치") ? t("내 위치에서 출발") : t("내 위치 사용하기")}
          </button>
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
            {hubs.map((h) => (
              <button key={h.id} onClick={() => setStart({ lat: h.lat, lng: h.lng, name: h.name })} className={chip(start?.name === h.name)}>
                {tr(h.name)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-bold">{t("출발 시각")}</p>
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
            {[0, 60, 120, 180, 240, 360].map((m) => (
              <button key={m} onClick={() => setOffset(m)} className={chip(offset === m)}>
                {m === 0 ? t("지금") : t("{n}시간 뒤", { n: m / 60 })}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-bold">{t("일정")}</p>
          <div className="mt-2 flex gap-2">
            {[
              [180, "3시간"],
              [240, "반나절 (4시간)"],
              [360, "6시간"],
              [480, "하루 (8시간)"],
            ].map(([m, label]) => (
              <button key={m} onClick={() => setDuration(m as number)} className={chip(duration === m)}>
                {t(label as string)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-bold">{t("관심사")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {INTERESTS.map((i) => {
              const on = interests.includes(i.id);
              return (
                <button
                  key={i.id}
                  onClick={() => setInterests(on ? interests.filter((x) => x !== i.id) : [...interests, i.id])}
                  aria-pressed={on}
                  className={chip(on)}
                >
                  {i.emoji} {t(i.label)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-sm font-bold">{t("이동")}</p>
          <div className="mt-2 flex gap-2">
            {(["transit", "walk"] as const).map((m) => (
              <button key={m} onClick={() => setTransport(m)} className={chip(transport === m)}>
                {m === "transit" ? `🚇 ${t("대중교통")}` : `🚶 ${t("걷기 위주")}`}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={plan}
          disabled={busy}
          className="w-full rounded-2xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-sm"
        >
          {busy ? t("코스를 짜는 중…") : t("한산한 코스 만들기")}
        </button>
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      </section>

      <section className="mt-8 lg:mt-0">
        {result ? <RouteResult start={start!} {...result} /> : <Intro />}
      </section>
    </div>
  );
}

function Intro() {
  const { t } = useI18n();
  return (
    <div className="rounded-3xl bg-gradient-to-br from-indigo-50 to-sky-50 p-6 text-sm leading-relaxed text-gray-700">
      <p className="text-lg font-bold text-gray-900">{t("붐비는 시간을 피해 도는 순서를 짜 드려요")}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5">
        <li>{t("서울 실시간 인구와 시간대별 예측으로, 도착할 때 덜 붐비는 곳부터 들러요")}</li>
        <li>{t("이동시간까지 계산해서 가능한 모든 순서 중 가장 한산한 순서를 골라요")}</li>
        <li>{t("내 위치를 켜면 지금 있는 곳에서 바로 출발하는 코스가 나와요")}</li>
      </ul>
    </div>
  );
}

function RouteResult({
  start,
  plan,
  locked,
  beta,
}: {
  start: LatLng & { name: string };
  plan: RoutePlan;
  locked: number;
  beta: boolean;
}) {
  const { t } = useI18n();
  if (!plan.stops.length)
    return <p className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">{t("조건에 맞는 곳을 찾지 못했어요. 관심사를 늘리거나 대중교통·일정을 바꿔 보세요.")}</p>;
  const saved = plan.peakAvgScore - plan.avgScore;
  const points = [start, ...plan.stops];
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-lg font-bold">
            {t("{n}곳 코스", { n: plan.stops.length + locked })} · {clock(plan.stops[0].arrive - plan.stops[0].travelMin)}~{clock(plan.endMin)}
          </p>
          <p className="text-sm text-gray-600">
            {t("평균 예상 혼잡")} <b style={{ color: levelOf(plan.avgScore).color }}>{t(levelOf(plan.avgScore).label)}</b>
            {saved > 5 && <> · {t("가장 붐빌 때보다 {n}점 한산", { n: saved })}</>}
          </p>
        </div>
        {beta && <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">{t("베타 무료")}</span>}
      </div>

      <RouteSketch points={points} />

      <ol className="mt-4 space-y-2">
        {plan.stops.map((s, i) => {
          const prev = i === 0 ? start : plan.stops[i - 1];
          return (
            <li key={s.id}>
              <a
                href={kakaoDirections({ ...prev, name: i === 0 ? start.name : prev.name }, s)}
                target="_blank"
                rel="noreferrer"
                className="ml-4 flex items-center gap-2 border-l-2 border-dashed border-gray-200 py-1.5 pl-5 text-xs text-gray-500"
              >
                {s.walk ? "🚶" : "🚇"} {s.lines?.length ? <>{s.lines.map((l) => lineName(t, l)).join(" → ")} · </> : null}
                {t("{n}분", { n: s.travelMin })} · {s.travelKm}km · <span className="text-indigo-600">{t("길찾기")} ›</span>
              </a>
              <Link
                href={s.href}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${s.meal ? "border-amber-100 bg-amber-50/60" : "border-gray-100"}`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${s.meal ? "bg-amber-500" : "bg-indigo-600"}`}
                >
                  {s.meal ? "🍽️" : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-gray-500">
                    {clock(s.arrive)}~{clock(s.leave)}
                    {s.meal && <> · {t(s.meal === "lunch" ? "점심" : "저녁")}</>}
                  </span>
                  <span className="block truncate text-sm font-bold">{s.name}</span>
                  {!s.meal && s.peak && s.peak.score - s.score >= 15 && (
                    <span className="block text-[11px] text-emerald-700">
                      {t("{h}시({level})를 피해서 가요", { h: s.peak.hour, level: t(levelOf(s.peak.score).label) })}
                    </span>
                  )}
                </span>
                {!s.meal && <LevelBadge score={s.score} />}
              </Link>
            </li>
          );
        })}
      </ol>

      {locked > 0 && (
        <Link href="/pricing" className="mt-3 block rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-4 text-white">
          <p className="text-sm font-bold">🔒 {t("나머지 {n}곳은 Plus에서 볼 수 있어요", { n: locked })}</p>
          <p className="text-xs text-white/80">{t("전체 시간표 · 붐비면 다시 짜기 · 월 3,900원")}</p>
        </Link>
      )}
      <p className="mt-4 text-[11px] leading-relaxed text-gray-400">
        {t("예상 혼잡은 서울시 실시간 도시데이터와 CrowdView 예측이에요. 이동시간은 서울시 지하철 역간 소요시간과 걷는 거리로 어림한 값이라 실제와 다를 수 있어요. 식사는 서울 여행 가이드 맛집 중 가까운 곳이에요.")}
      </p>
    </div>
  );
}

/** 출발지와 들르는 곳을 위치대로 찍은 간단한 경로 그림 */
function RouteSketch({ points }: { points: (LatLng & { name: string })[] }) {
  const W = 320;
  const H = 180;
  const pad = 24;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const span = Math.max(maxLat - minLat, (maxLng - minLng) * 0.8, 0.005);
  const x = (lng: number) => pad + ((lng - minLng) * 0.8 * (W - 2 * pad)) / span;
  const y = (lat: number) => H - pad - ((lat - minLat) * (H - 2 * pad)) / span;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full rounded-3xl bg-sky-50" role="img" aria-label="route">
      <polyline
        points={points.map((p) => `${x(p.lng)},${y(p.lat)}`).join(" ")}
        fill="none"
        stroke="#6366f1"
        strokeWidth={2.5}
        strokeDasharray="6 4"
        strokeLinecap="round"
      />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(p.lng)} cy={y(p.lat)} r={i === 0 ? 7 : 11} fill={i === 0 ? "#111827" : "#4f46e5"} stroke="white" strokeWidth={2} />
          {i > 0 && (
            <text x={x(p.lng)} y={y(p.lat) + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="white">
              {i}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
