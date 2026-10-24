// 이용 집계·기대수익 (lib/traffic·lib/revenue): 순방문자·방문·페이지뷰를 따로 세고, 봇은 버린다
import assert from "node:assert/strict";
import { test } from "node:test";
import { getTraffic, isBot, recordBeacon } from "@/lib/traffic";
import { dayRevenue } from "@/lib/revenue";

const base = { lang: "ko", mobile: true, plus: false, session: false, pv: 1, ads: [] as string[], aff: [] as string[] };

test("같은 사람이 하루에 여러 번 와도 순방문자는 1명, 방문·페이지뷰는 따로 센다", async () => {
  await recordBeacon({ ...base, vid: "aaaaaaaa11", session: true, pv: 2 });
  await recordBeacon({ ...base, vid: "aaaaaaaa11", session: true, pv: 3 });
  await recordBeacon({ ...base, vid: "bbbbbbbb22", session: true, pv: 1, lang: "en", mobile: false, ads: ["inline"], aff: ["klook", "nope"] });
  const [today] = await getTraffic(1);
  assert.equal(today.uv, 2);
  assert.equal(today.sessions, 3);
  assert.equal(today.pv, 6);
  assert.equal(today.f["pv:en"], 1);
  assert.equal(today.f["pv:m"], 5);
  assert.equal(today.f["ad:inline"], 1);
  assert.equal(today.f["aff:klook"], 1);
  assert.equal(today.f["aff:nope"], undefined);
});

test("기대수익: 채워진 광고가 있으면 그 수로, 1인당 = 합계 ÷ 순방문자", async () => {
  const [today] = await getTraffic(1);
  const r = dayRevenue(today);
  assert.equal(r.adsFrom, "measured");
  assert.equal(Math.round(r.ads * 1000), 2500); // 영어 노출 1번 × 2,500원/1,000
  assert.equal(r.affiliate, 0); // 제휴 값이 없으면 실제 몫은 0
  assert.ok(r.affiliatePotential > 0);
  assert.equal(r.perUser, r.total / 2);
});

test("봇·자동화 브라우저는 세지 않는다", () => {
  assert.ok(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)"));
  assert.ok(isBot("Mozilla/5.0 ... HeadlessChrome/130.0"));
  assert.ok(!isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"));
});
