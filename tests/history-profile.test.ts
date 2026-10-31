// 과거 실측 이력 표 (src/data/history): 월 계절 지수 이어 붙이기·예측 모델 반영·조회 함수
import assert from "node:assert/strict";
import { test } from "node:test";
import { monthIndexAt, seasonFactor, seasonMonths } from "@/lib/crowd/season-index";
import { combineDongs, dayType, seoulHourly, seoulShape, sigunguIndex, sigunguOf, stationIndex, stationsNear } from "@/lib/history-profile";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { PLACES } from "@/lib/places";

const flat = Array(12).fill(1000);
const ramp = [800, 900, 1000, 1100, 1200, 1300, 1200, 1100, 1000, 900, 800, 700];

test("월 지수: 15일은 그 달 값, 사이는 직선, 12월→1월도 이어진다", () => {
  assert.equal(monthIndexAt(flat, "2026-07-03"), 1);
  assert.equal(monthIndexAt(ramp, "2026-03-15"), 1);
  const mid = monthIndexAt(ramp, "2026-03-31");
  assert.ok(mid > 1 && mid < 1.1);
  const jan = monthIndexAt(ramp, "2027-01-01");
  assert.ok(jan > 0.7 && jan < 0.8);
});

test("계절 배율: 같은 날이면 1, 표에 없으면 1, 0.85~1.2로 묶임", () => {
  const id = Object.keys(PLACES).length ? PLACES.find((p) => seasonMonths("place", p.id))!.id : "";
  assert.ok(id);
  assert.equal(seasonFactor("place", id, "2026-10-31", "2026-10-31"), 1);
  assert.equal(seasonFactor("place", "없는-장소", "2026-07-01", "2026-10-31"), 1);
  for (const p of PLACES) {
    const f = seasonFactor("place", p.id, "2027-01-15", "2026-10-31");
    assert.ok(f >= 0.85 && f <= 1.2, `${p.id} ${f}`);
  }
});

test("모든 장소에 시군구·월 지수가 있고, 서울 121곳 모두 행정동 몫이 있다", () => {
  for (const p of PLACES) {
    assert.ok(sigunguOf("place", p.id), `${p.id} 시군구 없음`);
    assert.equal(seasonMonths("place", p.id)?.length, 12, p.id);
  }
  // 서울대공원(과천)만 서울 밖이라 행정동 생활인구가 없다
  const missing = SEOUL_AREAS.filter((a) => seoulHourly("area", a.code, "2026-10-14", 0)?.length !== 24).map((a) => a.name);
  assert.deepEqual(missing, ["서울대공원"]);
});

test("서울 지역 시간대: 평일 낮이 새벽보다 많고, 모양은 최대 1", () => {
  const gangnam = SEOUL_AREAS.find((a) => a.name === "강남역")!;
  const h = seoulHourly("area", gangnam.code, "2026-10-14", dayType("2026-10-14"))!;
  assert.ok(h[14] > h[4] * 1.5, h.join(","));
  const shape = seoulShape("area", gangnam.code, "2026-10-14", 0)!;
  assert.equal(Math.max(...shape), 1);
});

test("행정동 몫 합치기 (순수 계산)", () => {
  const p = Array(576).fill(100);
  const out = combineDongs([["A", 0.5], ["B", 0.25], ["없음", 1]], { A: { p }, B: { p } })!;
  assert.equal(out[0], 75);
  assert.equal(combineDongs([["없음", 1]], {}), undefined);
});

test("일종류·시군구 지수·역", () => {
  assert.equal(dayType("2026-10-31"), 1); // 토
  assert.equal(dayType("2026-10-30"), 0);
  assert.equal(dayType("2026-10-30", new Set(["2026-10-30"])), 1);
  // 평창군: 스키철 휴일이 비수기 평일보다 붐빈다
  assert.ok(sigunguIndex("51760", "2026-01-10", 1)! > sigunguIndex("51760", "2026-03-10", 0)!);
  assert.equal(sigunguIndex("00000", "2026-01-10", 1), undefined);
  const lw = stationsNear("place", "lotteworld");
  assert.ok(lw.length > 0 && stationIndex(lw[0][0], "2026-05-05", 1)! > 0);
});
