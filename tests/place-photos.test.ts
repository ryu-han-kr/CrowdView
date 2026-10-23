// 장소 사진: 관광공사 관광사진 갤러리(전문 사진)를 앞에, 기존 대표가 더 나은 곳은 기존 대표를 첫 장으로
import assert from "node:assert/strict";
import { test } from "node:test";
import pro from "@/data/korea/pro-photos.json";
import { placePhotos } from "@/lib/place-photos";

const PRO = pro as Record<string, { src: string; w: number; h: number }[]>;

test("갤러리 사진이 있으면 대표가 갤러리 첫 장 (크기 포함)", () => {
  const list = placePhotos("seoul-grand-park");
  assert.equal(list[0].src, PRO["seoul-grand-park"][0].src);
  assert.ok(list[0].w && list[0].h);
  assert.match(list[0].credit, /^한국관광공사 · /);
});

test("대표를 직접 고른 곳은 그 사진이 첫 장, 갤러리 사진은 그 뒤에", () => {
  const list = placePhotos("gyeongbokgung");
  assert.match(list[0].src, /3551003\.jpg$/);
  assert.equal(list[0].credit, "한국관광공사 · 서문교");
  assert.ok(list.some((p) => p.src === PRO.gyeongbokgung[0].src));
});

test("기존 대표를 남기는 곳은 첫 장이 기존 사진, 그 뒤에 갤러리 사진", () => {
  const list = placePhotos("gimpo");
  assert.ok(!PRO.gimpo.some((p) => p.src === list[0].src));
  assert.equal(list[1].src, PRO.gimpo[0].src);
});

test("갤러리 대표는 가로 사진, 크레딧에 '한국관광공사'가 두 번 붙지 않음", () => {
  for (const [id, list] of Object.entries(PRO)) {
    assert.ok(list[0].w > list[0].h, id);
    for (const p of placePhotos(id)) assert.ok(!/한국관광공사 · 한국관광공사/.test(p.credit), id);
    const srcs = placePhotos(id).map((p) => p.src);
    assert.equal(new Set(srcs).size, srcs.length, id);
  }
});
