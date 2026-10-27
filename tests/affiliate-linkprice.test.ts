// 링크프라이스 우선 업체(아고다·클룩)는 직접 제휴 값이 있어도 링크프라이스로, 승인받은 사이트 아이디로 (10/27)
import assert from "node:assert/strict";
import { test } from "node:test";

process.env.NEXT_PUBLIC_LINKPRICE_ID = "A1";
process.env.NEXT_PUBLIC_AFF_AGODA = "cid=1";
process.env.NEXT_PUBLIC_AFF_TRIP = "Allianceid=1&SID=2";

test("아고다·클룩은 링크프라이스, Trip.com은 직접 제휴, KKday는 기본 아이디", async () => {
  const { withAffiliate } = await import("@/lib/affiliate");
  const agoda = new URL(withAffiliate("agoda", "https://www.agoda.com/search?city=1"));
  assert.equal(agoda.searchParams.get("m"), "agoda");
  assert.equal(agoda.searchParams.get("a"), "A100709267");
  assert.equal(agoda.searchParams.get("tu"), "https://www.agoda.com/search?city=1");
  assert.equal(new URL(withAffiliate("klook", "https://www.klook.com/ko/")).searchParams.get("m"), "klook");
  assert.equal(withAffiliate("trip", "https://kr.trip.com/x?k=1"), "https://kr.trip.com/x?k=1&Allianceid=1&SID=2");
  assert.equal(new URL(withAffiliate("kkday", "https://www.kkday.com/ko/")).searchParams.get("a"), "A1");
});
