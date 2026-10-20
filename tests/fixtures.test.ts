// 고정 자료 모드 (tests/fixtures): 정상·오래됨·이상·빈 응답·시간 초과에서 서울 실시간·공항 주차가 어떻게 되는지.
// 받는 데 성공해도 내용이 이상하면 쓰지 않는다 (QA 10/21 SEOUL-S02·DATA-S02·AIR-S02)
import assert from "node:assert/strict";
import { test } from "node:test";
import { getParking } from "@/lib/airport";
import { PLACES } from "@/lib/places";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { getAllSeoulLive, parseSeoulRow, SEOUL_STALE_MIN } from "@/lib/seoul-live";

const as = async <T>(scenario: string, fn: () => Promise<T>): Promise<T> => {
  process.env.DATA_FIXTURES = scenario;
  try {
    return await fn();
  } finally {
    delete process.env.DATA_FIXTURES;
  }
};
const icn1 = PLACES.find((p) => p.airport === "ICN1")!;
const kstAgo = (min: number) => new Date(Date.now() + 9 * 3600_000 - min * 60_000).toISOString().slice(0, 16).replace("T", " ");
const row = (over: Record<string, unknown> = {}) => ({
  AREA_CONGEST_LVL: "보통",
  AREA_PPLTN_MIN: "1000",
  AREA_PPLTN_MAX: "2000",
  PPLTN_TIME: kstAgo(10),
  ...over,
});

test("서울 응답 검사: 정상은 통과, 이상한 값은 버린다", () => {
  const ok = parseSeoulRow(row(), "x");
  assert.equal(ok.score, 48);
  assert.deepEqual([ok.min, ok.max], [1000, 2000]);
  assert.throws(() => parseSeoulRow(row({ AREA_CONGEST_LVL: "알수없음" }), "x"), /unexpected/);
  assert.throws(() => parseSeoulRow(row({ AREA_PPLTN_MIN: "-1" }), "x"), /인구 범위/);
  assert.throws(() => parseSeoulRow(row({ AREA_PPLTN_MIN: "3000" }), "x"), /인구 범위/);
  assert.throws(() => parseSeoulRow(row({ AREA_PPLTN_MAX: "많음" }), "x"), /인구 범위/);
  assert.throws(() => parseSeoulRow(row({ PPLTN_TIME: "" }), "x"), /시각 없음/);
  assert.throws(() => parseSeoulRow(row({ PPLTN_TIME: kstAgo(-60) }), "x"), /미래/);
  assert.throws(() => parseSeoulRow(row({ PPLTN_TIME: kstAgo(SEOUL_STALE_MIN + 1) }), "x"), /오래된/);
  assert.doesNotThrow(() => parseSeoulRow(row({ PPLTN_TIME: kstAgo(SEOUL_STALE_MIN - 1) }), "x"));
  assert.equal(parseSeoulRow(row({ FCST_PPLTN: [{ FCST_TIME: "t", FCST_CONGEST_LVL: "??", FCST_PPLTN_MIN: "1", FCST_PPLTN_MAX: "2" }] }), "x").forecast.length, 0);
});

test("normal: 서울 모든 지역이 실시간으로, 성수카페거리는 정해 둔 값", async () => {
  const all = await as("normal", getAllSeoulLive);
  assert.equal(Object.keys(all).length, SEOUL_AREAS.length);
  const seongsu = all[SEOUL_AREAS.find((a) => a.name === "성수카페거리")!.code];
  assert.equal(seongsu.level, "붐빔");
  assert.deepEqual([seongsu.min, seongsu.max], [30000, 32000]);
  assert.equal(seongsu.forecast.length, 3);
  for (const v of Object.values(all)) assert.ok(v.min >= 0 && v.min <= v.max);
});

test("stale: 3시간 전 자료는 실시간으로 쓰지 않는다", async () => {
  assert.equal(Object.keys(await as("stale", getAllSeoulLive)).length, 0);
});

test("invalid: 모르는 단계·음수·최소>최대·미래 시각은 하나도 채택하지 않는다", async () => {
  assert.equal(Object.keys(await as("invalid", getAllSeoulLive)).length, 0);
});

test("empty·timeout: 서울시가 아무것도 주지 않으면 빈 결과 (오류로 멈추지 않는다)", async () => {
  assert.deepEqual(await as("empty", getAllSeoulLive), {});
  assert.deepEqual(await as("timeout", getAllSeoulLive), {});
});

test("공항 주차: 정상 / 면수 초과·음수·숫자 아님 정리 / 빈 응답", async () => {
  const normal = await as("normal", () => getParking(icn1));
  assert.equal(normal.length, 2); // T1만
  assert.deepEqual(
    normal.map((l) => [l.occupied, l.total, l.rate]),
    [
      [1200, 3000, 40],
      [9000, 10000, 90],
    ],
  );
  const bad = await as("invalid", () => getParking(icn1));
  assert.deepEqual(
    bad.map((l) => [l.occupied, l.total, l.rate]),
    [
      [3000, 3000, 100],
      [0, 10000, 0],
    ],
  );
  assert.deepEqual(await as("empty", () => getParking(icn1)), []);
  assert.deepEqual(await as("timeout", () => getParking(icn1)), []);
});
