// 방문자 제보로 보정 (QA 10/21 정확도 개선 5번): 최근 30일 제보 단계와 그때 우리가 보인 점수를 비교해 장소별로 몇 점 올리거나 내린다.
// 실측(서울시 지역·공항·놀이기구 대기)은 건드리지 않고, 예측·추정 값에만 쓴다. 제보가 5건 넘을 때만, ±15점 안에서, 건수가 적으면 덜 믿는다
import { kv } from "../cache";
import { pool, sql } from "../db";
import type { CrowdSnapshot, Place } from "../types";
import { getHistory } from "./history";
import { forecastForDate } from "./model";
import { kst } from "../time";

/** 제보 단계(1~5)의 대표 점수 (각 단계 가운데) */
const LEVEL_MID = [10, 30, 50, 70, 90];
const MIN_REPORTS = 5;
const MAX_SHIFT = 15;
const KEEP_SECONDS = 30 * 24 * 3600;

/** 순수 계산: (제보 점수 - 우리 점수) 평균을 건수로 줄이고 ±15로 자른다 */
export function biasFrom(diffs: number[]): number {
  if (diffs.length < MIN_REPORTS) return 0;
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const shrunk = (mean * diffs.length) / (diffs.length + 10);
  return Math.round(Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, shrunk)));
}

/** 그 시각 우리가 보인 점수: 실측 기록(8일)이 있으면 가장 가까운 기록, 없으면 그날 예측 곡선의 그 시 */
async function ourScoreAt(place: Place, at: Date): Promise<number | undefined> {
  const days = await getHistory(place.id, 8);
  const points = days.flatMap((d) => d.points).filter((p) => Math.abs(Date.parse(p.t) - at.getTime()) < 20 * 60_000);
  if (points.length) return points[0].score;
  const k = kst(at);
  return forecastForDate(place, k.date).find((p) => p.hour === Math.floor(k.hour))?.score;
}

/** 하루 한 번: 제보가 있는 장소마다 보정값을 다시 계산해 저장. 저장한 장소 수 */
export async function updateBiases(places: Place[]): Promise<number> {
  if (!pool) return 0;
  const rows = await sql<{ place_id: string; level: number; created_at: Date }>(
    "select place_id, level, created_at from crowd_report where created_at > now() - interval '30 days'",
  );
  let saved = 0;
  for (const place of places) {
    const mine = rows.filter((r) => r.place_id === place.id);
    if (mine.length < MIN_REPORTS) continue;
    const diffs: number[] = [];
    for (const r of mine) {
      const ours = await ourScoreAt(place, new Date(r.created_at));
      if (ours !== undefined) diffs.push(LEVEL_MID[r.level - 1] - ours);
    }
    await kv.set(`bias:${place.id}`, String(biasFrom(diffs)), KEEP_SECONDS).catch(() => {});
    saved++;
  }
  return saved;
}

/** 예측·추정 값에만 보정을 더한다 (실측 원천은 그대로) */
export async function withBias(snap: CrowdSnapshot): Promise<CrowdSnapshot> {
  if (snap.source !== "model" && snap.source !== "parking" && !snap.area) return snap;
  const shift = Number(await kv.get(`bias:${snap.placeId}`).catch(() => null)) || 0;
  if (!shift) return snap;
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n + shift)));
  return { ...snap, score: clamp(snap.score), hourly: snap.hourly.map((p) => ({ ...p, score: clamp(p.score) })) };
}
