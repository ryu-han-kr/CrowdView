# CrowdView 종합 진단 및 SEO·GEO·제품 성장 로드맵

- 작성 기준: 2026-10-17
- 서비스: https://crowdview.app
- 검토 근거: 사용자 제공 `2026-10-17_2.md`, 운영 사이트 공개 HTML 텍스트, Google Search Central/네이버 서치어드바이저/Next.js 공식 문서
- 검토 범위 제한: 사용자 업로드는 인수인계 1개 Markdown 파일이며, 그 문서에 언급된 전체 설명서 PDF 및 실제 저장소 소스코드는 포함되지 않았다. 공개 GitHub 저장소 URL은 접근되지 않았다. Lighthouse 실측, Search Console 데이터, robots.txt 및 sitemap.xml 원문은 도구 환경에서 확인하지 못했다. 이에 아래 기술 권고는 확인 결과와 검증 필요 사항을 구분한다.

## 1. 의사결정 요약

**추천 포지셔닝**: ‘지금 어디가 덜 붐비는지 확인하고, 실제로 갈 수 있는 여행 동선을 만드는 서비스’. 실시간 혼잡도 자체보다 ‘시간·장소·날씨·영업시간·이동시간을 통합해 방문 결정을 돕는 경험’이 차별점.

**기능 확대 전 최우선**: (1) 실측/추정/샘플/예보 구분 및 예측 검증, (2) 장소별 혼잡 단계 정책 통일, (3) 추천 코스·방문 추천 운영시간 반영, (4) 기본 서버 렌더링과 검색 노출 기반 구축, (5) 오류·레이트리밋·법적 고지 정비.

**시장 진입 제안**: 국내 서울 혼잡/인천공항/주말 여행 3개 사용 사례에 집중→기존 장소/축제 상세를 검색 랜딩 페이지로 최적화→다국어·전국 확대→결제 검증. 지금은 더 많은 장소를 수집하는 것보다 기존 데이터의 신뢰·전환 흐름을 개선할 때.

## 2. 확인된 현재 구조

- Next.js 16 / Cloudflare DNS + Vercel Pro 서울 리전(icn1), 월 비용 상한 $50 설정(인수인계 기준)
- Redis Upstash: 현재 혼잡도, 캐시, 호출 수, 번역, 공유 코스, 알림 중복 방지
- Neon Postgres: 마이그레이션은 있으나 DB 준비되지 않음; 계정/정기결제/찜/알림 미실가동
- 정적 데이터: 서울 가이드 2,755건, 지하철망 634역, 전국 명소 1,856건, 대표 랜드마크 66건
- 크론: 10분 수집, 매일 비용 리포트; 주간 정적 데이터 배포
- 문서상 키 부재: 로그인/결제/웹푸시/메일/admin/광고/검색 소유 인증 일부
- PR 기준 20개 테스트, CI; API 및 E2E 수준 실제 검증 필요

### 주요 URL 공개 페이지

| 영역 | 공개 페이지 | 확인/진단 |
|---|---|---|
| 홈 | `/` | 폭넓은 기능, 6개 프로모션 배너·아이콘 메뉴·실시간 목록·축제·지역 추천·Plus |
| 서울 혼잡 | `/seoul` | 119곳 데이터가 본문에 노출, 검색·필터·지도·찜 |
| 서울 상세 | `/seoul/POI008` | 서울시 공식 단계·12시간 예보·주변 생활정보·FAQ |
| 장소 상세 | `/place/gyeongbokgung` | CrowdView 자체 단계·주간 추정·날씨·시간대·운영·FAQ·숙소 |
| 공항 | `/airport`, `/airport/icn-t1` | 공항별 혼잡·보안 구간·입국·주차 등 |
| 코스 | `/route` | 출발지/요일/시간/기간/관심사/이동수단 |
| 전국 축제 | `/events`, `/festival/kto-2618014` | 전국 267행사, 지역별 추정 혼잡 설명 |
| 지역여행 | `/explore` | 지역 대표 관광지·축제. 본문에 `한국관광공사 등록 0곳`, `불러오는 중…` 표시 관찰 |
| 서울 가이드 | `/guide` | 검색 엔진이 읽은 페이지상 분류 0개, `불러오는 중…` 표시 관찰 |
| 요금 | `/pricing` | Plus 월 3,900원, 결제 연결 준비 중 |
| 개인정보 | `/privacy` | 시행일 2026-11-01, 연락처 등록 예정 |

## 3. 중대 관찰과 재현 시나리오

### 3.1 경복궁 같은 장소에서 화면별 판단 기준이 다름 — P0

- `/place/gyeongbokgung`: 방문 시 ‘쾌적’(CrowdView 자체 기준), 본문에 서울시 공식 단계 ‘보통’이라고 따로 안내.
- `/seoul/POI008`: 서울시 공식 혼잡도 ‘보통’.
- 동일 이름에 쾌적/보통/혼잡 등의 표기가 일관되지 않으면 사용자가 잘못 이해할 수 있다. 원시 데이터가 같아도 기준이 다르면 서로 다른 등급이 나오는 상황은 가능하다.
- 제안: 서울 119곳은 공식 서울시 혼잡 단계(`official_level`)를 기본 배지로 통일하고, CrowdView 자체 기준은 `cv_estimated_level`로 명확히 분리. 전국 추정치는 공식과 시각적으로 구별. `관측 인구/공식 단계/자체 추정 단계`를 데이터 모델에서 강제 분리.
- 검증: 같은 `place_id`, 같은 `observed_at`이면 홈/목록/상세/API의 공식 단계와 추정값이 일치하며, 캐시 업데이트 지연 시 모든 화면에 수집시각을 노출.

