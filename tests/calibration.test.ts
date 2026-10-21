// 실측과 비교해 예측 모델 고치기 (10/21): 보정 칸, 종류 평균, 주말/평일 방문객 비
import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyCells, factorsOf, poolCells, stepCells } from "@/lib/crowd/calibration";
import { cellOf, expectedScore, weekendFactor } from "@/lib/crowd/model";
import { weekRatioFrom } from "@/lib/region-visitors";
import { PLACES } from "@/lib/places";
import { addDays } from "@/lib/time";

test("보정 칸: 평일 0~23, 주말·공휴일 24~47", () => {
  assert.equal(cellOf({ date: "2026-10-21", day: 3, hour: 14.5 }), 14);
  assert.equal(cellOf({ date: "2026-10-24", day: 6, hour: 9 }), 33);
  assert.equal(cellOf({ date: "2026-10-09", day: 5, hour: 9 }, new Map([["2026-10-09", "한글날"]])), 33);
});

test("보정: 모델이 계속 낮게 보면 그 칸 배율이 1보다 커지고, 쌓인 수가 적으면 덜 믿는다", () => {
  let c = emptyCells();
  c = stepCells(c, 14, 40, 60);
  const one = factorsOf(c)[14];
  for (let i = 0; i < 30; i++) c = stepCells(c, 14, 40, 60);
  const many = factorsOf(c)[14];
  assert.ok(one > 1 && one < many, `${one} < ${many}`);
  // 실제/모델 = 65/45 ≈ 1.44 쪽으로 다가간다
  assert.ok(many > 1.3 && many < 1.45, String(many));
  // 다른 칸은 그대로 1
  assert.equal(factorsOf(c)[15], 1);
});

test("보정 배율은 0.6 ~ 1.6, 다른 장소로 옮길 땐 절반만", () => {
  let c = emptyCells();
  for (let i = 0; i < 99; i++) c = stepCells(c, 10, 10, 95);
  assert.equal(factorsOf(c)[10], 1.6);
  for (let i = 0; i < 99; i++) c = stepCells(c, 11, 95, 0);
  assert.equal(factorsOf(c)[11], 0.6);
  let d = emptyCells();
  for (let i = 0; i < 99; i++) d = stepCells(d, 12, 50, 60);
  const full = Math.log(factorsOf(d)[12]);
  const half = Math.log(factorsOf(d, 0.5)[12]);
  assert.ok(Math.abs(half - full / 2) < 0.01);
});

test("종류 평균: 비교 수로 가중", () => {
  let a = emptyCells();
  let b = emptyCells();
  for (let i = 0; i < 3; i++) a = stepCells(a, 5, 50, 60);
  b = stepCells(b, 5, 50, 40);
  const p = poolCells([a, b]);
  assert.equal(p.n[5], 4);
  assert.ok(Math.abs(p.v[5] - (a.v[5] * 3 + b.v[5]) / 4) < 1e-9);
});

test("모델에 보정 배율이 곱해진다 (그 칸만)", () => {
  const place = PLACES.find((p) => p.themeparksId)!;
  const t = { date: "2026-10-21", day: 3, hour: 14.5 };
  const calib = Array(48).fill(1);
  calib[14] = 0.5;
  const raw = expectedScore(place, t, {});
  assert.ok(raw > 10);
  assert.equal(Math.round(expectedScore(place, t, { calib })), Math.round(raw * 0.5));
  assert.equal(expectedScore(place, { ...t, hour: 15.5 }, { calib }), expectedScore(place, { ...t, hour: 15.5 }, {}));
});

test("주말/평일 방문객 비: 중앙값 비, 표본이 적으면 없음, 1~3", () => {
  // 2026-10-05(월)부터 6주: 평일 1000, 주말 2500, 연휴 하루 5000이 섞여도 중앙값이라 2.5
  const days = Array.from({ length: 42 }, (_, i) => {
    const date = addDays("2026-10-05", i);
    const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
    return { date, visitors: i === 3 ? 5000 : wd === 0 || wd === 6 ? 2500 : 1000 };
  });
  assert.equal(weekRatioFrom(days), 2.5);
  assert.equal(weekRatioFrom(days.slice(0, 7)), undefined);
  assert.equal(weekRatioFrom(days.map((d) => ({ ...d, visitors: d.visitors * (d.visitors === 2500 ? 4 : 1) }))), 3);
  // 모델 주말 배율: 없으면 1.2, 있으면 평일 0.75 × 비 (0.8 ~ 1.8)
  assert.equal(weekendFactor(), 1.2);
  assert.equal(weekendFactor(2), 1.5);
  assert.equal(weekendFactor(3), 1.8);
  assert.equal(weekendFactor(1), 0.8);
});
