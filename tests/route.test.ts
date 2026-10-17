// 코스 계산 (lib/route): 시간 안에 끝나기, 덜 붐빌 때 도착, 식사 넣기, 담은 곳 먼저, 날짜 넘어가는 운영 시간
import assert from "node:assert/strict";
import { test } from "node:test";
import { planRoute, type Candidate, type MealSpot, type RouteRequest } from "@/lib/route";

const at = (lat: number, lng: number) => ({ lat, lng });
const cand = (id: string, lat: number, lng: number, over: Partial<Candidate> = {}): Candidate => ({
  id,
  name: id,
  href: `/x/${id}`,
  ...at(lat, lng),
  interest: "history",
  stay: 60,
  hourly: {},
  now: 40,
  basis: "seoul",
  ...over,
});
// 서울 도심에 1km 남짓 떨어진 후보들
const ALL = [cand("a", 37.57, 126.98), cand("b", 37.58, 126.99), cand("c", 37.56, 127.0), cand("d", 37.55, 126.97), cand("e", 37.585, 126.97)];
const req = (over: Partial<RouteRequest> = {}): RouteRequest => ({
  start: { lat: 37.565, lng: 126.978, name: "출발" },
  startMin: 9 * 60,
  durationMin: 240,
  interests: ["history"],
  transport: "transit",
  ...over,
});

test("일정 안에서 끝나고 같은 곳을 두 번 들르지 않는다", () => {
  const p = planRoute(ALL, req());
  assert.ok(p.stops.length >= 2);
  assert.ok(p.endMin <= 9 * 60 + 240);
  assert.equal(new Set(p.stops.map((s) => s.id)).size, p.stops.length);
  for (let i = 1; i < p.stops.length; i++) assert.ok(p.stops[i].arrive >= p.stops[i - 1].leave);
});

test("덜 붐비는 시간에 도착하도록 고른다", () => {
  // a는 9~10시만 한산, 11시부터 매우 혼잡
  const all = ALL.map((c) => (c.id === "a" ? { ...c, hourly: { 9: 5, 10: 5, 11: 90, 12: 90 } } : c));
  const p = planRoute(all, req({ durationMin: 180 }));
  const a = p.stops.find((s) => s.id === "a");
  assert.ok(a, "a가 들어가야 한다");
  assert.ok(Math.floor(a.arrive / 60) <= 10);
});

test("점심 시간에 걸치면 가까운 맛집을 넣는다", () => {
  // 후보마다 바로 옆에 식당 하나씩 (맛집 후보는 1.2km 안에서만 고른다)
  const meals: MealSpot[] = ALL.map((c) => ({ id: `food-${c.id}`, name: "식당", href: "/guide/x", ...at(c.lat + 0.001, c.lng) }));
  const p = planRoute(ALL, req({ startMin: 10 * 60, durationMin: 300 }), { meals });
  const lunch = p.stops.find((s) => s.meal === "lunch");
  assert.ok(lunch, "점심이 들어가야 한다");
  assert.ok(lunch.arrive >= 10 * 60 + 30 && lunch.arrive <= 13 * 60);
});

test("담은 곳은 관심사가 달라도 먼저 넣고, 못 넣으면 알려 준다", () => {
  const far = cand("far", 37.4, 127.3, { interest: "nature", stay: 200 });
  const near = cand("near", 37.566, 126.99, { interest: "fun" });
  const p = planRoute(ALL, req({ durationMin: 150 }), { must: [near, far] });
  assert.ok(p.stops.some((s) => s.id === "near" && s.picked));
  assert.deepEqual(p.missedPicks, ["far"]);
});

test("내일 출발이면 운영 시간을 그날 기준으로 본다", () => {
  const shop = cand("shop", 37.57, 126.985, { hours: [10, 20] });
  const p = planRoute([shop], req({ startMin: 1440 + 9 * 60, durationMin: 240 }));
  assert.equal(p.stops.length, 1);
  assert.ok(p.stops[0].arrive >= 1440 + 10 * 60, "내일 10시 전에는 들어갈 수 없다");
});

test("예측 함수가 있으면 hourly에 없는 시간에 쓰고 '예측'으로 표시한다", () => {
  const c = cand("p", 37.57, 126.98, { hourly: {}, predict: () => 12, now: 80 });
  const p = planRoute([c], req());
  assert.equal(p.stops[0].score, 12);
  assert.equal(p.stops[0].predicted, true);
});

test("다시 짜기: 이미 들른 곳(exclude)은 다시 넣지 않는다", () => {
  const p = planRoute(ALL, req(), { exclude: ["a", "b"] });
  assert.ok(p.stops.length > 0);
  assert.ok(!p.stops.some((s) => s.id === "a" || s.id === "b"));
});

test("이유 설명: 가장 한산한 시간 도착(calm)과 개장 대기(waitMin)를 표시한다", () => {
  const calm = cand("calm", 37.57, 126.98, { hourly: { 9: 10, 10: 60, 11: 70, 12: 70, 13: 70, 14: 70, 15: 70, 16: 70, 17: 70, 18: 70, 19: 70, 20: 70, 21: 70 } });
  const p1 = planRoute([calm], req());
  assert.equal(p1.stops[0].calm, true);
  const shop = cand("shop", 37.57, 126.985, { hours: [10, 20] });
  const p2 = planRoute([shop], req({ startMin: 9 * 60 }));
  assert.ok((p2.stops[0].waitMin ?? 0) > 0);
});