### 3.2 ‘가장 한산한 시간’이 ‘방문 가능한 시간’이 아님 — P0

- `/seoul/POI008`: 앞으로 12시간 중 02:00가 가장 한산하다고 표기.
- `/place/gyeongbokgung`: 영업 09:00~18:00 및 17:00 추천 표기. 다른 공식 12시간 예측에서는 17:00 `매우 혼잡` 표기 관찰.
- `argmin(혼잡도)`만으로 방문시간을 고르면 운영 종료·휴관·전시 마감 등 무의미한 결과가 나옴.
- 제안: 추천 후보 시간대는 `개관시간 ∩ 입장허용 ∩ 이동가능 ∩ 기상안전 ∩ 이용자 일정`으로 제한. 후보가 비면 ‘현재 조건에 추천 가능한 시간 없음’ 표시. 목적함수는 혼잡도+이동시간+날씨+대기+영업 제약.
- 검증: 휴관일/폐장/마지막 입장 시각 이후 추천 0건; 가이드와 코스 결과 일치; 인천공항은 24시간 가능 영역 별도 처리.

### 3.3 실측/추정/샘플/행사 수준의 혼재 — P0

- `/place/haeundae`: ‘3분 전 갱신 · CrowdView 예측 모델 (샘플)’과 함께 현재 인원 약 5만 명(추정). 사용자가 숫자를 실측으로 오해할 수 있음.
- `/place/busan-fireworks`: 11월 7일 개최 예정(D-21) 행사도 10월 17일 현재 혼잡도 9,000명(추정)으로 보이며, 행사 자체의 관객 수를 뜻하는 듯한 인상을 줄 수 있음. 해당 기간 상권 추정과 행사 당일 예보를 뚜렷이 분리해야 함.
- `/festival/kto-2618014`: ‘보통’은 인제군 전체 작년 같은 요일 방문자 증가율 +46%를 근거로 산정. **축제장 실시간 입장 인원이나 축제 자체 대기시간이 아님**.
- 제안: `OBSERVED_OFFICIAL`, `OFFICIAL_FORECAST`, `MODEL_FORECAST_VALIDATED`, `HEURISTIC_ESTIMATE`, `HISTORICAL_PROXY`, `SAMPLE`, `UNAVAILABLE`의 데이터 품질 상태를 모델화. SAMPLE은 기본 공개 랭킹에서 제외(개발용); 과거 군 단위 데이터는 ‘지역 방문 증가 예상’으로 레이블 변경; 시점과 지리적 범위 포함.
- 앱 전체에 ‘실시간’이라는 표현은 실제 실측에만 사용. 예측을 ‘AI’로 명명할 때 모델 검증·적용 데이터·오차 지표와 설명을 병기. 임의 시간대 곡선이면 ‘규칙 기반 추정’으로 표시.

### 3.4 검색 크롤링 시 서울 가이드가 비어 보이는 위험 — P0/P1

- `/guide`: ‘명소 0/맛집 0/쇼핑 0/자연 0’, ‘불러오는 중…’이 공개 크롤링 텍스트에 나옴.
- `/explore`: 대표 명소·축제는 보이지만 더 많은 명소 영역은 ‘한국관광공사 등록 0곳’과 ‘불러오는 중…’으로 노출.
- 반드시 프런트 오류라고 단정할 수는 없음. 브라우저에서 데이터 호출 완료 후 정상화될 수 있으나, HTML만 수집하는 검색엔진·AI 로봇에게 핵심 정보가 전달되지 않는 위험이 존재.
- 제안: 핵심 목록/인기도 상위 20개/총 건수/설명/내부링크 SSR 또는 정적 생성; 추가 필터와 지도만 CSR. 네트워크 실패 시 재시도/오류/기본값 구분. 외부 API가 없어도 캐시된 마지막 정상 스냅샷 노출.

### 3.5 마감된 예약 활동 노출 — P1

- `/guide`에서 ‘지금 예약할 수 있는 체험’에 ‘접수 마감 10-16’ 카드가 10월 17일에도 보임.
- 제안: 카드 조건 `registration_status === OPEN`과 `registration_deadline >= now` 모두 만족. 예약 상태를 확신할 수 없으면 ‘예약 확인하기’로 표기하고 마감된 결과는 과거 프로그램 섹션으로 이동.

### 3.6 사업·결제·법적 고지 완성도 — P0

- `/pricing`: 결제 연결 준비 중인 상태에서 월 3,900원으로 표현. 결제 오픈 전 베타/예정 표기 통일.
- `/privacy`: 시행일이 검토일(10/17)보다 미래인 11/01이고 책임자 연락처 `등록 예정`.
- 홈/전역 footer: 통신판매업 신고, 주소, 고객센터 등 ‘등록 예정’.
- 제안: 실제 서비스 운영과 일치하는 정책 시행일, 고객 문의·환불 채널, 회사/사업장 정보·위탁처 및 국외 이전 사실 확정. 14세 미만, 위치정보, 알림 권한, 광고 동의, 국가별 외국인 결제 등이 기능화될 때 정책 동기화. 출시 전 국내 법규 전문가 검토 프로세스 구성.

