"use client";

import Link from "@/i18n/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { canOptimize } from "@/lib/img";
import { RouteMap } from "./map/RouteMap";
import { useI18n } from "@/i18n/client";
import { LocalTime } from "./LocalTime";
import { currentPosition, kakaoDirections, type LatLng, type Transport } from "@/lib/geo";
import { levelOf, inkOf } from "@/lib/levels";
import { usePicks, usePlans } from "@/lib/prefs";
import { INTERESTS, type Interest, type RoutePlan } from "@/lib/route";
import { LevelBadge } from "./Level";
import { Glyph } from "@/components/Glyph";
import { EmptyState } from "@/components/EmptyState";

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

/** 한국 시간 기준 오늘부터 n일 뒤의 요일 (0=일) */
const kstDay = (n: number, now = Date.now()) => new Date(now + 9 * 3600_000 + n * 86_400_000).getUTCDay();
const kstHour = (now = Date.now()) => new Date(now + 9 * 3600_000).getUTCHours();
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

const STATE_KEY = "route:planner";

const clock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** 추천 코스 만들기: 출발지(내 위치·주요 장소) · 출발 시각 · 일정 길이 · 관심사 · 이동 수단 → 혼잡을 피하는 순서 */
/** 가고 싶은 곳 (검색해서 넣은 곳) */
interface MyStop {
  name: string;
  sub?: string;
  lat: number;
  lng: number;
  href?: string;
}

