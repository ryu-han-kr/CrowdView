// 데이터 규칙 (QA 명세 10/21의 '반드시 성립해야 하는 조건'): 축제 상태 날짜 경계, 혼잡 단계 범위,
// 주차 수치, 가까운 순 정렬, 가이드 중복, 장소 id·행사 날짜, 명소 시군구 연결
import assert from "node:assert/strict";
import { test } from "node:test";
import landmarks from "@/data/korea/landmarks.json";
import spotRegion from "@/data/korea/spot-region.json";
import { parkingNumbers } from "@/lib/airport";
import { festivalStatus } from "@/lib/festivals";
import { distanceKm } from "@/lib/geo";
import { LEVELS, levelOf, scoreFromValue } from "@/lib/levels";
import { PLACES } from "@/lib/places";
import { dedupeGuide, GUIDE, nearest, type GuidePlace } from "@/lib/seoul-guide";
import { kst } from "@/lib/time";

test("EVENT-01·02: 축제 상태는 한국 날짜로, 시작·종료 당일은 진행 중", () => {
  const f = { start: "2026-09-24", end: "2026-10-18" };
  const at = (iso: string) => festivalStatus(f, kst(new Date(iso)).date);
  assert.equal(at("2026-09-23T14:59:00Z"), "upcoming"); // 9/23 23:59 KST
  assert.equal(at("2026-09-23T15:00:00Z"), "ongoing"); // 9/24 00:00 KST
  assert.equal(at("2026-10-18T14:59:00Z"), "ongoing"); // 10/18 23:59 KST
  assert.equal(at("2026-10-18T15:00:00Z"), "ended"); // 10/19 00:00 KST
  assert.equal(festivalStatus({ start: "2026-10-21", end: "2026-10-21" }, "2026-10-21"), "ongoing");
});

test("혼잡 단계: 0~100 점수가 빠짐없이 5단계 중 하나, 경계값은 위 단계", () => {
  for (let s = 0; s <= 100; s++) assert.ok(LEVELS.includes(levelOf(s)));
  assert.equal(levelOf(19.9).label, "한산");
  assert.equal(levelOf(20).label, "여유");
  assert.equal(levelOf(80).label, "매우 혼잡");
  assert.equal(levelOf(-5).label, "한산");
});

test("인원 → 점수: 인원이 늘면 점수가 줄지 않고 0 이상", () => {
  const steps: [number, number, number, number] = [1000, 2000, 3000, 4000];
  let prev = -1;
  for (let v = 0; v <= 8000; v += 50) {
    const s = scoreFromValue(v, steps);
    assert.ok(s >= 0, `${v}명 → ${s}`);
    assert.ok(s >= prev, `${v}명에서 점수가 줄었다`);
    prev = s;
  }
});

test("AIR-S02: 주차 수치 — 음수·숫자 아님은 0, 대수 ≤ 면수, 빈자리 = 면수 - 대수, 점유율 0~100", () => {
  assert.deepEqual(parkingNumbers(300, 1000), { occupied: 300, total: 1000, free: 700, rate: 30 });
  assert.deepEqual(parkingNumbers(1200, 1000), { occupied: 1000, total: 1000, free: 0, rate: 100 });
  assert.deepEqual(parkingNumbers(-5, 100), { occupied: 0, total: 100, free: 100, rate: 0 });
  assert.deepEqual(parkingNumbers("abc", undefined), { occupied: 0, total: 0, free: 0, rate: 0 });
  assert.deepEqual(parkingNumbers("12.6", "40"), { occupied: 13, total: 40, free: 27, rate: 33 });
});

test("NEAR-S02: 가까운 순은 직선거리(하버사인) 오름차순, 반경 밖은 뺀다", () => {
  const me = { lat: 37.5547, lng: 126.9706 }; // 서울역
  const items = [
    { id: "a", lat: 37.5665, lng: 126.978 }, // 시청 ~1.5km
    { id: "b", lat: 37.5559, lng: 126.9723 }, // 바로 옆
    { id: "c", lat: 37.5796, lng: 126.977 }, // 경복궁 ~2.8km
    { id: "d", lat: 37.5512, lng: 126.9882 }, // 남산 ~1.6km
  ];
  const got = nearest(items, me, (x) => x, 10, 2);
  assert.deepEqual(
    got.map((g) => g.item.id),
    ["b", "a", "d"],
  );
  for (const g of got) assert.ok(Math.abs(g.km - distanceKm(me, g.item)) < 1e-9);
});

test("EXP-03: 가이드 같은 곳 한 번만 — 같은 id, 같은 이름·200m 안. 멀리 떨어진 같은 이름(체인점)은 남긴다", () => {
  const p = (id: string, n: string, lat?: number, lng?: number): GuidePlace =>
    ({ id, kind: "food", lat, lng, t: { ko: { n, a: "", url: "" } } }) as GuidePlace;
  const out = dedupeGuide([
    p("1", "경교장", 37.56841, 126.96775),
    p("1", "경교장", 37.56841, 126.96775),
    p("2", "경교장", 37.5685, 126.9678),
    p("3", "스타벅스", 37.5, 127.0),
    p("4", "스타벅스", 37.6, 127.1),
    p("5", "이름만", undefined, undefined),
    p("6", "이름만", undefined, undefined),
  ]);
  assert.deepEqual(
    out.map((x) => x.id),
    ["1", "3", "4", "5", "6"],
  );
});

test("실제 가이드 자료: id가 겹치지 않는다", () => {
  assert.equal(new Set(GUIDE.map((p) => p.id)).size, GUIDE.length);
});

test("장소 id는 하나뿐이고, 행사 장소는 시작일 ≤ 종료일", () => {
  assert.equal(new Set(PLACES.map((p) => p.id)).size, PLACES.length);
  for (const p of PLACES.filter((x) => x.eventDate)) {
    assert.match(p.eventDate!, /^\d{4}-\d{2}-\d{2}$/);
    if (p.eventEndDate) assert.ok(p.eventDate! <= p.eventEndDate, p.id);
  }
});

test("명소 117곳 모두 데이터랩 시군구에 연결돼 있다", () => {
  const map = spotRegion as Record<string, { code: string; name: string }>;
  for (const l of landmarks as { id: string }[]) assert.ok(map[l.id]?.code?.match(/^\d{5}$/), l.id);
});
