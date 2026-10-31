// 구글 장소 정보 (lib/google-facts): 운영 시간 해석·인기도 사전값·장소 반영
import assert from "node:assert/strict";
import { test } from "node:test";
import { dayHours } from "@/lib/crowd/model";
import {
  applyFacts,
  factsFromDetails,
  googleHoursOn,
  liveMeasured,
  popularityPriors,
  pushHist,
  reviewVelocity,
  specialDays,
  wantsFacts,
  weekHours,
  type GoogleFacts,
} from "@/lib/google-facts";
import { PLACES } from "@/lib/places";
import type { Place } from "@/lib/types";

const pt = (day: number, hour: number, minute = 0) => ({ day, hour, minute });

test("요일별 운영 시간: 구간 없는 요일은 휴무, 점심 휴식은 합치고, 밤샘은 24를 넘긴다", () => {
  const w = weekHours([
    { open: pt(1, 10), close: pt(1, 14) },
    { open: pt(1, 17, 30), close: pt(1, 22) },
    { open: pt(5, 18), close: pt(6, 2) },
    { open: pt(6, 10), close: pt(0, 0) },
  ])!;
  assert.deepEqual(w[1], [10, 22]);
  assert.deepEqual(w[5], [18, 26]);
  // 토 10시 ~ 일 0시 → [10, 24]
  assert.deepEqual(w[6], [10, 24]);
  assert.equal(w[0], null);
  assert.equal(w[2], null);
  assert.equal(weekHours([]), undefined);
  assert.equal(weekHours(undefined), undefined);
});

test("24시간 영업은 닫는 시각 없는 구간 하나 → 매일 [0, 24]", () => {
  const w = weekHours([{ open: pt(0, 0) }])!;
  assert.equal(w.length, 7);
  assert.ok(w.every((h) => h && h[0] === 0 && h[1] === 24));
});

test("특별 운영일: 그날 구간이 있으면 그 시간, 없으면 휴무", () => {
  const sp = specialDays({
    specialDays: [{ date: { year: 2026, month: 12, day: 25 } }, { date: { year: 2027, month: 1, day: 1 } }],
    periods: [{ open: { ...pt(5, 12), date: { year: 2026, month: 12, day: 25 } }, close: { ...pt(5, 18), date: { year: 2026, month: 12, day: 25 } } }],
  })!;
  assert.deepEqual(sp["2026-12-25"], [12, 18]);
  assert.equal(sp["2027-01-01"], null);
  assert.equal(specialDays({ periods: [] }), undefined);
  // 특별 운영일이 요일별보다 먼저
  const week = Array.from({ length: 7 }, () => [10, 20] as [number, number]);
  assert.deepEqual(googleHoursOn({ week, special: sp }, "2026-12-25"), [12, 18]);
  assert.deepEqual(googleHoursOn({ week, special: sp }, "2026-12-24"), [10, 20]);
  assert.equal(googleHoursOn({}, "2026-12-24"), undefined);
});

test("리뷰 수 기록·증가 속도: 같은 날은 바꿔 쓰고, 14일 넘게 쌓여야 속도", () => {
  let h = pushHist(undefined, "2026-10-01", 100);
  h = pushHist(h, "2026-10-01", 110);
  assert.deepEqual(h, [["2026-10-01", 110]]);
  h = pushHist(h, "2026-10-11", 130);
  assert.equal(reviewVelocity(h), undefined);
  h = pushHist(h, "2026-10-21", 170);
  assert.equal(reviewVelocity(h), 3);
  for (let i = 0; i < 20; i++) h = pushHist(h, `2027-01-${String(i + 1).padStart(2, "0")}`, 200 + i);
  assert.equal(h!.length, 12);
});

const mk = (id: string, popularity: number, extra: Partial<Place> = {}): Place =>
  ({ id, name: id, category: "indoor", popularity, hours: [10, 22], lat: 37.5, lng: 127, tags: [], ...extra }) as Place;
const facts = (count: number, extra: Partial<GoogleFacts> = {}): GoogleFacts => ({ gid: "g", count, at: "2026-10-31T00:00:00Z", ...extra });

test("인기도 사전값: 리뷰가 많은 곳은 올리고 적은 곳은 내리되, 최대 ±0.12, 카테고리 범위 안", () => {
  const places = [mk("a", 0.5), mk("b", 0.5), mk("c", 0.5), mk("d", 0.5), mk("e", 0.3), mk("f", 0.65)];
  const f = { a: facts(10), b: facts(100), c: facts(1000), d: facts(5000), e: facts(20), f: facts(30000) };
  const pr = popularityPriors(places, f);
  assert.ok(pr.get("d")! > 0.5 && pr.get("d")! <= 0.62);
  assert.ok(pr.get("a")! < 0.5 && pr.get("a")! >= 0.38);
  for (const v of pr.values()) assert.ok(v >= 0.3 - 1e-9 && v <= 0.65 + 0.12);
  // 리뷰 수 순서대로
  assert.ok(pr.get("a")! < pr.get("b")! && pr.get("b")! < pr.get("c")! && pr.get("c")! < pr.get("d")!);
});