export function RoutePlanner({ hubs, names = {}, kakao = false }: { hubs: Hub[]; names?: Record<string, string>; kakao?: boolean }) {
  const { t, lang } = useI18n();
  const tr = (ko: string) => names[ko] ?? t(ko);
  // 지금 시각·요일은 브라우저에서 열린 뒤에만 쓴다. 이 화면은 미리 만들어 두는 페이지라 서버가 그린 시각(빌드 때)과
  // 브라우저 시각이 달라 화면 불일치 오류(React #418)가 났다. 열리기 전에는 시각으로 거르지 않는다
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const hourNow = now === null ? -1 : kstHour(now);
  const weekdayName = (dow: number) =>
    new Intl.DateTimeFormat(lang, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 4 + dow)));
  const [start, setStart] = useState<(LatLng & { name: string }) | null>(null);
  const [locating, setLocating] = useState(false);
  // 출발 날짜(오늘부터 며칠 뒤)와 시각(null = 지금)
  const [day, setDay] = useState(0);
  const [hour, setHour] = useState<number | null>(null);
  const [duration, setDuration] = useState(240);
  const [interests, setInterests] = useState<Interest[]>(["history", "shopping", "nature"]);
  const [transport, setTransport] = useState<Transport>("transit");
  // 가고 싶은 곳: 검색해서 넣으면 코스에 꼭 넣는다 (사용자 10/22)
  const [mine, setMine] = useState<MyStop[]>([]);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<MyStop[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const query = q.trim();
    if (!query) return setHits([]);
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const qs = new URLSearchParams({ q: query, lang, ...(start && { lat: String(start.lat), lng: String(start.lng) }) });
        const res = await fetch(`/api/route/search?${qs}`, { signal: ctl.signal });
        setHits(res.ok ? ((await res.json()).hits as MyStop[]) : []);
      } catch {
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [q, lang, start]);
  const sendMine = mine.map((m) => ({ name: m.name, lat: m.lat, lng: m.lng, href: m.href }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<RouteResponse | null>(null);
  // 다시 짜기: 처음 정한 일정이 끝나는 시각(오늘 0시부터 분)과 어디서 다시 짰는지
  const [endAbs, setEndAbs] = useState(0);
  const [replanned, setReplanned] = useState<string | null>(null);
  // 서울 실시간·여행 가이드에서 ☆로 담은 곳 (켜 두면 코스에 꼭 넣는다)
  const { picks, remove: removePick } = usePicks();
  const [usePicked, setUsePicked] = useState(true);
  const sendPicks = usePicked ? picks.map((p) => p.id) : [];

  // 결과 장소를 눌렀다가 뒤로 오면 화면이 처음으로 돌아가던 문제: 고른 조건과 결과를 이 탭(sessionStorage)에 두고 다시 채운다
  const restored = useRef(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STATE_KEY);
      const s = raw ? JSON.parse(raw) : null;
      // 3시간이 지난 결과는 혼잡 예측이 낡아서 버린다
      if (s && Date.now() - (s.at ?? 0) < 3 * 3600_000) {
        if (s.start) setStart(s.start);
        setDay(s.day ?? 0);
        setHour(s.hour ?? null);
        setDuration(s.duration ?? 240);
        if (Array.isArray(s.interests)) setInterests(s.interests);
        if (s.transport) setTransport(s.transport);
        if (Array.isArray(s.mine)) setMine(s.mine);
        if (s.result) setResult(s.result);
        setEndAbs(s.endAbs ?? 0);
        setReplanned(s.replanned ?? null);
      }
    } catch {}
    restored.current = true;
  }, []);
  useEffect(() => {
    if (!restored.current) return;
    try {
      sessionStorage.setItem(
        STATE_KEY,
        JSON.stringify({ at: Date.now(), start, day, hour, duration, interests, transport, mine, result, endAbs, replanned }),
      );
    } catch {}
  }, [start, day, hour, duration, interests, transport, mine, result, endAbs, replanned]);

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

  const request = async (body: Record<string, unknown>): Promise<RouteResponse | null> => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/route", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json as RouteResponse;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const plan = async () => {
    if (!start) return setError(t("출발지를 먼저 정해 주세요"));
    if (!interests.length && !sendPicks.length && !mine.length) return setError(t("관심사를 하나 이상 골라 주세요"));
    setNotice(null);
    let json = await request({ start, day, hour, durationMin: duration, interests, transport, lang, picks: sendPicks, custom: sendMine });
    if (!json) return;
    // 밤늦게 '오늘·지금'으로 짜면 문 연 곳이 없다 → 내일 오전 9시 출발로 다시 짜고 알려 준다
    if (!json.plan.stops.length && day === 0 && hour === null) {
      const next = await request({ start, day: 1, hour: 9, durationMin: duration, interests, transport, lang, picks: sendPicks, custom: sendMine });
      if (next?.plan.stops.length) {
        json = next;
        setDay(1);
        setHour(9);
        setNotice(t("지금은 대부분 문을 닫아 내일 오전 9시 출발로 짰어요."));
      }
    }
    setResult(json);
    setEndAbs(json.startMin + duration);
    setReplanned(null);
  };

  /** i번째 장소를 떠나는 시각·위치부터, 들른 곳은 빼고 남은 시간으로 다시 짠다 (붐비거나 계획이 바뀌었을 때) */
  const replanFrom = async (i: number) => {
    if (!result) return;
    const stop = result.plan.stops[i];
    const visited = result.plan.stops.slice(0, i + 1).map((s) => s.id);
    const left = endAbs - stop.leave;
    if (left < 60) return setError(t("남은 시간이 1시간보다 짧아 다시 짤 수 없어요"));
    const json = await request({
      start: { lat: stop.lat, lng: stop.lng, name: stop.name },
      startMin: stop.leave,
      durationMin: left,
      interests,
      transport,
      lang,
      picks: sendPicks.filter((id) => !visited.includes(id)),
      custom: sendMine.filter((m) => !result.plan.stops.slice(0, i + 1).some((s) => Math.abs(s.lat - m.lat) < 0.0005 && Math.abs(s.lng - m.lng) < 0.0005)),
      exclude: visited,
    });
    if (!json) return;
    setStart({ lat: stop.lat, lng: stop.lng, name: stop.name });
    setResult(json);
    setReplanned(stop.name);
  };

  const chip = (on: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${on ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-10">
      <section className="space-y-5">
        {picks.length > 0 && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
            <label className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1 text-sm font-bold">
                <Glyph e="⭐" className="h-4 w-4 text-amber-400" /> {t("담은 곳 {n}곳을 코스에 넣기", { n: picks.length })}
              </span>
              <input type="checkbox" checked={usePicked} onChange={(e) => setUsePicked(e.target.checked)} className="h-5 w-5 accent-indigo-600" />
            </label>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {picks.map((p) => (
                <li key={p.id}>
                  <button onClick={() => removePick(p.id)} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm">
                    {p.label} <Glyph e="✕" className="ml-0.5 h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-gray-500">{t("담은 곳을 먼저 넣고, 남는 시간은 관심사에 맞는 한산한 곳으로 채워요 (최대 6곳)")}</p>
          </div>
        )}
        <div>
          <p className="text-sm font-bold">{t("출발지")}</p>
          <button
            onClick={locate}
            disabled={locating}
            className={`mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold ${
              start?.name === t("내 위치") ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700"
            }`}
          >
            <Glyph e="📍" /> {locating ? t("위치 찾는 중…") : start?.name === t("내 위치") ? t("내 위치에서 출발") : t("내 위치 사용하기")}
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
          <p className="text-sm font-bold">{t("가고 싶은 곳")}</p>
          <p className="mt-0.5 text-xs text-gray-600">{t("검색해서 넣으면 코스에 꼭 넣고, 남는 시간은 한산한 곳으로 채워요 (최대 6곳)")}</p>
          <div className="relative mt-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("장소 이름 검색 (예: 더현대 서울, 국립중앙박물관)")}
              className="w-full rounded-2xl bg-gray-100 px-4 py-3 text-[15px] outline-none placeholder:text-gray-500"
              enterKeyHint="search"
            />
            {q.trim() && (
              <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-2xl border border-gray-100 bg-white p-1 shadow-lg">
                {searching && !hits.length && <li className="px-3 py-2.5 text-sm text-gray-500">{t("찾는 중…")}</li>}
                {!searching && !hits.length && <li className="px-3 py-2.5 text-sm text-gray-500">{t("찾는 곳이 없어요")}</li>}
                {hits.map((h) => (
                  <li key={`${h.name}${h.lat}`}>
                    <button
                      onClick={() => {
                        if (mine.length < 6 && !mine.some((m) => m.name === h.name)) setMine([...mine, h]);
                        setQ("");
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left md:hover:bg-gray-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-bold text-gray-950">{h.name}</span>
                        {h.sub && <span className="block truncate text-xs text-gray-600">{tr(h.sub)}</span>}
                      </span>
                      <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">+ {t("넣기")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {mine.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {mine.map((m) => (
                <li key={m.name}>
                  <button
                    onClick={() => setMine(mine.filter((x) => x !== m))}
                    className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white"
                    aria-label={t("{name} 빼기", { name: m.name })}
                  >
                    {m.name} <Glyph e="✕" className="ml-0.5 h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="text-sm font-bold">{t("출발 날짜")}</p>
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <button
                key={d}
                onClick={() => {
                  setDay(d);
                  if (d > 0 && hour === null) setHour(10);
                  if (d === 0 && hour !== null && hour <= kstHour()) setHour(null);
                }}
                className={chip(day === d)}
              >
                {d === 0 ? t("오늘") : d === 1 ? t("내일") : now === null ? `+${d}` : weekdayName(kstDay(d, now))}
                {d > 1 && now !== null && [0, 6].includes(kstDay(d, now)) && <span className="ml-1 text-[10px] text-rose-400">●</span>}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm font-bold">{t("출발 시각")}</p>
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
            {day === 0 && (
              <button onClick={() => setHour(null)} className={chip(hour === null)}>
                {t("지금")}
              </button>
            )}
            {HOURS.filter((h) => day > 0 || h > hourNow).map((h) => (
              <button key={h} onClick={() => setHour(h)} className={chip(hour === h)}>
                {t("{h}시", { h })}
              </button>
            ))}
          </div>
          {(day > 0 || (hour !== null && now !== null && hour - hourNow > 10)) && (
            <p className="mt-2 text-[11px] text-gray-500">{t("12시간 뒤부터는 지하철 승하차로 본 요일·시간대 패턴으로 예측해요")}</p>
          )}
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
            {INTERESTS.filter((i) => kakao || !i.kakao).map((i) => {
              const on = interests.includes(i.id);
              return (
                <button
                  key={i.id}
                  onClick={() => setInterests(on ? interests.filter((x) => x !== i.id) : [...interests, i.id])}
                  aria-pressed={on}
                  className={chip(on)}
                >
                  <Glyph e={i.emoji} /> {t(i.label)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-sm font-bold">{t("이동")}</p>
          <div className="mt-2 flex gap-2">
            {(["transit", "walk", "car"] as const).map((m) => (
              <button key={m} onClick={() => setTransport(m)} className={chip(transport === m)}>
                <Glyph e={m === "transit" ? "🚇" : m === "walk" ? "🚶" : "🚗"} /> {m === "transit" ? t("대중교통") : m === "walk" ? t("걷기 위주") : t("자동차")}
              </button>
            ))}
          </div>
        </div>

        <button onClick={plan} disabled={busy} className="w-full rounded-2xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-sm">
          {busy ? t("코스를 짜는 중…") : t("한산한 코스 만들기")}
        </button>
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        {notice && (
          <p className="rounded-2xl bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900">
            <Glyph e="🌙" /> {notice}
          </p>
        )}
      </section>

      <section className="mt-8 lg:mt-0">
        {replanned && result && (
          <p className="mb-3 rounded-2xl bg-indigo-50 px-4 py-2.5 text-xs font-semibold text-indigo-800">
            ↻ {t("{name}에서 다시 짠 코스예요", { name: replanned })}
          </p>
        )}
        {result ? <RouteResult start={start!} {...result} onReplan={busy ? undefined : replanFrom} /> : <Intro />}
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

export interface RouteResponse {
  plan: RoutePlan;
  startMin: number;
  locked: number;
  beta: boolean;
  shareId?: string;
  /** 코스 시간대 날씨 경고 (비·초미세먼지) */
  warnings?: string[];
}

/** 코스 결과 (코스 추천 화면과 공유 페이지 /r/{id} 에서 함께 쓴다) */
export function RouteResult({
  start,
  plan,
  locked,
  beta,
  shareId,
  onReplan,
  createdOn,
  warnings,
}: {
  start: LatLng & { name: string };
  plan: RoutePlan;
  locked: number;
  beta: boolean;
  shareId?: string;
  /** i번째 장소부터 다시 짜기 (공유 페이지에서는 없음) */
  onReplan?: (i: number) => void;
  /** 코스를 만든 날 (공유 페이지: '내일'을 그날 기준으로) */
  createdOn?: string;
  warnings?: string[];
}) {
  const { t, lang, lp } = useI18n();
  const [shared, setShared] = useState(false);
  // 내 여행 계획에 저장 (마이페이지에 모인다, 로그인하면 기기 사이 동기화)
  const { has: isSaved, add: addPlan, remove: removePlan } = usePlans();
  const inPlans = !!shareId && isSaved(shareId);
  const toggleSave = () => {
    if (!shareId || !plan.stops.length) return;
    if (inPlans) return removePlan(shareId);
    const day = new Date(base + Math.floor(plan.stops[0].arrive / 1440) * 86_400_000).toISOString().slice(0, 10);
    addPlan({ id: shareId, start: start.name, day, stops: plan.stops.filter((s) => !s.meal).map((s) => s.name), savedAt: new Date().toISOString() });
  };
  const share = async () => {
    if (!shareId) return;
    const url = `${window.location.origin}${lp(`/r/${shareId}`)}`;
    try {
      if (navigator.share) await navigator.share({ title: t("한산한 코스"), url });
      else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 2500);
      }
    } catch {}
  };
  const base = createdOn ? Date.parse(`${createdOn}T00:00:00Z`) : Date.now() + 9 * 3600_000;
  // 코스 시각(분)의 기준 날짜가 한국 기준 오늘부터 며칠 뒤인지 (공유 코스는 만든 날 기준) → 외국어 화면의 '내 시간'
  const planDay = Math.round(
    (Date.parse(`${new Date(base).toISOString().slice(0, 10)}T00:00:00Z`) -
      Date.parse(`${new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)}T00:00:00Z`)) /
      86_400_000,
  );
  /** 캘린더 파일(.ics): 장소마다 일정 하나 (한국 시각 → UTC) */
  const downloadIcs = () => {
    const day0 = Date.parse(`${new Date(base).toISOString().slice(0, 10)}T00:00:00Z`) - 9 * 3600_000;
    const stamp = (min: number) =>
      new Date(day0 + min * 60_000)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    // iCalendar 글자 규칙: 쉼표·세미콜론·역슬래시 앞에 역슬래시
    const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`);
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CrowdView//Route//KO", "CALSCALE:GREGORIAN"];
    plan.stops.forEach((s, i) =>
      lines.push(
        "BEGIN:VEVENT",
        `UID:${shareId ?? "route"}-${i}@crowdview.app`,
        `DTSTAMP:${stamp(0)}`,
        `DTSTART:${stamp(s.arrive)}`,
        `DTEND:${stamp(s.leave)}`,
        `SUMMARY:${esc(`${s.meal ? "🍽️ " : `${i + 1}. `}${s.name}`)}`,
        `GEO:${s.lat};${s.lng}`,
        `URL:https://crowdview.app${lp(s.href)}`,
        "END:VEVENT",
      ),
    );
    lines.push("END:VCALENDAR");
    const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "crowdview-route.ics";
    a.click();
    URL.revokeObjectURL(url);
  };
  // 공유 페이지는 나중에 열어 볼 수 있어서 '내일' 대신 늘 날짜로
  const dayLabel = (m: number) => {
    const d = Math.floor(m / 1440);
    const date = new Intl.DateTimeFormat(lang, { month: "numeric", day: "numeric", weekday: "short", timeZone: "UTC" }).format(
      new Date(base + d * 86_400_000),
    );
    if (createdOn) return `${date} `;
    return d === 0 ? "" : `${d === 1 ? t("내일") : date} `;
  };
  if (!plan.stops.length)
    return <EmptyState name="raccoon">{t("조건에 맞는 곳을 찾지 못했어요. 관심사를 늘리거나 대중교통·일정을 바꿔 보세요.")}</EmptyState>;
  const saved = plan.peakAvgScore - plan.avgScore;
  const points = [start, ...plan.stops.map((s) => ({ lat: s.lat, lng: s.lng, name: s.name, score: s.meal ? undefined : s.score, meal: !!s.meal }))];
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-lg font-bold">
            {t("{n}곳 코스", { n: plan.stops.length + locked })} · {dayLabel(plan.stops[0].arrive)}
            {clock(plan.stops[0].arrive - plan.stops[0].travelMin)}~{clock(plan.endMin)}
            <LocalTime hour={(plan.stops[0].arrive - plan.stops[0].travelMin) / 60} to={plan.endMin / 60} dayOffset={planDay} />
          </p>
          <p className="text-sm text-gray-600">
            {t("평균 예상 혼잡")} <b style={{ color: inkOf(levelOf(plan.avgScore).color) }}>{t(levelOf(plan.avgScore).label)}</b>
            {saved > 5 && <> · {t("가장 붐빌 때보다 {n}점 한산", { n: saved })}</>}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          {beta && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">{t("베타 무료")}</span>}
          <button onClick={downloadIcs} className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700" title={t("캘린더에 넣기")}>
            <Glyph e="📅" /> {t("캘린더")}
          </button>
          {shareId && (
            <button
              onClick={toggleSave}
              aria-pressed={inPlans}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${inPlans ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700"}`}
            >
              <Glyph e={inPlans ? "✓" : "💾"} /> {inPlans ? t("저장됨") : t("저장")}
            </button>
          )}
          {shareId && (
            <button onClick={share} className="rounded-full bg-gray-900 px-3 py-1.5 text-xs font-bold text-white">
              <Glyph e={shared ? "✓" : "🔗"} /> {shared ? t("링크를 복사했어요") : t("공유")}
            </button>
          )}
        </span>
      </div>

      {!!warnings?.length && (
        <ul className="mt-3 space-y-1 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {warnings.map((w) => (
            <li key={w}>
              <Glyph e="⚠️" /> {w}
            </li>
          ))}
        </ul>
      )}
      <RouteMap points={points} />

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
                <Glyph e={s.walk ? "🚶" : s.car ? "🚗" : "🚇"} /> {s.lines?.length ? <>{s.lines.map((l) => lineName(t, l)).join(" → ")} · </> : null}
                {t("{n}분", { n: s.travelMin })} · {s.travelKm}km · <span className="text-indigo-600">{t("길찾기")} ›</span>
              </a>
              <Link
                href={s.href}
                className={`flex items-center gap-3 rounded-2xl border p-2.5 pr-4 ${s.meal ? "border-amber-100 bg-amber-50/60" : "border-gray-100 bg-white"}`}
              >
                {/* 사진(있으면) 위에 순서 번호 */}
                <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-indigo-50 to-sky-100">
                  {s.img ? (
                    <Image src={s.img} alt="" fill sizes="64px" unoptimized={!canOptimize(s.img)} className="object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-gray-500">
                      <Glyph e={s.meal ? "🍽️" : "📍"} className="h-6 w-6" />
                    </span>
                  )}
                  <span
                    className={`absolute top-1 left-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shadow ${s.meal ? "bg-amber-500" : "bg-indigo-600"}`}
                  >
                    {s.meal ? <Glyph e="🍽️" className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-gray-500">
                    {clock(s.arrive)}~{clock(s.leave)}
                    {s.meal && <> · {t(s.meal === "lunch" ? "점심" : "저녁")}</>}
                  </span>
                  <span className="block truncate text-sm font-bold">
                    {s.picked && <Glyph e="★" className="mr-1 h-3.5 w-3.5 text-amber-400" />}
                    {s.name}
                  </span>
                  {/* 왜 이 시간에 가는지 */}
                  {!s.meal && s.calm ? (
                    <span className="block text-[11px] text-emerald-700">{t("하루 중 가장 한산한 시간에 도착해요")}</span>
                  ) : (
                    !s.meal &&
                    s.peak &&
                    s.peak.score - s.score >= 15 && (
                      <span className="block text-[11px] text-emerald-700">
                        {t("{h}시({level})를 피해서 가요", { h: s.peak.hour, level: t(levelOf(s.peak.score).label) })}
                      </span>
                    )
                  )}
                  {s.waitMin && (
                    <span className="block text-[11px] text-amber-700">
                      {t("{time} 개장까지 {n}분 기다려요", { time: clock(s.arrive), n: s.waitMin })}
                    </span>
                  )}
                </span>
                {!s.meal && (
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <LevelBadge score={s.score} />
                    {s.predicted && <span className="text-[10px] text-gray-500">{t("패턴 예측")}</span>}
                  </span>
                )}
              </Link>
              {onReplan && i < plan.stops.length - 1 && (
                <button onClick={() => onReplan(i)} className="mt-1 ml-auto block px-2 text-[11px] font-semibold text-indigo-600">
                  ↻ {t("여기서부터 다시 짜기")}
                </button>
              )}
            </li>
          );
        })}
      </ol>

      {plan.missedPicks && plan.missedPicks.length > 0 && (
        <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {t("시간·운영 시간이 맞지 않아 못 넣은 곳: {names}. 일정을 늘리거나 출발 시각을 바꿔 보세요.", { names: plan.missedPicks.join(", ") })}
        </p>
      )}
      {locked > 0 && (
        <Link href="/pricing" className="mt-3 block rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-4 text-white">
          <p className="flex items-center gap-1 text-sm font-bold">
            <Glyph e="🔒" className="h-4 w-4" /> {t("나머지 {n}곳은 Plus에서 볼 수 있어요", { n: locked })}
          </p>
          <p className="text-xs text-white/80">{t("전체 시간표 · 붐비면 다시 짜기 · 1개월 3,900원")}</p>
        </Link>
      )}
      <p className="mt-4 text-[11px] leading-relaxed text-gray-500">
        {t(
          "예상 혼잡은 서울시 실시간 도시데이터와 CrowdView 예측이에요. 이동시간은 서울시 지하철 역간 소요시간과 걷는 거리로 어림한 값이라 실제와 다를 수 있어요. 식사는 서울 여행 가이드 맛집 중 가까운 곳이에요.",
        )}
        {plan.stops.some((s) => s.predicted) && ` ${t("‘패턴 예측’은 서울시 12시간 예측 밖이라 가까운 역의 요일·시간대 승하차로 어림한 값이에요.")}`}
      </p>
    </div>
  );
}
