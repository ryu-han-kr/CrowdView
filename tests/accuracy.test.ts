// 예측 정확도 기록 (lib/accuracy): 저장한 예측이 실제 값의 시각에 채점되고, 같은 목표는 한 번만
import assert from "node:assert/strict";
import { test } from "node:test";
import { getAccuracy, trackAccuracy } from "@/lib/accuracy";

const area = (time: string, score: number, forecast: { time: string; score: number }[]) => ({
  area: "강남역",
  level: "보통",
  score,
  min: 1000,
  max: 2000,
  time,
  forecast: forecast.map((f) => ({ ...f, level: "보통", min: 1000, max: 2000 })),
});

test("1시간 뒤 공식 예측을 다음 시간 실제 값과 비교해 날짜별로 쌓는다", async () => {
  // POI014 = 강남역 (서울 실시간 지역 코드)
  // 15:05 KST 수집: 서울시 기준 14:35, 15·16시 예측
  const t1 = new Date("2026-03-02T06:05:00Z");
  await trackAccuracy({ POI014: area("2026-03-02 14:35", 40, [{ time: "2026-03-02 16:00", score: 48 }, { time: "2026-03-02 18:00", score: 68 }]) }, t1);
  // 17:05 KST 수집: 서울시 기준 16:35, 실제 48 → official-1h(16시 목표) 예측 48과 같은 단계
  const t2 = new Date("2026-03-02T08:05:00Z");
  const scored = await trackAccuracy({ POI014: area("2026-03-02 16:35", 48, []) }, t2);
  assert.ok(scored >= 1);
  // 같은 목표는 다시 채점하지 않는다
  assert.equal(await trackAccuracy({ POI014: area("2026-03-02 16:35", 48, []) }, new Date("2026-03-02T08:15:00Z")), 0);
});

test("날짜별 통계를 읽는다", async () => {
  const rows = await getAccuracy(400);
  const day = rows.find((r) => r.date === "2026-03-02");
  // 테스트 날짜가 오늘에서 400일 안이면 기록이 보인다
  if (day) {
    assert.equal(day.stats["official-1h"]?.match, 1);
    assert.equal(day.stats["official-1h"]?.absErr, 0);
  }
});

test("기준선: 지금 값 그대로 24시간 뒤, 4주 중앙값은 지난 기록이 2개 이상일 때만", async () => {
  // 4주 동안 같은 요일 10시(KST) 실제 값을 쌓는다: 3/2(월)부터 7일 간격, 서울시 기준 10:35 → 목표 10시
  for (const [i, s] of [20, 40, 60].entries()) {
    const day = new Date(Date.UTC(2026, 2, 9 + i * 7));
    const ymd = day.toISOString().slice(0, 10);
    await trackAccuracy({ POI014: area(`${ymd} 10:35`, s, []) }, new Date(`${ymd}T02:05:00Z`));
  }
  // 3/29(일) 10:05 수집 → 3/30(월) 10시 목표 예측 저장: naive = 지금 값 70, median = 3/9·16·23 실제(20·40·60) 중앙값 40
  await trackAccuracy({ POI014: area("2026-03-29 09:35", 70, []) }, new Date("2026-03-29T01:05:00Z"));
  // 3/30 10:35 실제 40 → median-24h 정답, naive-24h(70)는 단계가 다르다
  await trackAccuracy({ POI014: area("2026-03-30 10:35", 40, []) }, new Date("2026-03-30T02:05:00Z"));
  const day = (await getAccuracy(400)).find((r) => r.date === "2026-03-30");
  if (day) {
    assert.equal(day.stats["median-24h"]?.absErr, 0);
    assert.equal(day.stats["naive-24h"]?.absErr, 30);
  }
});