## 4. 서비스/UX 전략

### 4.1 핵심 사용자 여정

1. 유입: 구글/네이버 ‘경복궁 혼잡도’, ‘인천공항 보안검색 대기’, ‘이번 주말 서울 한산한 곳’
2. 확인: 공식 실측 여부/마지막 갱신/혼잡 추이/영업시간 3초 내 파악
3. 결정: ‘지금 가기’, ‘언제 가면 좋을지’, ‘대신 갈 한산한 곳’
4. 실행: 교통 소요·지도 길찾기·일정 저장·공유
5. 재방문: 원하는 장소/기준 혼잡 변화 알림, 주말 자동 요약

첫 방문 홈의 한 개 주요 CTA를 ‘지금 한산한 곳 찾기’로, 보조 CTA를 ‘주말 코스 만들기’로 단순화. 홈의 여섯 배너와 많은 메뉴 중 실제 사용 목적별 첫 분기를 명확히 한다.

### 4.2 화면별 개선

**홈**: 오늘 날짜·수집 상태, 실측만의 ‘지금’ 구역, 추정 정보의 별도 구역, 지역/날짜 선택, 현재 날씨/여행 가능성, 1차 행동 단순화. 6개 자동 롤링 배너는 일시정지·수동 컨트롤·모바일 높이 최적화.

**장소 상세**: 첫 폴드 `장소명 / 공식 혼잡도 / 기준시각 / 영업 여부 / 2시간 후 추세 / [길찾기][찜하기]`. 데이터 출처·산식은 펼침으로. 영업 종료 시 ‘지금 쾌적’ 대신 ‘영업 종료, 내일 추천시간’ 우선.

**서울 목록**: 지도와 목록 전환 상태 유지, 필터 URL 공유, 사용자가 즐겨찾는 지역 상단 배치, 공식 단계 범례. ‘쾌적/원활’ 의미 설명.

**축제**: 행사 일시, 실제 진행 상태, 행사장 주소, 행사장 관객 실측 부재 경고, 작년 해당 시군구 방문 증가 추정 분리. 날짜 변경·우천 취소 상태 반영.

**코스**: 방문 장소별 체류시간, 영업/휴관, 입장 시간, 점심/저녁 시간, 환승 비용, 날씨, 접근성 옵션. 사용자가 중간 순서를 드래그 수정하고 즉시 재계산하도록.

**공항**: 출국장 대기시간의 `기관 실측` vs `사이트 계산` 구분, 항공편 예상 출발시각 입력, 터미널/보안 검색/주차 상황, ‘권장 공항 도착 시각’은 정책과 불확실성 표시.

**외국어**: 국가 IP만으로 강제 리다이렉트하지 말고 수동 언어 유지, 영어/일본어/중국어 랜딩을 실제 번역된 상세 본문과 별도 URL로 제공.

## 5. SEO 종합 실행 계획

### 5.1 검색 등록·색인 실태를 먼저 측정

현재 인수인계 파일에 검색엔진 소유 확인이 꺼져 있다고 기록. `robots.txt`, `sitemap.xml`의 존재 및 응답 코드는 이번 검사 환경에서 확증하지 못함.

구현/점검 체크:
- https://crowdview.app/robots.txt 200 OK, text/plain, sitemap 위치와 admin/API/인증 영역 정책
- https://crowdview.app/sitemap.xml 200 OK, XML 파싱, canonical, 200 페이지로만 구성, `lastmod`는 실제 콘텐츠 수정일
- Google Search Console 도메인 소유 확인 + 사이트맵 제출 + 색인·사용자 경험 보고서
- Naver Search Advisor 소유 확인 + 사이트맵/RSS(실제 RSS가 있을 때만), 검색로봇 Yeti 수집 여부
- Bing Webmaster Tools 등록·사이트맵 제출
- 요청 URL별 title/description/h1/canonical/robots/og/twitter/lang/JSON-LD 검증
- Cloudflare WAF·봇 관리가 Googlebot, Yeti, Bingbot, OAI-SearchBot 등 정상 요청을 차단하지 않는지 검사
- `?cat=` 등 필터·정렬 파라미터는 원본 콘텐츠와 중복되면 canonical 기준 설정
- 404/soft-404, 무한 로딩, sitemap의 미완성 페이지 제외

### 5.2 SEO URL 아키텍처

| 랜딩 의도 | 예시 URL | 제안 |
|---|---|---|
| 브랜드 | `/` | ‘전국 실시간 혼잡도·여행 코스’로 가치 설명 |
| 서울 일반 | `/seoul` | 119개 지역·공식 출처·내부 상세 링크 |
| 도시 혼잡 | `/seoul/POI008` | 공식 측정 상세, 자체 분석과 구분 |
| 여행 상세 | `/place/gyeongbokgung` | 운영시간·예측·주변여행·FAQ·출처 |
| 지역 묶음 | `/explore/seoul`, `/explore/busan` (신규) | 지역별 자체 설명·대표 명소·실측 가능한 곳 |
| 공항 | `/airport/icn-t1` | 출국장·주차·일정별 해석 |
| 축제 | `/festival/{id}` | 개별 행사 정보·날짜·주최·상태 |
| 축제 지역/월 | `/events/seoul`, `/events/2026-10` (선별적) | 중복 방지, 실제 고유 설명 있는 것만 색인 |
| 관광지 신규 | `/spot/{stable-slug}` | 원천 데이터 복제 아닌 고유 정보가 있는 곳만 |
| 노하우/데이터 | `/methodology`, `/data-sources` (신규) | 계산 방식·샘플 여부·업데이트·한계 |

