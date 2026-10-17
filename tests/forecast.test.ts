// 내일·주말 예측 (lib/forecast): 요일 배수, 주말 출퇴근 꼭대기 누르기, 비율 맞추기
import assert from "node:assert/strict";
import { test } from "node:test";
import { load, makePredictor, shapeNear } from "@/lib/forecast";

// 평일 출퇴근 꼭대기가 있는 모양 (8시·18시)
const h = Array.from({ length: 24 }, (_, i) => (i === 8 || i === 18 ? 100 : i >= 10 && i <= 16 ? 50 : 10));
const shape = { h, d: [60, 110, 110, 110, 110, 110, 90] }; // 일~토

test("요일 배수가 반영된다 (월요일 > 일요일)", () => {
  // 오늘이 일요일(0)이면 absHour 24+12 = 월요일 12시
  assert.ok(load(shape, 24 + 12, 0) > load(shape, 12, 0));
});

test("주말에는 출근 시간 꼭대기를 낮 수준 아래로 누른다", () => {
  const sundayEight = load(shape, 8, 0);
  const mondayEight = load(shape, 24 + 8, 0);
  assert.ok(sundayEight < 0.6 * 50, `일요일 8시 ${sundayEight}`);
  assert.ok(mondayEight > 100);
});

test("알고 있는 점수에 맞춰 비율을 정하고 0~100 안에 둔다", () => {
  const predict = makePredictor(shape, { 12: 40, 13: 40 }, 1); // 오늘 월요일
  assert.ok(predict);
  assert.equal(predict(12), 40);
  const v = predict(18);
  assert.ok(v > 40 && v <= 100);
});

test("서울 도심에는 가까운 역의 모양이 있고, 바다 위에는 없다", () => {
  assert.ok(shapeNear({ lat: 37.4979, lng: 127.0276 }));
  assert.equal(shapeNear({ lat: 35.0, lng: 129.5 }), undefined);
});
