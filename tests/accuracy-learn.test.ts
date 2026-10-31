// 실제 결과로 고치는 예측 (lib/accuracy-learn): RLS 학습 모델, 앙상블 무게, 단기 혼합, 24시간 방법 고르기의 엄격한 규칙
import assert from "node:assert/strict";
import { test } from "node:test";
import { MIN_PICK_N, getAccuracy, getLearnState, parseLearnState, pickMethod24, trackAccuracy, type DayStat } from "@/lib/accuracy";
import {
  LEARN_DIM,
  blendInit,
  blendPredict,
  blendUpdate,
  blendWeight,
  ensemblePredict,
  ensembleUpdate,
  ensembleWeights,
  learnFeatures,
  learnInit,
  learnPredict,
  learnUpdate,
  rlsInit,
  transitInputs,
  rlsPredict,
  rlsUpdate,
  snapSeoul,
} from "@/lib/accuracy-learn";

test("서울 단계 점수로 붙이기: 가장 가까운 25·48·68·88", () => {
  assert.equal(snapSeoul(0), 25);
  assert.equal(snapSeoul(36), 25);
  assert.equal(snapSeoul(37), 48);
  assert.equal(snapSeoul(59), 68);
  assert.equal(snapSeoul(100), 88);
});

test("RLS: 처음엔 지난주 값 그대로, 같은 관계를 계속 보면 그 관계를 배운다", () => {
  const m = rlsInit(3, 10);
  // 처음 상태: 가중치 [0,0,1] → 세 번째 특징 그대로
  assert.equal(rlsPredict(m, [1, 0.2, 0.5]), 0.5);
  // y = 0.1 + 0.6·x1 + 0.3·x2
  const f = (x1: number, x2: number) => 0.1 + 0.6 * x1 + 0.3 * x2;
  for (let i = 0; i < 400; i++) {
    const x1 = (i * 37) % 100 / 100;
    const x2 = (i * 53) % 100 / 100;
    rlsUpdate(m, [1, x1, x2], f(x1, x2), 1);
  }
  assert.equal(m.n, 400);
  assert.ok(Math.abs(m.w[0] - 0.1) < 0.01 && Math.abs(m.w[1] - 0.6) < 0.01 && Math.abs(m.w[2] - 0.3) < 0.01, m.w.join(","));
  assert.ok(Math.abs(rlsPredict(m, [1, 0.5, 0.5]) - f(0.5, 0.5)) < 0.01);
});

test("RLS: 잊는 비율이 있으면 관계가 바뀐 뒤 새 관계로 옮겨 간다", () => {
  const m = rlsInit(2, 10);
  for (let i = 0; i < 300; i++) rlsUpdate(m, [1, (i % 10) / 10], 0.2, 0.95);
  for (let i = 0; i < 300; i++) rlsUpdate(m, [1, (i % 10) / 10], 0.8, 0.95);
  assert.ok(Math.abs(rlsPredict(m, [1, 0.5]) - 0.8) < 0.01);
});

test("학습 모델 입력: 지난주가 없으면 지금 값, 중앙값이 없으면 지난주로 채우고, 바뀜·밤과 곱한다", () => {
  const x = learnFeatures([40, null, null, null, 1, 0]);
  assert.equal(x.length, LEARN_DIM);
  assert.deepEqual(x, [1, 0.4, 0.4, 0.4, 0.4, 1, 0.4, 0.4, 0, 0, 0, 0]);
  assert.deepEqual(learnFeatures([25, 68, 48, null, 0, 1, 0.2, -0.1]), [1, 0.25, 0.68, 0.48, 0.68, 0, 0, 0, 1, 0.25, 0.2, -0.1]);
});

test("승하차·주차 입력: 한 시간 사이 변화율(−1~1), 주차 (%−50)/100, 없으면 0", () => {
  assert.deepEqual(transitInputs([600, 600, 0, 0, 80], [500, 500, 0, 0, 70]), [0.2, 0.3]);
  assert.deepEqual(transitInputs([5000, 0, null, null, null], [100, 0, null, null, null]), [1, 0]);
  assert.deepEqual(transitInputs(undefined, [1, 1, 1, 1, 1]), [0, 0]);
  assert.deepEqual(transitInputs([null, null, null, null, 30], undefined), [0, -0.2]);
});

