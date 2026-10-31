# 과거 실측 이력 (2026-10-31 백필)

원천 API는 대부분 '지금 값'만 줘서 예측이 열흘쯤 쌓인 기록에만 기댔다. 공개된 과거 자료를 모두 받아 모델에 쓸 만한 크기로 줄인 표다.
조회는 `src/lib/history-profile.ts`(서버 전용), 월 계절 지수만 `src/lib/crowd/season-index.ts`(예측 모델에서 사용).

## 파일

| 파일 | 내용 | 원천 · 기간 |
|---|---|---|
| `seoul-dong.json` (0.9MB) | 행정동 270곳 × 월(12)×일종류(평일/주말·공휴일)×시(24) 평균 생활인구 `p`, 단기체류 외국인 월 평균 `f` | 서울 생활인구 내국인 OA-14991 · 단기체류 외국인 OA-14993, 2023-01-01 ~ 2026-07-31 (1,306일, 시간별) |
| `sigungu.json` | 시군구 253곳(장소·명소·스팟 1,832곳이 있는 곳): 하루 평균 방문자 `v`, 월×일종류 지수 `i`(외지인+외국인)·`t`(현지인 포함), 평일 공휴일÷주말 `h`, 해마다 평균 `y` | 관광공사 데이터랩 locgoRegnVisitrDDList, 2022-01-01 ~ 2026-10-01 (일별) |
| `subway.json` | 장소·지역 근처 역 145곳: 하루 평균 승하차 `v`, 월×일종류 지수 `i`, 시간대 비중 `hr`(‰, 최근 12달), 평소의 1.3배 넘은 날 `top` | 서울 지하철 역별 일별 OA-12914 (2023-01-01 ~ 2026-10-28), 시간대별 OA-12252 |
| `targets.json` | 대상 → 행정동 몫(지역 500m·장소 300m·명소 400m 원 안 면적 비율), 시군구 코드(장소·명소·스팟), 근처 역(가까운 순 3곳) | 행정동 경계 vuski/admdongkor ver20161231(생활인구와 같은 2016 코드)·ver20260701 |
| `season.json` | 월 계절 지수 12칸(연평균 1000): 장소 242곳(시군구 방문자), 서울 지역 120곳(500m 생활인구 낮 10~21시) | 위 두 원천 |
| `busan-dong.json` | 부산 행정동 4곳 월별 평균 시간대 방문인구 | 부산 생활인구 15164444, 2023-01 ~ 2026-09 |

서울 지역 값은 '반경 500m 안 사람 수' 추정이라 서울시 실시간 인구와 규모가 비슷하다(예: 강남역 10월 평일 14시 약 5.4만 명).

## 예측에 쓰는 곳

- **연결함** `crowd/model.ts`: 야외·관광 장소(명소·거리·테마파크·워터파크·스키·해변)에 `seasonFactor`를 곱한다. 오늘 대비 비율이라 오늘 예측은 그대로(1)이고, 몇 주·몇 달 뒤 예측만 계절을 탄다. 제곱근으로 반만, 0.85~1.2로 묶음.
- **학습 모델(accuracy.ts)에 넣을 만한 특징** (아직 안 넣음):
  - `seoulHourly("area", code, date, dayType(date, holidays))`: 서울 지역의 그 달·그 요일 종류 평소 시간대 인원. 실시간 기록이 모자랄 때(새 지역, 평소 168칸이 아직 안 찬 칸) 사전값, 또는 `live / 평소` 비율 특징
  - `sigunguIndex(sigunguOf("place", id), date, dt)`: 장소 시군구의 그 달·일종류 방문자 지수. 데이터랩 '작년 같은 요일' 값이 없는 날의 대신
  - `stationIndex`·`stationStats(name).top`: 역 승하차의 계절 지수와 행사 날(불꽃축제·벚꽃·집회 등). 해마다 반복되는 행사 날짜 학습용
  - `seoulForeignMonthly`: 외국인 관광객 많은 철 (외국어 화면의 '여행 철' 안내)
  - `sigunguStats(code).h`: 그 지역이 연휴에 붐비는지(>1) 비는지(<1, 도심)
- 서울 지역 화면·예측(`seoul/[code]`, route-data)에 평소 곡선으로 붙이는 건 다른 작업과 겹쳐 아직 안 함.

## 다시 만들기 (저장소 루트에서, 원본은 `.history-raw/` · 커밋 안 함)

```
npx tsx scripts/history/entities.ts .history-raw/entities.json
# 서울 열린데이터 API (최근 2달만 주는 것도 있음): 자치구 시간별 2018-02~, 지하철 시간대 월별 2015~, 일별 최근 8달
node scripts/history/seoul-daily.mjs SPOP_LOCAL_RESD_JACHI 20190101 20260731 spop_gu
node scripts/history/seoul-daily.mjs CardSubwayTime 201501 202610 subway_time_monthly m
node scripts/history/seoul-daily.mjs CardSubwayStatsNew 20260101 20261031 subway_daily
# 서울 열린데이터 파일 (행정동 생활인구는 API가 최근 2달뿐 → 월별 zip, 한 달 약 45MB, 메모리에서 풀어 요약만 저장)
python -I scripts/history/seoul_file.py OA-14991 2607 LOCAL_202607        # 2301~2607
python -I scripts/history/seoul_file.py OA-14993 2607 TEMP_FOREIGNER_202607
python -I scripts/history/seoul_file.py OA-12914 158 SUBWAY_DAY_158       # 114(2023-01)~158(2026-09)
# 공공데이터포털 (운영 한도 집계 키 quota:{날짜}:kto-datalab 에 같이 올림, 한 달 3회)
node scripts/history/datalab.mjs locgoRegnVisitrDDList 202201 202610 200
node scripts/history/datalab.mjs metcoRegnVisitrDDList 201801 202610 110
node scripts/history/busan.mjs
node scripts/history/export-daily.mjs   # 우리 보관본 crowd_daily(Postgres) 내보내기
# 행정동 경계: .history-raw/geo/dong2016.geojson, dong2026.geojson (github.com/vuski/admdongkor)
node --max-old-space-size=8000 scripts/history/build.mjs
```

공휴일 표(2022~2026)는 build.mjs 안에 있다. 해가 바뀌면 덧붙인다.
