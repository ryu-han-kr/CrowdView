// 주차장 실시간 주차 응답 읽기 (lib/crowd/parking parseParking): 명세를 모르는 상태에서도 주차면 목록·상태 필드를 찾는다
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseParking } from "@/lib/crowd/parking";

test("경로·필드를 지정하면 그대로 센다", () => {
  const json = {
    response: {
      body: {
        items: [
          { no: 1, parkingStatus: "1" },
          { no: 2, parkingStatus: "0" },
          { no: 3, parkingStatus: "1" },
        ],
      },
    },
  };
  assert.deepEqual(parseParking(json, "response.body.items;parkingStatus;1"), { occupied: 2, total: 3 });
});

test("지정이 없으면 가장 큰 객체 배열과 '상태'가 든 필드를 찾고, 입차·Y·1을 주차 중으로 본다", () => {
  const json = {
    meta: { count: 4 },
    data: [
      { spotNo: "B1-001", floor: "B1", inOutStatus: "입차" },
      { spotNo: "B1-002", floor: "B1", inOutStatus: "출차" },
      { spotNo: "B1-003", floor: "B1", inOutStatus: "Y" },
      { spotNo: "B1-004", floor: "B1", inOutStatus: "N" },
    ],
  };
  assert.deepEqual(parseParking(json), { occupied: 2, total: 4 });
  // 공식 면 수를 주면 전체는 그 값
  assert.deepEqual(parseParking(json, undefined, 1700), { occupied: 2, total: 1700 });
});

test("집계 응답(한 줄에 전체·주차 수)도 읽는다, 목록을 못 찾으면 undefined", () => {
  assert.deepEqual(parseParking({ items: [{ totalCnt: 1700, usedCnt: 830, status: "ok" }] }), { occupied: 830, total: 1700 });
  assert.equal(parseParking({ ok: true }), undefined);
  assert.equal(parseParking({ items: [{ a: 1 }] }), undefined);
});

test("강원랜드 실제 응답: data의 합계(totalParkingSpace·totalOccupancy)를 쓴다", () => {
  const json = {
    resultCode: 0,
    data: { lotAreaNo: 17925, totalParkingSpace: 2134, totalOccupancy: 1346, areaNos: [{ areaNo: 90, sections: [{ parkingSpace: 99, occupancy: 43 }] }] },
  };
  assert.deepEqual(parseParking(json, undefined, 1700), { occupied: 1346, total: 2134 });
});
