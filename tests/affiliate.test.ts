// 제휴 링크 (lib/affiliate): 값이 있으면 꼬리표를 붙이고, 마이리얼트립은 중계(bridge) 주소로 감싼다
import assert from "node:assert/strict";
import { test } from "node:test";

process.env.NEXT_PUBLIC_AFF_AGODA = "cid=1";
process.env.NEXT_PUBLIC_AFF_MYREALTRIP = "utm_source=mktpartner&t_scope=604800&mylink_id=1";
delete process.env.NEXT_PUBLIC_AFF_KLOOK;

test("꼬리표만 붙는 곳, 감싸는 곳, 값이 없는 곳", async () => {
  const { withAffiliate, isAffiliate } = await import("@/lib/affiliate");
  assert.equal(withAffiliate("agoda", "https://www.agoda.com/search?city=1"), "https://www.agoda.com/search?city=1&cid=1");
  const mrt = new URL(withAffiliate("myrealtrip", "https://www.myrealtrip.com/search?q=%EC%97%90%EB%B2%84%EB%9E%9C%EB%93%9C"));
  assert.equal(mrt.origin + mrt.pathname, "https://www.myrealtrip.com/main/bridge/marketing");
  assert.equal(
    mrt.searchParams.get("return_url"),
    "https://www.myrealtrip.com/search?q=%EC%97%90%EB%B2%84%EB%9E%9C%EB%93%9C&utm_source=mktpartner&t_scope=604800&mylink_id=1",
  );
  assert.equal(withAffiliate("klook", "https://www.klook.com/search/?query=a"), "https://www.klook.com/search/?query=a");
  assert.equal(isAffiliate("myrealtrip"), true);
  assert.equal(isAffiliate("klook"), false);
});

test("예약 사이트 검색어는 짧은 이름으로 (관광특구·괄호·두 번째 이름 떼기)", async () => {
  const { searchName } = await import("@/components/StayLinks");
  assert.equal(searchName("명동 관광특구"), "명동");
  assert.equal(searchName("Dongdaemun Tourist Special Zone"), "Dongdaemun");
  assert.equal(searchName("Myeongdong Tourism Special Zone"), "Myeongdong");
  assert.equal(searchName("Itaewon Special Tourism Zone"), "Itaewon");
  assert.equal(searchName("홍대입구역(2호선)"), "홍대입구역");
  assert.equal(searchName("DDP(동대문디자인플라자)"), "DDP");
  assert.equal(searchName("잠실롯데타워·석촌호수"), "잠실롯데타워");
  assert.equal(searchName("경복궁"), "경복궁");
});
