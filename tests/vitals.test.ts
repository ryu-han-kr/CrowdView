// 실사용 화면 속도 집계 (lib/vitals): 알 수 없는 지표·등급은 버리고, 지표별 '좋음' 비율을 낸다
import assert from "node:assert/strict";
import { test } from "node:test";
import { getVitals, recordVitals } from "@/lib/vitals";

test("LCP·INP·CLS 등급만 세고 좋음 비율을 계산한다", async () => {
  assert.equal(
    await recordVitals([
      { n: "LCP", r: "good" },
      { n: "FOO", r: "good" },
      { n: "CLS", r: "bad" },
    ]),
    1,
  );
  await recordVitals([{ n: "LCP", r: "poor" }]);
  const v = await getVitals(1);
  assert.equal(v.LCP.total, 2);
  assert.equal(v.LCP.good, 1);
  assert.equal(v.LCP.pct, 50);
  assert.equal(v.CLS.pct, null);
});
