// 장소 사진: 관광공사 관광사진 갤러리(전문 사진)를 앞에, 기존 대표가 더 나은 곳은 기존 대표를 첫 장으로
import assert from "node:assert/strict";
import { test } from "node:test";
import picks from "@/data/korea/photo-picks.json";
import pro from "@/data/korea/pro-photos.json";
import { placePhotos } from "@/lib/place-photos";

const PRO = pro as Record<string, { src: string; w: number; h: number }[]>;
const PICKS = picks as Record<string, unknown>;

test("다시 고른 곳(photo-picks)은 Claude가 고른 순서, 첫 장이 대표 (10/30: 갤러리가 있는 곳은 모두 다시 고름)", () => {
  const first = (PICKS["gwangju-familyland"] as { photos: { src: string; credit: string }[] }).photos[0];
  const list = placePhotos("gwangju-familyland");
  assert.equal(list[0].src, first.src);
  assert.match(list[0].src, /^\/api\/gphoto\/gwangju-familyland\/[0-9a-f]{12}$/);
  assert.match(list[0].credit, /^Google 지도 · /);
});

test("대표를 직접 고른 곳은 그 사진이 첫 장, 갤러리 사진은 그 뒤에", () => {
  const list = placePhotos("gyeongbokgung");
  assert.match(list[0].src, /3551003\.jpg$/);
  assert.equal(list[0].credit, "한국관광공사 · 서문교");
  assert.ok(list.some((p) => p.src === PRO.gyeongbokgung[0].src));
});

test("Claude가 고른 사진이 있으면 그 순서가 먼저 (기존 대표 남기기보다 우선)", () => {
  // 10/31: 기존 대표를 남기던 곳(KEEP_HERO)도 이제 모두 새로 고른 사진이 있다 — 김해공항은 흐린 청사 대신 맑은 하늘의 비행기가 첫 장
  const list = placePhotos("gimhae");
  assert.equal(list[0].src, (PICKS.gimhae as { photos: { src: string }[] }).photos[0].src);
  assert.ok(list.length >= 2);
});

test("갤러리 대표는 가로 사진, 크레딧에 '한국관광공사'가 두 번 붙지 않음", () => {
  for (const [id, list] of Object.entries(PRO)) {
    assert.ok(list[0].w > list[0].h, id);
    for (const p of placePhotos(id)) assert.ok(!/한국관광공사 · 한국관광공사/.test(p.credit), id);
    const srcs = placePhotos(id).map((p) => p.src);
    assert.equal(new Set(srcs).size, srcs.length, id);
  }
});