주의: `/place/gyeongbokgung`과 `/seoul/POI008`은 내용·검색 의도가 다르면 둘 다 색인할 수 있지만, 제목·본문이 사실상 같다면 통합하고 301 또는 canonical. 한 장소의 여러 주소를 무분별하게 추가하지 말 것.

### 5.3 키워드 그룹 / 랜딩 콘텐츠

- 긴급 확인 의도: ‘지금 경복궁 혼잡도’, ‘강남역 실시간 인구’, ‘인천공항 T1 출국장 대기시간’ → 사실, 출처, 갱신시각, 현재/예측.
- 일정 계획 의도: ‘이번 주말 서울 한산한 곳’, ‘서울 비 오는 날 실내 데이트’, ‘서울 3시간 덜 붐비는 여행 코스’ → 시나리오 설명 + 결과/지도.
- 지역 관광 의도: ‘부산 가볼 만한 곳’, ‘제주 여행 추천’, ‘10월 서울 축제’ → 큐레이션+근거+연관링크.
- 비교 의도: ‘에버랜드 오늘 대기시간’, ‘인천공항 T1 T2 혼잡 비교’ → 방법론을 일관화한 비교.
- 외국어 의도: ‘Seoul live crowd levels’, ‘Gyeongbokgung best time to visit’, ‘Incheon Airport security wait time’ → 언어별 별도 URL과 충실한 번역.

타이틀 예시(광고성 확정 대신 데이터의 실제 범위 표시):
- `경복궁 실시간 혼잡도·방문 추천 시간 | CrowdView`
- `인천공항 제1터미널 출국장 혼잡·대기시간 | CrowdView`
- `서울 119곳 실시간 인구·혼잡도 비교 | CrowdView`
- `2026년 10월 서울 축제 일정·지역 혼잡 추정 | CrowdView`
- `부산 해운대 혼잡 추정·방문 시간대 | CrowdView` (**실측이 아니면 제목에도 추정**) 

### 5.4 기술 SEO

- Next.js Server Component에서 주요 텍스트/항목/내부 링크 생성, 검색·지도 필터만 Client Component 분리.
- `generateMetadata`로 장소별 title, description, canonical, openGraph, twitter, robots, hreflang 생성.
- 정적 본문은 ISR/캐시로 제공; 빠른 실측 데이터만 별도 짧은 캐시 또는 비동기 상태로 주입. 시시각각 바뀌는 숫자를 Google이 곧바로 반영한다고 기대하지 않기.
- `sitemap.ts`와 `robots.ts`를 실제 구현·테스트, sitemap은 `lastmod`를 크론 실행시각이 아닌 유의미한 페이지 변경시각으로.
- 이미지 `next/image`, 명시적 width/height, AVIF/WebP, responsive sizes, hero preload(우선순위 제한), lazy loading.
- Core Web Vitals 실측 목표: p75 모바일 LCP ≤2.5초, INP ≤200ms, CLS ≤0.1. 보고서에는 미측정이며 목표치임을 명시.
- 지도 SDK와 축제 사진은 상호작용 시 지연 로딩, 스켈레톤 공간 예약, 서버 최우선 텍스트 렌더링.
- `?cat=` 필터, 정렬, 검색, pagination에 명시적 색인 정책. 색인 가치 없는 URL 확산 차단.
- 구조적 탐색경로 `홈 > 서울 실시간 > 경복궁`과 내부 링크 그래프.

### 5.5 구조화 데이터

| 화면 | schema.org 타입 | 참고 |
|---|---|---|
| 홈 | `Organization`, `WebSite` | 브랜드/로고/사이트명, 검증된 SNS |
| 명소 상세 | `TouristAttraction` 또는 `Place`, `BreadcrumbList` | 사실과 일치하는 운영정보·주소·사진 |
| 축제 상세 | `Event`, `BreadcrumbList` | 실제 행사 날짜/상태/위치(이벤트마다 고유 URL); 일반 목록에 Event 일괄 삽입 지양 |
| 지역 목록 | `CollectionPage`, `ItemList`, `BreadcrumbList` | 보이는 유효 항목과 일치 |
| 방법론 | `TechArticle` 또는 `Article`(실제로 논설 콘텐츠일 때) | 작성자/최종 검증일/출처 |
| 데이터 공개 페이지 | `Dataset`(실제 배포 가능한 데이터셋이 있는 경우) | 공개 범위·라이선스·측정범위 |

구조화 데이터는 검색순위나 리치결과를 보장하지 않는다. `FAQPage`는 일반 사이트의 FAQ 리치결과 확대 전략으로 보지 않는다. 페이지 본문의 FAQ는 사람과 AI에게 도움이 되므로 유지.

## 6. GEO / AI 검색에 인용될 수 있는 설계