test("학습 모델: 처음 예측은 지난주 같은 시각, 지난주가 없던 예측은 배우지 않고, 지역 치우침을 고친다", () => {
  const st = learnInit();
  assert.equal(learnPredict(st.rls, [25, 68, 68, 68, 0, 0]), 68);
  learnUpdate(st, "A", [25, null, null, null, 0, 0], 88);
  assert.equal(st.rls.n, 0);
  assert.equal(st.lb.A, undefined);
  // 지역 A는 늘 지난주보다 한 단계 붐빈다
  for (let i = 0; i < 200; i++) learnUpdate(st, "A", [48, 48, 48, 48, 0, 0], 68);
  assert.equal(st.rls.n, 200);
  assert.equal(learnPredict(st.rls, [48, 48, 48, 48, 0, 0], st.lb.A), 68);
});

test("앙상블: 오차 제곱에 반비례, 없는 후보는 빼고, 점수는 서울 단계로", () => {
  // 지금 값 오차 2, 지난주 오차 6 → 1/(4+4) : 1/(36+4) = 5 : 1
  const w = ensembleWeights([2, 6, null, null], { naive: 25, weekly: 68 });
  assert.ok(Math.abs(w.naive! - 5 / 6) < 1e-9 && Math.abs(w.weekly! - 1 / 6) < 1e-9);
  assert.equal(w.hybrid, undefined);
  // 25·5/6 + 68/6 = 32.2 → 25
  assert.equal(ensemblePredict([2, 6, null, null], { naive: 25, weekly: 68 }), 25);
  assert.equal(ensemblePredict([2, 6, null, null], {}), undefined);
  // 처음 보는 후보는 같은 무게
  assert.equal(ensemblePredict(undefined, { naive: 48, weekly: 48 }), 48);
});

test("앙상블 오차: 처음엔 그 오차, 그 뒤엔 EWMA, 없는 후보는 그대로", () => {
  let e = ensembleUpdate(undefined, { naive: 25, weekly: 48 }, 48, 0.5);
  assert.deepEqual(e, [23, 0, null, null]);
  e = ensembleUpdate(e, { naive: 48 }, 48, 0.5);
  assert.deepEqual(e, [11.5, 0, null, null]);
  // 지난주가 늘 맞으면 지난주 쪽으로
  assert.equal(ensemblePredict(e, { naive: 25, weekly: 68 }), 68);
});

test("단기 혼합: 공식 예측의 지역 치우침을 배우고, 오차가 작은 쪽에 무게", () => {
  const st = blendInit();
  assert.equal(blendWeight(st), 0.5);
  // 공식 예측이 지역 A에서 늘 한 단계(20점) 높고, 지금 값은 자주 틀린다
  for (let i = 0; i < 300; i++) blendUpdate(st, "A", i % 2 ? 25 : 68, 68, 48);
  assert.ok(Math.abs(st.b.A - 20) < 0.5, String(st.b.A));
  assert.ok(blendWeight(st) < 0.1, String(blendWeight(st)));
  assert.equal(blendPredict(st, "A", 25, 68), 48);
  // 공식 예측이 없으면 지금 값
  assert.equal(blendPredict(st, "A", 25, undefined), 25);
  // 공식 예측이 없던 지역은 치우침 0
  assert.equal(blendPredict(blendInit(), "B", 48, 48), 48);
});

test("24시간 방법: 앙상블·학습 모델은 기준선·혼합 모두를 단계 일치·오차 둘 다 이겨야 고른다", () => {
  const s = (n: number, rate: number, err: number): DayStat => ({ n, match: Math.round(n * rate), absErr: n * err });
  const big = MIN_PICK_N;
  const base = { "pattern-24h": s(big, 0.27, 20), "weekly-24h": s(big, 0.83, 4.2), "hybrid-24h": s(big, 0.8, 5) };
  // 오차만 더 작음 (되짚기의 학습 모델) → 지난주
  assert.equal(pickMethod24({ ...base, "learned-24h": s(big, 0.826, 4.1) }), "weekly-24h");
  // 둘 다 이김 → 학습 모델
  assert.equal(pickMethod24({ ...base, "learned-24h": s(big, 0.85, 4.0) }), "learned-24h");
  // 둘 다 이겨도 표본이 모자라면 아니다
  assert.equal(pickMethod24({ ...base, "learned-24h": s(big - 1, 0.9, 3) }), "weekly-24h");
  // 앙상블·학습 둘 다 자격이면 오차가 작은 쪽
  assert.equal(pickMethod24({ ...base, "learned-24h": s(big, 0.85, 4.0), "ensemble-24h": s(big, 0.84, 3.9) }), "ensemble-24h");
  // 패턴이 표본 부족이면 그대로
  assert.equal(pickMethod24({ ...base, "pattern-24h": s(10, 0.2, 30), "learned-24h": s(big, 0.9, 3) }), "pattern-24h");
});

