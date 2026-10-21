// 적응형 수집 주기 (lib/crowd/cadence): 운영 중 놀이공원 5분, 서울·공항 10분, 문 닫은 시간·추정 장소 30분
import assert from "node:assert/strict";
import { test } from "node:test";
import { IDLE_MIN, NORMAL_MIN, PEAK_MIN, activeNow, cadenceMinutes, isDue } from "@/lib/crowd/cadence";
import { PLACES } from "@/lib/places";

const at = (kstHour: number) => new Date(Date.UTC(2026, 9, 21, kstHour - 9, 0)); // 2026-10-21 수요일 KST
const by = (id: string) => PLACES.find((p) => p.id === id)!;

test("운영 중 실측 놀이공원은 5분, 서울시 지역·공항은 10분", () => {
  const everland = by("everland");
  assert.ok(everland.themeparksId || everland.queueTimesId);
  assert.equal(cadenceMinutes(everland, at(14)), PEAK_MIN);
  const seoulPlace = PLACES.find((p) => p.seoulArea && p.hours[1] - p.hours[0] < 24 && p.hours[0] <= 14 && p.hours[1] > 14)!;
  assert.equal(cadenceMinutes(seoulPlace, at(14)), NORMAL_MIN);
  const airport = PLACES.find((p) => p.airport)!;
  assert.equal(cadenceMinutes(airport, at(14)), NORMAL_MIN);
});

test("문 닫은 시간(개장 1시간 전·폐장 1시간 뒤 밖)과 실측 원천이 없는 장소는 30분", () => {
  const everland = by("everland");
  assert.equal(activeNow(everland, at(3)), false);
  assert.equal(cadenceMinutes(everland, at(3)), IDLE_MIN);
  // 개장 1시간 전부터는 운영 중처럼
  assert.equal(activeNow(everland, at(everland.hours[0] - 0.5)), true);
  const model = PLACES.find((p) => !p.seoulArea && !p.themeparksId && !p.queueTimesId && !p.airport)!;
  assert.equal(cadenceMinutes(model, at(14)), IDLE_MIN);
});

test("시즌이 아닌 스키장은 한여름 운영 시간이어도 30분", () => {
  const ski = PLACES.find((p) => p.category === "ski" && p.season)!;
  assert.equal(cadenceMinutes(ski, new Date(Date.UTC(2026, 6, 15, 5, 0))), IDLE_MIN);
});

test("마지막 수집 뒤 주기(−1분)만큼 지났을 때만 다시 받는다", () => {
  const everland = by("everland");
  const now = at(14);
  assert.equal(isDue(everland, undefined, now), true);
  assert.equal(isDue(everland, new Date(now.getTime() - 3 * 60_000).toISOString(), now), false);
  assert.equal(isDue(everland, new Date(now.getTime() - 4 * 60_000).toISOString(), now), true);
  const night = at(3);
  assert.equal(isDue(everland, new Date(night.getTime() - 20 * 60_000).toISOString(), night), false);
  assert.equal(isDue(everland, new Date(night.getTime() - 29 * 60_000).toISOString(), night), true);
});