Google의 공식 문서에는 AI Overviews·AI Mode에 **별도 필수 GEO 태그가 없다**고 명시되어 있다. 페이지가 색인되고 스니펫 표시 가능하며 정확하고 사람에게 유용한 내용이어야 한다. `llms.txt`는 시범적으로 제공할 수 있으나 특정 AI 엔진의 인용을 보장하는 공식 순위 신호가 아니다.

**실행 우선순위**
1. 모든 지역/명소마다 질문에 즉답하는 `한 문장 상태 요약` + `근거 표` + `갱신시각/데이터출처/실측 여부`를 페이지 HTML에 삽입.
2. `/methodology`, `/data-sources`, `/accuracy` 발행: 공식 API, 모델 입력, 보정 방식, 기준 변경, MAPE/MAE 등 검증된 성능 수치, 데이터 한계.
3. 장소와 축제 각각의 안정적인 공유 URL 및 콘텐츠 식별자, `dateModified`는 실제 컨텐츠 갱신 반영.
4. OAI-SearchBot 등 AI 검색 크롤러 접근 허용 여부 검증. GPTBot 학습 접근과 OAI-SearchBot 검색은 **독립적인 선택**.
5. 언어별 페이지 콘텐츠와 hreflang. IP 리다이렉트 강제하지 않기.
6. 동일 정보 재인용 가능하도록 표/문장/HTML의 논리 구조를 단순화. 지도 Canvas에만 핵심 내용을 저장하지 않기.
7. 근거 없는 공식 인증/1위/정확도 숫자, 거짓 후기, AI가 만든 가상 사용자 평점 금지.

**좋은 답변형 콘텐츠 예시**
> Q. 경복궁이 지금 붐비나요? A. 서울시 공식 혼잡 단계는 [보통]이며 2026-10-17 14:10 KST 관측값은 [2,500~3,000명]입니다. 단, CrowdView의 자체 방문 편의 단계는 다른 임계값을 적용하므로 [쾌적]일 수 있습니다. 동일 장소 내 공식/자체 단계는 구분됩니다.

수치와 시간은 예시 스냅샷으로만 사용하고 페이지에는 현재 유효한 동일 관측 레코드 사용.

**AI 유입 성과 지표**: ChatGPT/Perplexity 등 referrer별 세션, 해당 랜딩의 페이지 전환율, 질문형 검색어, 검색 노출·클릭·유입, 출처 인용의 표본 수동 점검. 인용 횟수를 자동 확정 측정할 방법이 항상 있는 것은 아니므로 도구별 추정치와 실제 추천 유입을 구분.

## 7. 추천 알고리즘 및 데이터 모델 개편

### 7.1 단일 데이터 계약

```ts
type DataQuality =
  | 'OFFICIAL_OBSERVED'
  | 'OFFICIAL_FORECAST'
  | 'MODEL_VALIDATED'
  | 'RULE_BASED_ESTIMATE'
  | 'HISTORICAL_AREA_PROXY'
  | 'SAMPLE'
  | 'UNAVAILABLE';

type CrowdObservation = {
  placeId: string;
  sourceName: string;
  sourceUrl?: string;
  sourceGeography: 'venue' | 'district' | 'city' | 'county';
  kind: DataQuality;
  observedAt: string | null;
  fetchedAt: string;
  validUntil: string;
  populationRange?: [number, number];
  officialLevel?: 'comfortable' | 'normal' | 'busy' | 'very_busy';
  estimatedLevel?: string;
  modelVersion?: string;
  predictionFor?: string;
  sample: boolean;
};
```

`sourceGeography`와 `kind`는 사용자에게 노출하는 데 사용. 불확실한 수치를 소수점까지 정밀하게 표현하지 않고, 공식 관측과 비교 검증을 통과한 모델만 예측으로 승격. 미검증·샘플 추정치는 주 탭/OG/SEO 메타에서 실측처럼 노출하지 않기.

### 7.2 추천 알고리즘

후보 시간대를 **실제 방문 가능 집합**으로 먼저 제한:
```
feasible = intersection(
  openingHours - closedDays - lastAdmission,
  userAvailability,
  transportReachability,
  safetyWeatherWindow
)
```

후보마다 `score = w1*crowd_percentile + w2*travel_duration + w3*weather_penalty + w4*queue_cost + w5*uncertainty_penalty` 최소화. 확실한 실측/검증된 예측이 없으면 불확실성을 가중 처벌. 체류기간과 이동 경로를 포함하는 다중 장소 최적화는 작은 후보집합에서 전수/beam search로 시작하고 복잡도 증가 시 휴리스틱.

### 7.3 정확도 검증

- 1시간/3시간/24시간 선행 예측을 대상으로 실제 관측과 시간 정렬해 MAE, WAPE, 등급 일치율, 혼잡 위험 false-negative 비율 계산.
- 주말·공휴일·강우·콘서트·방학·시간대별 분리 검증.
- 신뢰도 없는 지역은 `예측 준비 중` 표시. 내부 검증 결과가 기준 충족하기 전 ‘AI 정확 예측’ 마케팅 금지.
- 모델 버전, 학습/검증 분리, 소스 수집 시각, 장애·보정 이력 저장.
- 데이터 드리프트와 이상치 감지: 0명 갑작스런 등장, 역전된 시각, 높은 동일 연속 수치, 갑작스런 API 빈 응답 등.

