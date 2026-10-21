"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { LEVELS, deepOf, inkOf } from "@/lib/levels";
import { Glyph } from "@/components/Glyph";

interface Summary {
  count: number;
  avgLevel?: number;
  avgWait?: number;
  latest?: string;
}

/**
 * 현장 혼잡 제보: "지금 여기 계세요?" → 5단계 중 하나 (+ 놀이공원은 줄 선 시간).
 * 최근 3시간 제보를 모아 보여 준다. 레퍼런스: Queue-Times 'Submit queue time'
 */
export function CrowdReport({ placeId, askWait = false }: { placeId: string; askWait?: boolean }) {
  const { t } = useI18n();
  const [sum, setSum] = useState<Summary | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [wait, setWait] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/report?placeId=${encodeURIComponent(placeId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setSum)
      .catch(() => {});
  }, [placeId]);

  const send = async () => {
    if (!level) return;
    setState("busy");
    setError(null);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ placeId, level, ...(askWait && wait !== "" && { waitMin: Number(wait) }) }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setSum(j);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };

  const avg = sum?.avgLevel !== undefined ? LEVELS[Math.min(4, Math.max(0, Math.round(sum.avgLevel) - 1))] : undefined;
  const ago = sum?.latest ? Math.max(1, Math.round((Date.now() - Date.parse(sum.latest)) / 60_000)) : undefined;

  return (
    <section className="card mt-4">
      <p className="flex items-center gap-1.5 text-sm font-bold">
        <Glyph e="📣" className="h-4 w-4 text-indigo-500" /> {t("방문자 제보")}
      </p>
      {sum && sum.count > 0 && avg ? (
        <p className="mt-1.5 text-[15px]">
          {t("최근 3시간 제보 {n}건", { n: sum.count })} · <b style={{ color: avg.color }}>{t(avg.label)}</b>
          {sum.avgWait !== undefined && <> · {t("줄 {n}분", { n: sum.avgWait })}</>}
          {ago !== undefined && <span className="text-sm text-gray-500"> · {t("{n}분 전", { n: ago })}</span>}
        </p>
      ) : (
        <p className="mt-1.5 text-sm text-gray-500">{t("최근 3시간 제보가 없어요.")}</p>
      )}

      {state === "done" ? (
        <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
          <Glyph e="✓" className="mr-1 h-4 w-4" />
          {t("고마워요! 다른 분들께 바로 보여요.")}
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm text-gray-700">{t("지금 여기 계세요? 체감 혼잡을 알려 주세요.")}</p>
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {LEVELS.map((l) => (
              <button
                key={l.key}
                onClick={() => setLevel(l.key)}
                aria-pressed={level === l.key}
                className={`min-h-11 rounded-xl px-1 text-[13px] font-bold ${level === l.key ? "text-white" : ""}`}
                style={level === l.key ? { background: l.color, color: deepOf(l.color) } : { background: `${l.color}1f`, color: inkOf(l.color) }}
              >
                {t(l.label)}
              </button>
            ))}
          </div>
          {level && (
            <div className="mt-2 flex items-center gap-2">
              {askWait && (
                <label className="flex items-center gap-1.5 text-sm text-gray-700">
                  {t("줄 선 시간")}
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={300}
                    value={wait}
                    onChange={(e) => setWait(e.target.value)}
                    className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                    placeholder="0"
                  />
                  {t("분")}
                </label>
              )}
              <button
                onClick={send}
                disabled={state === "busy"}
                className="ml-auto min-h-10 rounded-full bg-indigo-600 px-5 text-sm font-bold text-white disabled:opacity-60"
              >
                {t("보내기")}
              </button>
            </div>
          )}
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </>
      )}
    </section>
  );
}