test("상태 문자열: 모양이 다르면 버린다", () => {
  assert.equal(parseLearnState(null), null);
  assert.equal(parseLearnState("{bad"), null);
  assert.equal(parseLearnState(JSON.stringify({ v: 1, rls: { w: [1, 2], P: [], n: 0 } })), null);
  assert.ok(parseLearnState(JSON.stringify(learnInit())));
  // 특징 수가 바뀐 옛 상태: 학습 모델만 처음부터, 앙상블·단기 혼합은 그대로
  const old = { ...learnInit(), rls: rlsInit(10), lb: { A: 3 }, ens: { A: [1, 2, null, null] } };
  const st = parseLearnState(JSON.stringify(old))!;
  assert.equal(st.rls.w.length, LEARN_DIM);
  assert.deepEqual(st.lb, {});
  assert.deepEqual(st.ens.A, [1, 2, null, null]);
});

const area = (time: string, score: number, forecast: { time: string; score: number }[] = []) => ({
  area: "강남역",
  level: "보통",
  score,
  min: 1000,
  max: 2000,
  time,
  forecast: forecast.map((f) => ({ ...f, level: "보통", min: 1000, max: 2000 })),
});

test("채점 때 모델을 고치고 새 방법도 저장·채점한다 (1단계 이내·낮 시간 포함)", async () => {
  // 2026-05-04(월) 14:05 KST: 서울시 기준 13:35, 15·17시 공식 예측
  await trackAccuracy({ POI014: area("2026-05-04 13:35", 25, [{ time: "2026-05-04 15:00", score: 68 }, { time: "2026-05-04 17:00", score: 68 }]) }, new Date("2026-05-04T05:05:00Z"));
  // 16:05: 실제 15시 48 → official-1h 68(한 단계 차이), naive-1h 25(한 단계 차이), blend-1h
  await trackAccuracy({ POI014: area("2026-05-04 15:35", 48) }, new Date("2026-05-04T07:05:00Z"));
  // 다음 날 15:05: 실제 14시(전날 14:05에 24시간 뒤로 겨냥) → naive·hybrid·ensemble·learned-24h 채점
  await trackAccuracy({ POI014: area("2026-05-05 14:35", 25) }, new Date("2026-05-05T06:05:00Z"));
  const rows = await getAccuracy(400);
  const d4 = rows.find((r) => r.date === "2026-05-04");
  const d5 = rows.find((r) => r.date === "2026-05-05");
  // 테스트 날짜가 오늘에서 400일 안일 때만 확인
  if (d4) {
    for (const h of ["official-1h", "naive-1h", "blend-1h"] as const) {
      assert.equal(d4.stats[h]?.n, 1, h);
      assert.equal(d4.stats[h]?.near, 1, h);
      assert.equal(d4.stats[h]?.dayN, 1, h);
    }
    assert.equal(d4.stats["official-1h"]?.match, 0);
  }
  if (d5) for (const h of ["naive-24h", "hybrid-24h", "ensemble-24h", "learned-24h"] as const) assert.equal(d5.stats[h]?.n, 1, h);
  const st = await getLearnState();
  assert.ok(st);
  // 1시간 혼합은 지역 치우침(공식 68 − 실제 48)을 배웠다
  assert.ok(st!.blend["1h"].b.POI014 > 0);
  // 24시간 후보 오차도 쌓였다 (지금 값 25 → 실제 25: 오차 0)
  assert.equal(st!.ens.POI014[0], 0);
});