## 8. 서비스 아키텍처·보안·운영

### 8.1 플랫폼 독립 구조

- `providers/`에 서울시·공항공사·관광공사·공원 대기 소스별 Adapter: `fetch -> normalize -> validate -> save raw snapshot`.
- `domain/crowd/`에 품질·예측·추천 정책을 모아 Vercel API route와 분리.
- `application/`에 검색/추천/찜·알림 사용사례.
- `storage/`에 Redis 캐시·Neon Postgres 추상화; 사용자 DB 개설 후 원본 스냅샷을 어디에 쌓을지 결정(장기 이력은 RDB/Object Storage를 고려).
- `web/`에 Server Components·Client Components. 크론과 배포 환경 종속 코드를 어댑터로 감쌈.
- 후일 AWS/GCP 이전 시 외부 데이터 계약·환경변수·비즈니스 로직을 재사용.

### 8.2 운영 기준

- `/api/health`와 데이터 신선도 체크: 소스별 `last_success_at`, `last_valid_at`, 실패 횟수, stale 비율.
- Cron 고립: 중복 실행 락, 실패 시 exponential backoff, 타임아웃, 429 처리, 운영계정 쿼터.
- Redis에 갱신주기보다 긴 적절한 TTL/마지막 정상값(fail stale) 유지 정책 정의; ‘지금’ 정보의 만료 임계값을 더 엄격히.
- API: 공개 조회 rate limit(아이피 또는 위험도 기반), 관리자 RBAC, 서버측 결제 검증, webhook signature/replay 보호, 고비용 코스 생성 호출 제한.
- 민감 키 서버측만, 로그에 PII/결제 식별자 마스킹, 환경별 비밀 관리, 세션/CSRF/redirect URI 점검.
- 알림 중복 방지와 사용자의 조건 달성 기준 구분, 빈번한 알림 억제 및 한산해짐 알림 정확도 검증.
- Sentry 또는 동등한 도구로 서버/브라우저 에러, OpenTelemetry 트레이스, 스케줄 실패 알림.
- 실사용 모니터링: Core Web Vitals + API p95 latency + 오류율 + 데이터 stale 비율 + 캐시 hit율 + 월별 호출/비용.
- Upstash 2026-10-23 전후 사용량 점검(인수인계 일정). 비용 리포트의 데이터 수집 실패와 경고 알림도 검증.

### 8.3 비용 최적화

- 평균 요청당 비용 = (외부 API 호출료 + Vercel 함수 실행/대역폭 + Redis 명령 + 이미지 변환/전송 + DB + 로그 비용) / 월 요청수.
- 장소 목록/메타 정적 캐시와 ‘현재 상태’ 5~10분 단위 캐시를 분리. 동시 사용자 요청이 원천 API에 직접 연결되지 않도록.
- 지역/언어/데이터버전 기준 캐시 키 설계. 캐시 key 폭증을 막기 위해 필터 조합은 서버 캐시 대상 최소화.
- 각 제공자 정책에 따라 수집·보존·제휴·재배포 권한을 확인.

## 9. 수익모델 / 성장

### 가치 사다리

**무료**: 혼잡도 전체, 기본 조회·주간 추이, 기본 여행 코스, 공유, 찜 일부. 가장 넓은 유입 키워드용 유용 콘텐츠는 검색 방문자가 바로 볼 수 있게 공개.

**Plus**(가설 월 3,900원): 신뢰할 수 있는 맞춤 혼잡 알림, 반복 출발 일정, 날씨/혼잡 급변 경고, 저장한 상세 코스, 여러 일정 비교·내보내기, 광고 제거. 돈을 낼 만큼 차별적 편익이 있는지 베타에서 정량 검증.

**제휴**: 숙소·체험·교통 연결 클릭과 실제 제휴 정산 검증. 광고/제휴 콘텐츠는 광고임을 표시하고 혼잡도 추천 순위와 무분별하게 섞지 않기.

**B2B 가설**: 지역 상권/관광시설 대시보드, 공개 데이터의 합법적 재가공 범위 내 혼잡 추이·데이터 API. 데이터 권리와 개인정보 기준 검증 선행.

**유입 퍼널**: 검색 진입 → 장소 확인 → 다른 시간/대안 비교 → 코스 생성 → 저장/공유 → 알림 신청 → 유료 전환. 플러스 전환율만 보지 말고 ‘코스 완성율’, ‘알림 유효 클릭률’, ‘다음 주 재방문’을 우선.

## 10. 높은 가치의 추가 기능 우선순위

| 순위 | 기능 | 이유 | 추정 난도 |
|---|---|---|---|
| 1 | 장소 운영시간 반영 + 오늘 추천시간 정비 | 잘못된 추천 즉시 제거 | 중 |
| 2 | 실측/예측/샘플 배지 + 데이터 신뢰도 | 사이트 신뢰 기반 | 중 |
| 3 | `가장 한산한 대안 3곳` + 이동시간 | 즉시 의사결정과 저장 전환 | 중 |
| 4 | 장소별 24h 비교·이번주 추이 (실제 검증된 값만) | 재방문/장기 검색 의도 | 중 |
| 5 | 코스 저장·카카오톡 공유·OG 개인화 | 바이럴/유입 | 중 |
| 6 | 날씨·혼잡·영업 통합 추천 | 차별화 | 중~상 |
| 7 | PWA 홈 화면 추가·푸시 상태 UI | 재방문 | 중 |
| 8 | ‘일정과 예산에 맞춘 여행’ 추천 | 코스 완성률 | 상 |
| 9 | 영어/일본어/중국어 SEO 세트 | 인바운드 시장 | 상 |
| 10 | PDF·캘린더 일정 내보내기 | 코스 외부 사용 | 중 |
| 11 | 공식 데이터 품질 공개 대시보드 | 신뢰/언론 인용/GEO | 중 |
| 12 | 비용/데이터 운영 관리자 | 유지보수 절감 | 중 |

