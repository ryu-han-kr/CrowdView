// 코스 추천 카카오 후보 거르기 (lib/route-data kakaoFits): 관심사와 분류가 맞는 곳만
import { test } from "node:test";
import assert from "node:assert/strict";
import { kakaoFits } from "../src/lib/route-data";

test("백화점 관심사는 분류가 백화점·아울렛·몰인 곳만", () => {
  assert.equal(kakaoFits("department", { name: "현대백화점 무역센터점", category: "가정,생활 > 백화점 > 현대백화점" }), true);
  assert.equal(kakaoFits("department", { name: "세계주류백화점 양재역점", category: "가정,생활 > 식품판매 > 주류판매" }), false);
  assert.equal(kakaoFits("department", { name: "행복백화점", category: "쇼핑,유통 > 인터넷쇼핑몰" }), false);
});

test("애니 관심사는 취미·완구·캐릭터 분류만, 본사·온라인은 빼기", () => {
  assert.equal(kakaoFits("anime", { name: "애니메이트 홍대점", category: "가정,생활 > 취미 > 취미용품점" }), true);
  assert.equal(kakaoFits("anime", { name: "미니소코리아 본사", category: "가정,생활 > 생활용품점" }), false);
  assert.equal(kakaoFits("flagship", { name: "현대백화점 무역점 주차장", category: "교통,수송 > 주차장" }), false);
  assert.equal(kakaoFits("flagship", { name: "나이키 강남플래그쉽스토어", category: "가정,생활 > 의류판매 > 스포츠의류 > 나이키" }), true);
});
