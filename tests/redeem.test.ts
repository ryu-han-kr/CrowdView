// 이용 코드 목록 읽기 (10/28)
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCodes } from "@/lib/redeem";

test("코드:단계:일수:최대사용수, 짧은 코드는 버린다", () => {
  assert.deepEqual(parseCodes("cv-pro-abcd12:pro:365:1, CV-PLUS-XY99ZZ:plus:30:20, CV-MAX-QQ77RR:max:7:3, ab:pro:1:1"), [
    { code: "CV-PRO-ABCD12", plan: "pro", days: 365, maxUses: 1 },
    { code: "CV-PLUS-XY99ZZ", plan: "plus", days: 30, maxUses: 20 },
    { code: "CV-MAX-QQ77RR", plan: "max", days: 7, maxUses: 3 },
  ]);
  assert.deepEqual(parseCodes(""), []);
  // 운영자 코드: Max + 횟수 제한 없음
  assert.deepEqual(parseCodes("ryuhan:ops:36500:3"), [{ code: "RYUHAN", plan: "max", days: 36500, maxUses: 3, ops: true }]);
});