**지금은 비추천**: LLM 대화형 플래너를 핵심 기능보다 먼저 배포, 샘플 데이터 전국 확대, 적극적 유료화 전환, 무검증 AI 정확도 표현, 검색 유입을 노린 수천 개의 동일한 자동 생성 글.

## 11. 실행 순서 및 완료 조건

### 1주차: 공개 품질 및 크롤링 기반 (P0)

- 공개 중인 SAMPLE/추정 수치 재분류, 잘못된 ‘실시간’ 문구 제거
- 경복궁 포함 동일 장소 공식/자체 단계 불일치 정책과 API 단일화
- 추천/코스 운영시간 필터 및 회귀 테스트
- `/guide` `/explore`의 SSR 대표 콘텐츠/빈 상태/오류 상태 개선
- 결제 준비 중·고객센터·약관·사업자 고지 정리
- 검색 소유권/robots/sitemap/canonical 상태 실제 점검 후 등록

**완료 기준**: SAMPLE 실시간 공식 배지 0건, 닫힌 장소 추천 0건, 동일 `placeId` 공식 혼잡 단계 충돌 0건, 핵심 랜딩 HTTP 200+독립 title+H1+서버 본문+내부 링크, 법적 연락 채널 실제 동작.

### 2~3주차: SEO, 안정성, 전환 (P1)

- 서울/공항/축제 50~100개 우선 페이지 메타·OG·Breadcrumb+Event schema 적용
- `/methodology`, `/data-sources`, `/accuracy` 텍스트 출처 페이지, 인기 랜딩에서 링크
- 모바일 CWV 실측/개선, 이미지 최적화, 지도 지연 로딩
- rate limit/observability/시스템 장애 시 마지막 정상 데이터 + stale UI
- ‘대신 갈 곳 3곳’ A/B 테스트와 공유 funnel 이벤트 계측

**완료 기준**: 중요 페이지 구조화 데이터 검사 오류 0건, 모바일 p75 CWV 목표에 대한 계측, 대표 사용자 여정 E2E 통과, 수집실패 알림 동작, Search Console 색인 추이 시작.

### 4~6주차: 예측 정확도/검색 콘텐츠 (P1)

- 예측 모델 backtest + 예측 품질 대시보드
- 질 높은 신규 지역 랜딩 10~20개, 주말 콘텐츠 5~10개 우선
- 코스 저장/공유/리마인드 신뢰성, 장소 휴무/예약 상태 처리
- 실제 베타 사용자 인터뷰 및 사용자 행동 분석

**완료 기준**: 모델 버전별 오차 보고, 배포 전후 추천 실패율 개선, 1개 이상 사용자 코호트의 재방문 추세 파악.

### 7~12주차: 지역/외국어/유료 검증 (P2)

- 인기 인바운드 랜딩(서울/인천공항)만 영어부터 실제 콘텐츠 현지화
- 결제/해지/환불 전체 트랜잭션 sandbox→production 전환 검증
- 해외 IP 강제 전환 대신 각 언어 인덱싱과 hreflang
- 성과가 입증된 지역/알림에만 범위 확대

**완료 기준**: 유입 쿼리별 랜딩 전환, 플러스 체험 의향 및 실제 결제 성공/해지/환불, 데이터 SLA 달성 여부를 보고 후 다음 투자 판단.

## 12. 검증 테스트 케이스

- [ ] `placeId=경복궁`의 `/`, `/seoul`, `/seoul/POI008`, `/place/gyeongbokgung`이 같은 공식 기준시각/단계 사용.
- [ ] 자체 혼잡 등급은 자체 추정임을 반드시 별도 레이블로 표기.
- [ ] 마감 18시인 장소를 02시에 방문하라고 추천하지 않음.
- [ ] 17시 입장 마감이면 추천은 실제 입장 가능 시각만 포함.
- [ ] SAMPLE 수치는 검색 메타·OG·실측 섹션에 실측으로 출력되지 않음.
- [ ] 시군구 방문객 증가율을 축제장 인원으로 표시하지 않음.
- [ ] 행사 시작 전 이벤트의 현재 혼잡과 행사 당일 혼잡 예측이 분리됨.
- [ ] 비로그인·봇·JavaScript 비활성에서도 `/guide` 주요 목록 및 내부 링크가 서버 HTML에 있음.
- [ ] 외부 API 장애에서 빈 값/0명 대신 ‘정보 갱신 지연’ 또는 마지막 정상값(시각 표기)을 노출.
- [ ] 필터링 쿼리 파라미터가 중복 색인 확대를 일으키지 않음.
- [ ] 모든 공식 인덱싱 URL의 canonical은 의도된 HTTPS 정규 URL.
- [ ] 다국어 간 hreflang과 본문 언어 일치, IP와 관계없이 모든 버전에 접근 가능.
- [ ] 날짜/장소 없는 Event JSON-LD, 허위 review/rating, 미제공 서비스 offers 등의 마크업이 없음.
- [ ] 고객센터 연락, 정책 시행일, 실제 결제 대행사 및 결제 단계 표기가 운영과 일치.
- [ ] 비용 상한 도달/수집 실패/429/DB 연결 실패에 운영 경보가 작동.

