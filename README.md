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
| `src/lib/crowd/model.ts` | 요일·시간대 기반 베이스라인 예측 모델 (학습 모델로 교체할 자리) |
| `src/lib/crowd/provider.ts` | 서울시 실시간 도시데이터 연동 (`SEOUL_OPENAPI_KEY`), 실패 시 모델값 |
| `src/lib/crowd/service.ts` | 캐시: 15분 신선도, SWR 백그라운드 갱신, 장애 시 이전 데이터 유지 + "n분 전 데이터" |
| `src/lib/cache.ts` | Upstash Redis(REST) 또는 인메모리 |
| `/api/cron/refresh` | Vercel Cron 10분 주기 (`vercel.json`) |
| `/api/crowd`, `/api/crowd/[id]` | JSON API |

화면: 홈(트렌드 카드·한산한 곳·목록) / 지도(히트맵) / 이벤트(당일 인원 예측) / 마이(즐겨찾기·키워드 추천·요금제) / 장소 상세(시간대 그래프·AI 방문 추천)

## TODO

- 카카오맵 SDK로 지도 교체 (현재 자체 SVG 투영)
- `seoulArea` 장소명은 서울시 120개 핫스팟 목록과 대조 필요
- 로그인·결제(Supabase + PG), 혼잡 알림, AI 챗봇
