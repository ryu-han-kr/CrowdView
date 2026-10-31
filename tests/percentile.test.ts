// 백분위 혼잡지수(lib/crowd/percentile)와 24시간 예측 방법 선택(lib/accuracy pickMethod24)
import assert from "node:assert/strict";
import { test } from "node:test";
import { MIN_PICK_N, pickMethod24, type DayStat } from "@/lib/accuracy";
import { MIN_N, bandOf, quantiles, recordActuals, sampleTargets, updateQuantiles, usualBand } from "@/lib/crowd/percentile";

test("분위수: 표본이 MIN_N 미만이면 없고, 선형 보간으로 p10~p90", () => {
  assert.equal(quantiles(Array.from({ length: MIN_N - 1 }, (_, i) => i)), undefined);
  const q = quantiles(Array.from({ length: 21 }, (_, i) => i * 10)); // 0,10,…,200
  assert.deepEqual(q, [21, 20, 50, 100, 150, 180]);
});

test("지금 값의 위치: 상위 10%·25%, 비슷, 하위 25%·10%. 납작한 분포(값이 다 같음)는 비슷", () => {
  const q = [21, 20, 50, 100, 150, 180] as const;
  assert.equal(bandOf(190, [...q]), "much-busier");
  assert.equal(bandOf(160, [...q]), "busier");
  assert.equal(bandOf(100, [...q]), "usual");
  assert.equal(bandOf(40, [...q]), "quieter");
  assert.equal(bandOf(10, [...q]), "much-quieter");
  assert.equal(bandOf(50, [12, 50, 50, 50, 50, 50]), "usual");
});

test("비교에 쓰는 과거 시각: 최근 4주 중 같은 평일/주말인 날의 앞뒤 1시간, 오늘은 뺀다", () => {
  // 2026-10-21(수) 14:30 KST
  const now = new Date("2026-10-21T05:30:00Z");
  const keys = sampleTargets(now);
  // 평일 20일 × 3시간
  assert.equal(keys.length, 60);
  assert.ok(keys.includes("2026-10-20T13") && keys.includes("2026-10-20T14") && keys.includes("2026-10-20T15"));
  assert.ok(!keys.some((k) => k.startsWith("2026-10-21")));
  assert.ok(!keys.some((k) => k.startsWith("2026-10-18")) && !keys.some((k) => k.startsWith("2026-10-17")));
  // 공휴일(10/9 한글날 금요일)은 주말 칸이라 평일 비교에서 빠진다
  assert.ok(!sampleTargets(now, new Map([["2026-10-09", "한글날"]])).some((k) => k.startsWith("2026-10-09")));
  // 주말: 토요일 10시 → 주말 8일 × 3
  assert.equal(sampleTargets(new Date("2026-10-24T01:00:00Z")).length, 24);
});

test("실제 값을 시각별로 남기고 분포 요약을 만들면 화면에서 위치를 읽을 수 있다", async () => {
  const live = (time: string, min: number, max: number) => ({
    POI014: { area: "강남역", level: "보통", score: 48, min, max, time, forecast: [] },
  });
  // 4주 동안 평일 13·14·15시 값을 넣는다 (서울시 기준 시각은 수집 시각보다 늦게 나와 각 시의 :35 값을 다음 시간 수집으로)
  let base = 1000;
  for (let d = 28; d >= 1; d--) {
    const date = new Date(Date.parse("2026-10-21T00:00:00Z") - d * 86_400_000).toISOString().slice(0, 10);
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    for (const h of [13, 14, 15]) {
      base += 10;
      await recordActuals(live(`${date} ${h}:35`, base - 100, base + 100), {}, new Date(`${date}T${String(h + 1).padStart(2, "0")}:05:00Z`));
    }
  }
  const n = await updateQuantiles(new Date("2026-10-21T05:05:00Z"));
  assert.equal(n, 1);
  // 쌓인 값 범위 1010~1600 → 2000은 훨씬 붐빔, 1300은 비슷, 900은 훨씬 한산
  const at = new Date("2026-10-21T05:10:00Z");
  assert.equal((await usualBand("seoul", "POI014", 2000, at))?.band, "much-busier");
  assert.equal((await usualBand("seoul", "POI014", 1300, at))?.band, "usual");
  assert.equal((await usualBand("seoul", "POI014", 900, at))?.band, "much-quieter");
  assert.equal(await usualBand("seoul", "POI999", 1300, at), undefined);
});

test("24시간 예측 방법: 기준선이 단계 일치·평균 오차 둘 다 이길 때만 바꾸고, 비교 수가 적으면 패턴 그대로", () => {
  const s = (n: number, rate: number, err: number): DayStat => ({ n, match: Math.round(n * rate), absErr: n * err });
  const big = MIN_PICK_N;
  // 둘 다 이김 → 기준선
  assert.equal(pickMethod24({ "pattern-24h": s(big, 0.24, 24), "naive-24h": s(big, 0.5, 15), "median-24h": s(0, 0, 0) }), "naive-24h");
  // 단계 일치만 이김 → 패턴 유지
  assert.equal(pickMethod24({ "pattern-24h": s(big, 0.24, 24), "naive-24h": s(big, 0.5, 25), "median-24h": s(0, 0, 0) }), "pattern-24h");
  // 둘 다 이기는 기준선이 둘이면 오차가 작은 쪽
  assert.equal(pickMethod24({ "pattern-24h": s(big, 0.24, 24), "naive-24h": s(big, 0.5, 15), "median-24h": s(big, 0.55, 12) }), "median-24h");
  // 표본 부족 → 패턴
  assert.equal(pickMethod24({ "pattern-24h": s(big, 0.24, 24), "naive-24h": s(big - 1, 0.6, 10), "median-24h": s(0, 0, 0) }), "pattern-24h");
  assert.equal(pickMethod24({ "pattern-24h": s(10, 0.24, 24), "naive-24h": s(big, 0.6, 10), "median-24h": s(0, 0, 0) }), "pattern-24h");
});

test("24시간 예측 방법: 혼합(hybrid)·지난주(weekly)도 후보 — 오차가 가장 작은 쪽", () => {
  const s = (n: number, rate: number, err: number): DayStat => ({ n, match: Math.round(n * rate), absErr: n * err });
  const big = MIN_PICK_N;
  assert.equal(
    pickMethod24({ "pattern-24h": s(big, 0.27, 20.7), "naive-24h": s(big, 0.79, 5.7), "weekly-24h": s(big, 0.7, 7), "hybrid-24h": s(big, 0.82, 5.1) }),
    "hybrid-24h",
  );
  // 혼합 표본이 아직 모자라면 다른 기준선
  assert.equal(pickMethod24({ "pattern-24h": s(big, 0.27, 20.7), "naive-24h": s(big, 0.79, 5.7), "hybrid-24h": s(100, 0.9, 3) }), "naive-24h");
});