## 13. 추천 측정 대시보드

| 북극성 KPI | 산식 |
|---|---|
| 유효 여행 결정 | 방문 가능 시간대 확인 후 길찾기/코스 저장/공유를 완료한 고유 세션 |
| 검색 유입 | 유입 검색엔진별 세션, 랜딩별 색인·노출·클릭·CTR·평균순위 |
| 검색 질 | 랜딩 방문→추천시간 조회→실제 길찾기/저장 전환율 |
| 데이터 품질 | 공식 실측 신선도 SLA, SAMPLE 노출수, 모형 오차, 사용자 오류 제보 |
| 재방문 | D7/D30 활성 사용자 재방문율, 알림 후 재방문 |
| 제품 가치 | 코스 생성 시작/완료, 공유, 실제 사용시간 만족도 |
| 수익 | 유료 전환, 활성구독, 이탈, 환불, 제휴 유효 클릭 |
| 효율 | 1,000 유효 세션당 API/클라우드/캐시 비용, 캐시 적중률 |

## 14. 개발자에게 전달할 작업 명세 (최초 PR 패키지)

**PR A `fix/data-integrity-and-open-hours`**
1. 현재 데이터 소스별 정규화·부정확 용어 검색.
2. `quality/sourceGeography/observedAt` 필드 계약 추가.
3. 공식 서울 혼잡 단계와 자체 단계 분리/통일.
4. SAMPLE 배지와 실측 표기 금지.
5. 추천/코스의 openingHours, lastAdmission, closedDays 검증 추가.
6. 단위/통합 테스트: 경복궁·에버랜드·부산 불꽃축제·인제 축제 등 실제 사례 기반.

**PR B `feat/seo-server-rendered-landings`**
1. `/guide` `/explore` 봇이 읽는 SSR 핵심 링크와 유효 건수 생성.
2. 각 상세 동적 메타/canonical/OG/robots.
3. `sitemap.ts`, `robots.ts` 확인 및 누락 시 작성.
4. 모든 장소 카드의 앵커 링크와 breadcrumb.
5. JSON-LD(Organization/WebSite/BreadcrumbList/축제 Event) 적용, 동일한 실제 페이지 데이터에서만 생성.
6. `curl`/headless/static HTML 기반 스모크 테스트.

**PR C `chore/observability-and-crawl-check`**
1. 공개 API 별 오류율/호출량/429·latency 메트릭.
2. 데이터 신선도 경고, 장애 시 stale/unknown 상태 설계.
3. Search Console/Naver/Bing 계정 인증 후 색인 추이 기록.
4. Lighthouse CI 기본 예산과 Playwright 핵심 E2E 5~10개.

각 PR은 범위를 작게, CI/테스트 통과 후 머지. 새 코드 구조는 기존 저장소 확인 후 적용해야 하며 파일 경로를 추정으로 단정하지 않음.

## 15. 레퍼런스

- Google Search Central — AI features and your website: https://developers.google.com/search/docs/appearance/ai-features
- Google Search Central — SEO 기본 가이드: https://developers.google.com/search/docs/fundamentals/seo-starter-guide?hl=ko
- Google Search Central — 구조화 데이터 일반 가이드: https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- Google Search Central — Event: https://developers.google.com/search/docs/appearance/structured-data/event
- Google Search Central — 다국어 사이트: https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites?hl=ko
- Google Search Central — canonical: https://developers.google.com/search/docs/crawling-indexing/canonicalization?hl=ko
- Google Search Central — Core Web Vitals: https://developers.google.com/search/docs/appearance/core-web-vitals?hl=ko
- 네이버 서치어드바이저 — robots.txt: https://searchadvisor.naver.com/guide/seo-basic-robots
- Next.js — generateMetadata: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- Next.js — sitemap: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
- OpenAI — Web Crawlers: https://developers.openai.com/api/docs/bots
- 검토 대상 공개페이지: https://crowdview.app/ / https://crowdview.app/seoul / https://crowdview.app/seoul/POI008 / https://crowdview.app/place/gyeongbokgung / https://crowdview.app/guide / https://crowdview.app/explore / https://crowdview.app/events / https://crowdview.app/festival/kto-2618014 / https://crowdview.app/place/busan-fireworks / https://crowdview.app/pricing / https://crowdview.app/privacy

**마지막 제안**: SEO·GEO는 홍보용 태그 추가 프로젝트가 아니라 사이트의 데이터를 사용자와 검색로봇이 신뢰하고 이해할 수 있게 만드는 품질 프로젝트로 묶어서 실행. 최우선 성공 조건은 ‘지금 쾌적하다’라는 한 문장을 관측/예측/출처/시각/장소 범위 측면에서 설명 가능하게 만드는 것.
