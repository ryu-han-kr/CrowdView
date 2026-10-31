// 검색어 맞추기 (lib/search-match, 10/31 경수님 '남산 타워' → 남산 N서울타워)
import assert from "node:assert/strict";
import { test } from "node:test";
import { matchScore } from "@/lib/search-match";

const tower = ["남산 N서울타워", "서울"];
test("띄어쓰기·낱말 순서가 달라도 찾는다", () => {
  assert.ok(matchScore("남산 타워", tower) > 0);
  assert.ok(matchScore("남산타워", tower) > 0);
  assert.ok(matchScore("n서울타워", tower) > 0);
  assert.ok(matchScore("남산서울타워", ["남산서울타워"]) > 0);
  assert.ok(matchScore("타워 남산", tower) > 0);
});
test("초성·별칭", () => {
  assert.ok(matchScore("ㄴㅅ", tower) > 0);
  assert.ok(matchScore("롯데타워", ["롯데월드타워 서울스카이"]) > 0);
  assert.ok(matchScore("캐비", ["캐리비안 베이"]) > 0);
});
test("그대로 들어 있는 곳이 더 위, 엉뚱한 곳은 안 나온다", () => {
  assert.ok(matchScore("에버랜드", ["에버랜드"]) > matchScore("에버랜드", ["에버랜드 근처 카페거리"]));
  assert.ok(matchScore("남산 타워", tower) > matchScore("남산타워", ["남쪽산책로 타임워크"]) || matchScore("남산타워", ["남쪽산책로 타임워크"]) === 0);
  assert.equal(matchScore("경복궁", tower), 0);
  assert.equal(matchScore("남산", ["경복궁", "서울 종로"]), 0);
  assert.equal(matchScore("", tower), 1);
});
