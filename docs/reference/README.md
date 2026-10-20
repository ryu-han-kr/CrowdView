# 레퍼런스 모음 (2026-10-20)

캡처는 모두 PC(1440px)와 모바일(iPhone 13, 390px) 두 장씩 찍었다. 파일 이름 끝이 `-pc` / `-mobile`.
사이트가 봇 확인(Cloudflare) 화면을 띄운 곳은 캡처를 버렸다 (Thrill Data 전체, Undercover Tourist PC).

## 1. 외국 혼잡도·대기시간 서비스 (`foreign/`)

| 서비스 | 무엇 | 캡처 | 주소 |
|---|---|---|---|
| Queue-Times | 전 세계 놀이공원 실시간 대기시간 + 통계·혼잡 달력 (우리 ThemeParks.wiki와 같은 계열) | `queue-times-*`, `queue-times-stats-*` | https://queue-times.com |
| TouringPlans | 디즈니·유니버설 365일 혼잡 달력(1~10단계) + 동선 계획 (유료) | `touringplans-crowd-*` | https://touringplans.com/walt-disney-world/crowd-calendar |
| Undercover Tourist | 올랜도 혼잡 달력: 날마다 혼잡 단계 + 파크별 운영 시간·행사·휴장 시설 | `undercover-tourist-mobile` | https://www.undercovertourist.com/orlando/crowd-calendar/ |
| BestTime.app | 장소별 '주간 붐빔 예측' 데이터 API (구글 '인기 시간대'와 같은 형태) | `besttime-*` | https://besttime.app |

### 가져오면 좋은 것 (우선순위 순)

1. **한 줄 결론 문장** — Queue-Times 통계 화면은 그래프 아래에 "9월이 가장 한산(평균 27%), 3월이 가장 붐빔(66%)", "수요일이 가장 한산"처럼 결론을 글로 써 준다. 우리도 '이번 주'·'12개월' 그래프 아래에 이미 일부 있음 → **요일별 평균 그래프 + 결론 문장**을 장소마다 추가하면 좋다 (10분 기록이 쌓여 있어 계산 가능).
2. **날마다 '그날 무슨 일'** — Undercover Tourist 달력은 날짜 칸에 혼잡 단계와 함께 운영 시간, 행사(할로윈 파티), **운휴 시설**을 같이 보여 준다. 우리 30일 달력에 공휴일·축제·스키장 개장 같은 이유를 칸 안에 넣으면 '왜 붐비는지'가 보인다.
3. **혼잡 숫자 하나 (1~10 또는 %)** — TouringPlans는 1~10, Queue-Times는 "Very quiet (12%)". 단계 이름만 있는 우리보다 비교가 쉽다 → 단계 옆에 0~100 점수를 작게 같이 표시하는 안.
4. **'가장 한산한 시간' 카드** — BestTime 예시 화면은 막대그래프 위에 "8시가 가장 한산 — 일찍 가세요"를 크게 띄운다. 우리 '지금 이후 시간대별 예상'의 ★와 같은 생각, 문장을 더 크게.
5. **내 날짜 추적·변경 알림** — TouringPlans "Crowd change notifications for YOUR dates": 여행 날짜를 저장해 두면 예측이 바뀔 때 알려 준다. 우리 Plus 알림(한산해지면 알림)에 '여행 날짜 저장 → 예측 변경 알림'을 더하는 안.
6. **지역(land)별 묶음 + 지도/목록 전환** — Queue-Times 실시간 화면은 놀이기구를 구역별로 묶고 List/Map 탭을 둔다. 에버랜드·롯데월드 대기 목록을 구역별로 묶으면 길게 늘어지지 않는다.
7. **실측 제보** — Queue-Times "Submit queue time": 사용자가 실제 대기시간을 제보. 우리 정확도 검증(accuracy)에 바로 쓸 수 있는 데이터.

### 피할 것
- 광고가 본문을 가린다 (Queue-Times 모바일 제목 위 배너, 빈 광고 칸). 우리 광고 칸은 본문 사이에만.
- 쿠키 동의 창이 화면 절반을 덮는다 (Undercover Tourist). 우리는 필수 쿠키만이라 띄우지 않는 지금 방식 유지.
- 혼잡 달력 대부분이 유료 잠금 (TouringPlans). 우리는 기본 예측은 무료, Plus는 알림·계획 쪽으로.

## 2. Bklit UI 차트 (`bklit/`)

- 주소: https://bklit.com/docs (구 ui.bklit.com), 깃허브 https://github.com/bklit/bklit-ui — 차트 컴포넌트 MIT 라이선스 (Bklit Studio만 비공개)
- 방식: shadcn 레지스트리. 우리 저장소에 소스를 복사해 넣는다 (`components.json`의 `@bklit`, 설치 `npx shadcn@latest add @bklit/area-chart`)
- 들어간 곳: `src/components/charts/` (영역·막대 차트, 70여 파일), 의존성 visx · motion · d3
- 우리가 고친 점 (소스 안에 `CrowdView:` 주석)
  - `area-chart.tsx`: `yMax` (혼잡도 0~100 고정), 터치 `touch-action: pan-y` (세로로 밀면 화면 스크롤)
  - `use-chart-interaction.ts`: 손을 떼도 고른 값 유지
  - 휴대폰 탭이 들쭉날쭉해서 기본 툴팁 대신 우리 그래프(`HourlyChart`, `DailyForecastChart`)는 위에 투명 터치 층을 두고 직접 시간을 고른다
  - 색·글자 토큰은 `globals.css` 맨 아래 (인디고, 다크 모드는 회색 변수 따라감)
- 캡처: 홈, 영역 차트, 막대 차트 문서 (PC·모바일)

## 3. 반영 결과 (2026-10-20, PR #140)

| 후보 | 반영 |
|---|---|
| 1. 결론 한 줄 + 요일별 평균 | 이번 주 '더보기'에 **요일별** 탭 + "월요일이 가장 한산(평균 47)…" 문장. 실측 하루 요약(`daysum:*`, 매일 새벽 4시)이 요일마다 3일 쌓이면 실측, 그 전엔 12주 예측 |
| 2. 달력 칸에 '그날 이유' | 30일 달력 칸을 누르면 그날 단계·혼잡 지수·이유(공휴일·비·관광공사 예측). 이유가 있는 날은 칸 오른쪽 위 점, 공휴일은 빨간 날짜. 위에 "가장 한산한 날 / 붐비는 날" 문장 |
| 3. 혼잡 숫자 | 지금 혼잡도·시간대 그래프·이번 주·달력에 **혼잡 지수 0~100** |
| 4. 가장 한산한 시간 크게 | "지금 이후 시간대별 예상" 맨 위에 "★ 19시쯤 가면 가장 한산해요" |
| 5. 내 날짜 추적 알림 (Plus) | 이번 주·달력의 고른 날에 **이 날 가요** 버튼 → 매일 아침 9시 예측 단계가 바뀌면, 그리고 전날 아침에 웹 푸시 (`trip_watch` 테이블, 마이 > 저장한 여행 날짜) |
| 6. 구역별 묶음 | 에버랜드 놀이기구를 **구역별(글로벌 페어·아메리칸 어드벤처·매직랜드·유러피언 어드벤처·주토피아)** 평균 대기로. 구역은 ThemeParks.wiki 외부 ID 앞자리로 추정 |
| 7. 실측 제보 | 장소 상세 **방문자 제보**: 5단계(+놀이공원·워터파크·스키장은 줄 선 시간), 최근 3시간 모아 보기, 같은 사람 30분에 한 번 (Redis + `crowd_report` 테이블) |