test("인기도 사전값: 비교할 곳이 5곳 미만이면 없음, 실측 원천이 있는 곳은 빼고, 못 찾은 곳은 계산에서 뺀다", () => {
  const few = [mk("a", 0.5), mk("b", 0.5), mk("c", 0.5)];
  assert.equal(popularityPriors(few, { a: facts(1), b: facts(10), c: facts(100) }).size, 0);
  const places = [mk("a", 0.5), mk("b", 0.5), mk("c", 0.5), mk("d", 0.5), mk("e", 0.5, { seoulArea: "홍대 관광특구" }), mk("m", 0.5)];
  const pr = popularityPriors(places, { a: facts(1), b: facts(10), c: facts(100), d: facts(1000), e: facts(10000), m: { at: "x", miss: "검색 결과 없음", count: 5 } });
  assert.equal(pr.has("e"), false);
  assert.equal(pr.has("m"), false);
  assert.equal(pr.size, 4);
  assert.equal(liveMeasured(places[4]), true);
});

test("장소 반영: TourAPI 운영 시간이 없으면 구글 요일별 시간·휴무, 다른 날 예측도 요일별", () => {
  const week: ([number, number] | null)[] = [null, [9, 18], [9, 18], [9, 18], [9, 18], [9, 21], [10, 21]];
  const place = mk("x", 0.5);
  // 2026-11-02 월요일, 11-01 일요일
  const mon = applyFacts(place, facts(100, { week, rating: 4.4, uri: "https://maps.google.com/?cid=1" }), undefined, "2026-11-02");
  assert.deepEqual(mon.hours, [9, 18]);
  assert.equal(mon.info?.hoursVerified, true);
  assert.equal(mon.info?.hoursSource, "google");
  assert.equal(mon.info?.closedToday, undefined);
  assert.equal(mon.info?.google?.rating, 4.4);
  assert.equal(dayHours(mon, "2026-11-08", "2026-11-02"), null);
  assert.deepEqual(dayHours(mon, "2026-11-06", "2026-11-02"), [9, 21]);
  const sun = applyFacts(place, facts(100, { week }), undefined, "2026-11-01");
  assert.equal(sun.info?.closedToday, true);
  assert.deepEqual(sun.hours, [10, 22]);
});

test("장소 반영: TourAPI 운영 시간이 있으면 그대로 두고 구글 특별 휴무일만, 정보가 없으면 장소 그대로", () => {
  const place = mk("x", 0.5, { hours: [9, 17], info: { hoursVerified: true } });
  const f = facts(100, { week: Array(7).fill([10, 20]), special: { "2026-12-25": null } });
  const normal = applyFacts(place, f, undefined, "2026-12-24");
  assert.deepEqual(normal.hours, [9, 17]);
  assert.equal(normal.info?.week, undefined);
  assert.equal(normal.info?.closedToday, undefined);
  assert.equal(applyFacts(place, f, undefined, "2026-12-25").info?.closedToday, true);
  assert.equal(applyFacts(place, undefined), place);
  assert.equal(applyFacts(place, { at: "x", miss: "검색 결과 없음" }), place);
  assert.equal(applyFacts(place, facts(1), 0.6).popularity, 0.6);
});

test("Place Details 응답: 2km 넘게 떨어진 곳은 버리고(스키장 3km), 편의 정보는 '있음'만", () => {
  const p = mk("x", 0.5);
  const near = factsFromDetails(
    p,
    {
      id: "gid1",
      location: { latitude: 37.501, longitude: 127.001 },
      rating: 4.2,
      userRatingCount: 321,
      businessStatus: "OPERATIONAL",
      parkingOptions: { freeParkingLot: true, paidStreetParking: false },
      accessibilityOptions: { wheelchairAccessibleEntrance: true },
      goodForChildren: true,
      editorialSummary: { text: "소개" },
    },
    undefined,
    "2026-10-31T12:00:00Z",
    "2026-10-31",
  );
  assert.equal(near.miss, undefined);
  assert.equal(near.gid, "gid1");
  assert.deepEqual(near.amen, ["freeParkingLot", "wheelchairAccessibleEntrance", "goodForChildren"]);
  assert.deepEqual(near.hist, [["2026-10-31", 321]]);
  const far = factsFromDetails(p, { id: "g2", location: { latitude: 37.525, longitude: 127 } }, undefined, "t");
  assert.match(far.miss!, /km/);
  const ski = factsFromDetails({ ...p, category: "ski" }, { id: "g3", location: { latitude: 37.525, longitude: 127 } }, undefined, "t");
  assert.equal(ski.miss, undefined);
});

test("받을 장소: 한 곳짜리 시설만 (공항·축제·거리·해변 제외)", () => {
  const want = PLACES.filter(wantsFacts);
  assert.ok(want.length > 200);
  assert.ok(want.every((p) => p.category !== "airport" && p.category !== "event" && p.category !== "street" && p.category !== "beach"));
  assert.ok(want.some((p) => p.id === "everland"));
});
