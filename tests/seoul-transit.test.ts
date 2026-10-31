// 서울시 전체판(citydata)의 지하철·버스 승하차·공영주차장 읽기 (lib/seoul-live) + 매시 기록 한 줄 (lib/seoul-extra-log)
// 자료는 10/31 21시 실제 응답(홍대 관광특구·여의도한강공원)에서 필요한 칸만 잘라 옮겼다
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseParkingShare, parseRidership } from "@/lib/seoul-live";
import { extraRow } from "@/lib/seoul-extra-log";

const SUB = {
  SUB_ACML_GTON_PPLTN_MIN: "174600",
  SUB_ACML_GTON_PPLTN_MAX: "174700",
  SUB_ACML_GTOFF_PPLTN_MIN: "231600",
  SUB_ACML_GTOFF_PPLTN_MAX: "231700",
  SUB_30WTHN_GTON_PPLTN_MIN: "10000",
  SUB_30WTHN_GTON_PPLTN_MAX: "10100",
  SUB_30WTHN_GTOFF_PPLTN_MIN: "7600",
  SUB_30WTHN_GTOFF_PPLTN_MAX: "7700",
  SUB_5WTHN_GTON_PPLTN_MIN: "2000",
  SUB_5WTHN_GTON_PPLTN_MAX: "2100",
  SUB_STN_CNT: "8",
  SUB_STN_TIME: "20261031",
};
const BUS = {
  BUS_ACML_GTON_PPLTN_MIN: "36100",
  BUS_ACML_GTON_PPLTN_MAX: "36200",
  BUS_ACML_GTOFF_PPLTN_MIN: "37800",
  BUS_ACML_GTOFF_PPLTN_MAX: "37900",
  BUS_30WTHN_GTON_PPLTN_MIN: "1600",
  BUS_30WTHN_GTON_PPLTN_MAX: "1700",
  BUS_30WTHN_GTOFF_PPLTN_MIN: "1100",
  BUS_30WTHN_GTOFF_PPLTN_MAX: "1200",
  BUS_STN_CNT: "70",
};
const NOW = Date.parse("2026-10-31T21:50:00+09:00");
const PRK = [
  { PRK_NM: "여의도한강공원1주차장", CPCTY: "462", CUR_PRK_CNT: "30", CUR_PRK_TIME: "2026-10-31 21:47:28", CUR_PRK_YN: "Y" },
  { PRK_NM: "여의도한강2주차장", CPCTY: "171", CUR_PRK_CNT: "156", CUR_PRK_TIME: "2026-10-31 21:47:59", CUR_PRK_YN: "Y" },
  // 실시간 없음 (대부분이 이렇다)
  { PRK_NM: "망원동 공영주차장", CPCTY: "59", CUR_PRK_CNT: "", CUR_PRK_TIME: "", CUR_PRK_YN: "N" },
  // 두 시간 전에 멈춘 곳은 뺀다
  { PRK_NM: "멈춘 주차장", CPCTY: "100", CUR_PRK_CNT: "100", CUR_PRK_TIME: "2026-10-31 19:40:00", CUR_PRK_YN: "Y" },
];

test("지하철·버스: 최소~최대의 가운데, 30분·오늘 누적·역 수", () => {
  assert.deepEqual(parseRidership(SUB, "SUB"), { in30: 10050, out30: 7650, inDay: 174650, outDay: 231650, stations: 8 });
  assert.deepEqual(parseRidership(BUS, "BUS"), { in30: 1650, out30: 1150, inDay: 36150, outDay: 37850, stations: 70 });
});

test("승하차 칸이 비면(새벽 1~5시 등) 없음 — 빈 문자열을 0으로 읽지 않는다", () => {
  assert.equal(parseRidership(undefined, "SUB"), undefined);
  assert.equal(parseRidership({ SUB_30WTHN_GTON_PPLTN_MIN: "", SUB_30WTHN_GTOFF_PPLTN_MIN: "" }, "SUB"), undefined);
});

test("주차: 실시간이고 1시간 안에 갱신된 곳만 합친다", () => {
  assert.deepEqual(parseParkingShare(PRK, NOW), { pct: 29, lots: 2, occupied: 186, capacity: 633 });
  assert.equal(parseParkingShare([PRK[2]], NOW), undefined);
  assert.equal(parseParkingShare(undefined, NOW), undefined);
  // 면수보다 많이 찍혀도 100%를 넘지 않는다
  assert.equal(parseParkingShare([{ CPCTY: "10", CUR_PRK_CNT: "12", CUR_PRK_YN: "Y" }], NOW)?.pct, 100);
});

test("매시 기록 한 줄: [지하철 30분 승·하, 버스 30분 승·하, 주차%, 지하철 누적 승·하, 버스 누적 승·하]", () => {
  const subway = parseRidership(SUB, "SUB");
  const bus = parseRidership(BUS, "BUS");
  assert.deepEqual(extraRow({ subway, bus }), [10050, 7650, 1650, 1150, null, 174650, 231650, 36150, 37850]);
  assert.deepEqual(extraRow({ parking: parseParkingShare(PRK, NOW) }), [null, null, null, null, 29, null, null, null, null]);
  assert.equal(extraRow({ bikes: 3 }), undefined);
});
