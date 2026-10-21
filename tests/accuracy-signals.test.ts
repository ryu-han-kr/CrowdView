// 정확도 개선 계산 (10/21): 평소 기준선, 제보 보정, 검색 추이, 학사일정, 자료 등급
import assert from "node:assert/strict";
import { test } from "node:test";
import { biasFrom } from "@/lib/crowd/bias";
import { slotOf, stepBaseline } from "@/lib/crowd/baseline";
import { isSchoolOff, offShare, trendFrom } from "@/lib/crowd/extra-signals";
import { dataGrade } from "@/lib/data-grade";

const empty = () => ({ v: Array(168).fill(0), d: Array(168).fill(0), last: Array(168).fill("") });

test("평소 기준선: 서로 다른 날짜 2일이 쌓이기 전에는 배율이 없고, 쌓인 뒤 평소 대비 배율", () => {
  let b = empty();
  const slot = 10;
  let r = stepBaseline(b, slot, 1000, "2026-10-07");
  assert.equal(r.ratio, undefined);
  b = r.next;
  // 같은 날 여러 번 들어와도 날짜 수는 1
  r = stepBaseline(b, slot, 1000, "2026-10-07");
  assert.equal(r.next.d[slot], 1);
  b = stepBaseline(r.next, slot, 1000, "2026-10-14").next;
  r = stepBaseline(b, slot, 1500, "2026-10-21");
  assert.equal(r.ratio, 1.5);
  // 다른 칸은 그대로
  assert.equal(r.next.v[slot + 1], 0);
});

test("요일 × 시간 칸: 한국 시간 기준 (일요일 0시 = 0, 토요일 23시 = 167)", () => {
  assert.equal(slotOf(new Date("2026-10-17T15:00:00Z")), 0); // 10/18(일) 00시 KST
  assert.equal(slotOf(new Date("2026-10-24T14:30:00Z")), 167); // 10/24(토) 23:30 KST
});

test("제보 보정: 5건 미만은 0, 건수가 적으면 덜 믿고, ±15점 안", () => {
  assert.equal(biasFrom([20, 20, 20, 20]), 0);
  assert.equal(biasFrom([20, 20, 20, 20, 20]), 7); // 20 × 5/15
  assert.equal(biasFrom(Array(100).fill(40)), 15);
  assert.equal(biasFrom(Array(100).fill(-40)), -15);
});

test("검색 추이: 최근 7일 / 그 전 4주의 변화 절반만, 0.85 ~ 1.2", () => {
  assert.equal(trendFrom(Array(10).fill(50)), undefined);
  assert.equal(trendFrom(Array(35).fill(50)), 1);
  assert.equal(trendFrom([...Array(28).fill(50), ...Array(7).fill(70)]), 1.2);
  assert.equal(trendFrom([...Array(28).fill(50), ...Array(7).fill(60)]), 1.1);
  assert.equal(trendFrom([...Array(28).fill(50), ...Array(7).fill(5)]), 0.85);
});

test("학사일정: 휴업일·방학만 쉬는 날, 날짜별 쉬는 학교 비율", () => {
  assert.equal(isSchoolOff({ SBTR_DD_SC_NM: "휴업일", EVENT_NM: "재량휴업일" }), true);
  assert.equal(isSchoolOff({ SBTR_DD_SC_NM: "해당없음", EVENT_NM: "겨울방학" }), true);
  assert.equal(isSchoolOff({ SBTR_DD_SC_NM: "해당없음", EVENT_NM: "현장체험학습" }), false);
  const share = offShare([
    [{ AA_YMD: "20261102", SBTR_DD_SC_NM: "휴업일" }],
    [{ AA_YMD: "20261102", EVENT_NM: "가을방학" }, { AA_YMD: "20261103", EVENT_NM: "가을방학" }],
    [],
    [{ AA_YMD: "20261103", SBTR_DD_SC_NM: "해당없음", EVENT_NM: "학부모 상담" }],
  ]);
  assert.equal(share.get("2026-11-02"), 0.5);
  assert.equal(share.get("2026-11-03"), 0.25);
});

test("자료 등급: 기관 실측 A · 대기시간·지역 안 시설 B · 예측 C", () => {
  assert.equal(dataGrade({ source: "seoul-citydata" }), "A");
  assert.equal(dataGrade({ source: "incheon-airport" }), "A");
  assert.equal(dataGrade({ source: "seoul-citydata", area: { name: "잠실 관광특구", range: [1, 2] } }), "B");
  assert.equal(dataGrade({ source: "themeparks-wiki" }), "B");
  assert.equal(dataGrade({ source: "model" }), "C");
});
