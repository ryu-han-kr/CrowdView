# CrowdView Pulse

테마파크·여행지·이벤트 실시간 혼잡도 + AI 예측 (Next.js 16 + Tailwind 4)

```bash
npm install
npm run dev   # http://localhost:3000
```

환경 변수가 없어도 예측 모델(샘플) + 인메모리 캐시로 동작합니다. `.env.example` 참고.

## 구조

| 경로 | 내용 |
| --- | --- |
| `src/lib/levels.ts` | 혼잡도 5단계 (쾌적·원활·보통·혼잡·매우 혼잡), 내부 점수 0~100 |
| `src/lib/crowd/model.ts` | 요일·시간대 베이스라인 + 공휴일·날씨·관광지 집중률·공항 승객 수 보정 예측 모델, 주간 예측 |
| `src/lib/crowd/signals.ts` | 예측 신호 수집: 특일 정보, 기상청 단기예보, 관광공사 집중률, 공항 시간대별 승객 (`DATA_GO_KR_KEY`) |
| `src/lib/crowd/history.ts` | 실측 스냅샷 기록 (하루 단위, 8일 보관). Redis 연결 시 인스턴스 간 공유 |
| `public/places/` | 장소 대표 사진. 한국관광공사 TourAPI 이미지(공공누리 1·3유형, 출처 표시 필수, 3유형은 변경 금지)를 원본 그대로 보관 |
| `src/lib/place-info.ts` | 한국관광공사 TourAPI 소개 정보로 오늘 운영 시간·휴무일·행사 일정 반영 (하루 1번 호출) |
| `src/lib/crowd/themeparks.ts` | 에버랜드 놀이기구 대기시간 (ThemeParks.wiki, 'Powered by ThemeParks.wiki' 표기 필수) |
| `src/lib/airport.ts` | 공항 탭: 날짜·출국장별 시간대 승객, 주차장 혼잡도 |
| `src/lib/crowd/provider.ts` | 서울시 실시간 도시데이터 연동 (`SEOUL_OPENAPI_KEY`), 실패 시 모델값 |
| `src/lib/crowd/airport.ts` | 공항 혼잡도: 인천공항 T1·T2 출국장, 한국공항공사 김포·제주·김해 (`DATA_GO_KR_KEY`) |
| `src/lib/crowd/service.ts` | 캐시: 15분 신선도, SWR 백그라운드 갱신, 장애 시 이전 데이터 유지 + "n분 전 데이터" |
| `src/lib/cache.ts` | Upstash Redis(REST) 또는 인메모리 |
| `/api/cron/refresh` | Vercel Cron (`vercel.json`). Hobby 플랜은 하루 1회만 허용되어 임시로 `0 0 * * *`, Pro 전환 후 `*/10 * * * *`로 변경. Cron 없이도 요청 시 SWR로 갱신됨 |
| `/api/cron/cost-report` | 매일 09:00 KST 비용 정산 리포트를 PDF로 만들어 디스코드·이메일에 첨부 발송 (`src/lib/billing/`, 폰트 `assets/fonts/` 나눔고딕 OFL). 네이버 클라우드는 Cost and Usage API로 실제 청구액·사용량을 조회하고, 나머지 서비스는 `report.ts`의 고정비 목록을 씀. `CRON_SECRET` 필수, `?send=0`이면 JSON, `?format=pdf`면 PDF만 반환 (발송 안 함) |
| `/api/crowd`, `/api/crowd/[id]` | JSON API |

화면: 홈(트렌드 카드·한산한 곳·목록) / 지도(히트맵) / 이벤트(당일 인원 예측) / 마이(즐겨찾기·키워드 추천·요금제) / 장소 상세(시간대 그래프·AI 방문 추천)

## TODO

- 카카오맵 SDK로 지도 교체 (현재 자체 SVG 투영)
- `seoulArea` 장소명은 서울시 120개 핫스팟 목록과 대조 필요
- 로그인·결제(Supabase + PG), 혼잡 알림, AI 챗봇
