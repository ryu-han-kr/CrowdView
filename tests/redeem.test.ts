// 이용 코드 목록 읽기 (10/28)
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCodes } from "@/lib/redeem";

test("코드:단계:일수:최대사용수, 짧은 코드는 버린다", () => {
  assert.deepEqual(parseCodes("cv-pro-abcd12:pro:365:1, CV-PLUS-XY99ZZ:plus:30:20, ab:pro:1:1"), [
    { code: "CV-PRO-ABCD12", plan: "pro", days: 365, maxUses: 1 },
    { code: "CV-PLUS-XY99ZZ", plan: "plus", days: 30, maxUses: 20 },
  ]);
  assert.deepEqual(parseCodes(""), []);
});
