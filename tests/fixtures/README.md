# 고정 자료 (DATA_FIXTURES)

공공데이터를 부르지 않고 이 폴더의 JSON으로 화면·계산을 시험한다 (`src/lib/fixtures.ts`). Vercel에서는 켜지지 않는다.

| 상황 | 내용 | 기대 |
|---|---|---|
| `normal` | 서울 121곳 10분 전 자료 (성수카페거리 붐빔 3만~3.2만 고정), 인천공항 주차 | 실시간으로 표시 |
| `stale` | 서울 3시간 전 자료 | 실시간으로 쓰지 않음 (예측으로) |
| `invalid` | 모르는 단계·음수 인구·최소>최대·미래 시각, 주차 면수 초과·음수·숫자 아님 | 서울은 버림, 주차는 정리 |
| `empty` | 서울·주차 빈 응답 | 빈 결과로 안내 |
| `timeout` | (파일 없음) 모든 호출 실패 | 마지막 값 또는 예측 |

시각은 `"@now"`, `"@now-180m"`, `"@now+60m"`로 적으면 읽을 때 그 시각(한국 시간)으로 바뀐다.
공공데이터포털 자료 파일 이름: `datagokr` + 경로의 `/`를 `_`로 (예: `datagokr_B551177_StatusOfParking_getTrackingParking.json`).

- 단위 시험: `tests/fixtures.test.ts`
- 화면 시험: CI는 `DATA_FIXTURES=normal`로 빌드·실행 → `e2e/fixtures.spec.ts`가 정확한 숫자를 비교
