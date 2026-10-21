// 지역 안 시설(롯데월드 ⊂ 잠실 관광특구) 인원: 지금 인원·주간 막대·시간대 곡선이 모두 시설 정원 기준 (lib/crowd/provider)
import assert from "node:assert/strict";
import { test } from "node:test";
import { sitePeople, siteShare } from "@/lib/crowd/provider";
import { PLACES } from "@/lib/places";

const lotte = PLACES.find((p) => p.id === "lotteworld")!;

test("롯데월드는 지역 안 시설이다", () => {
  assert.ok(siteShare(lotte) < 1);
});

test("아무리 붐벼도 정원을 넘지 않는다", () => {
  assert.equal(sitePeople(lotte, 100), lotte.capacity);
  assert.ok(sitePeople(lotte, 95) <= lotte.capacity);
});

test("단계 경계는 정원의 20·40·60·80%", () => {
  assert.equal(sitePeople(lotte, 40), Math.round((lotte.capacity * 0.4) / 100) * 100);
  assert.equal(sitePeople(lotte, 80), Math.round((lotte.capacity * 0.8) / 100) * 100);
  assert.ok(sitePeople(lotte, 30) < sitePeople(lotte, 50));
});
