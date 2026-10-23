# 사진 고르기 도구 (10/23)

관광공사 관광사진 갤러리·위키미디어 커먼즈에서 후보를 모아 한 장짜리 비교표(PNG)로 만들고, 눈으로 보고 골라 JSON에 넣는다.
작업 폴더 `W`는 저장소 밖이나 `photo/`(커밋 안 함)를 쓴다. 모두 저장소 루트에서 실행한다.

```bash
W=photo/pick; mkdir -p $W/cand $W/qa
# 1) 여행 가이드 상위 N곳 → 관광공사 갤러리 후보 (제목이 이름과 같거나 이름으로 시작하는 사진만, 하루 1,000건 한도)
npx tsx scripts/photo-pick/guide.mts $W/cand/cand.json 160
# 2) 커먼즈 후보: [[id, 검색어, 지금 사진]] (가로·1600px 이상·CC0/CC BY/CC BY-SA만)
npx tsx scripts/photo-pick/cm1.mts $W/cand/cand.json '[["POI105","Yeouido Hangang Park",""]]'
# 서울 실시간 지역 전체를 커먼즈로: commons.mts $W/cand/cand.json
# 3) 비교표: $W/cand/sheet-00.png … (빨간 테두리 = 지금 사진, 번호 = 후보)
node scripts/photo-pick/sheets.cjs $W
# 직접 고른 사진이 없는 서울 지역의 지금 사진 한눈에: areas.mts $W/cand/top.html → one.cjs $W/cand/top.html $W/cand/top.png
# 4) 화면 확인: pages.cjs $W <주소> <이름> /guide/vs-037164 … → mont.cjs $W 묶음.png 파일들…
```

고른 사진을 넣는 곳:
- 여행 가이드: `src/data/seoul/guide-photos.json` — `{ id: { src, credit: "저작자 · 라이선스 (Wikimedia Commons)", page } }` (관광공사 사진이면 credit 생략)
- 서울 실시간 지역: `src/data/seoul/area-photos.json` — `{ POI코드: { src, title, photographer, license, page } }`
- 장소 대표 사진: `src/lib/place-photos.ts` 의 `HERO`
