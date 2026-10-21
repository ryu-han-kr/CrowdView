// API 호출 한도 (lib/api-quota): 일일 한도와 월 한도(Papago) 둘 다 90%에서 막는다
import assert from "node:assert/strict";
import { test } from "node:test";
import { QuotaError, beforeCall, getMonthUsage, type ApiInfo } from "@/lib/api-quota";

test("월 한도가 있으면 하루 한도 안이라도 이달 누적 90%에서 막는다", async () => {
  const api: ApiInfo = { id: "test-monthly", name: "시험", limit: 1000, monthlyLimit: 100, unit: "자" };
  await beforeCall(api, 50);
  await beforeCall(api, 40);
  assert.equal(await getMonthUsage("test-monthly"), 90);
  // 91 > 90 → 막히고, 집계는 되돌린다
  await assert.rejects(beforeCall(api, 1), QuotaError);
  assert.equal(await getMonthUsage("test-monthly"), 90);
});

test("월 한도가 없는 API는 하루 한도만 본다", async () => {
  const api: ApiInfo = { id: "test-daily", name: "시험", limit: 10 };
  for (let i = 0; i < 9; i++) await beforeCall(api);
  await assert.rejects(beforeCall(api), QuotaError);
  assert.equal(await getMonthUsage("test-daily"), 0);
});
