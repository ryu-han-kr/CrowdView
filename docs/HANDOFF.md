# CrowdView 이어서 작업하기 (새 채팅 시작 프롬프트)

아래를 새 채팅 첫 메시지로 그대로 붙여넣으면 됩니다.

---

CrowdView(Next.js 16, 저장소 ryu-han-kr/CrowdView, 운영 https://crowdview.app)를 이어서 작업한다. 한국어로 답하고, 처음 하는 사람에게 설명하듯 쉽게 써 줘. 나는 SA(솔루션 아키텍트)가 목표라 지금은 Vercel로 운영하지만 나중에 직접 클라우드로 옮길 예정이니, 특정 플랫폼에 묶이지 않는 구조를 선호한다. 비밀 키는 채팅에 붙여넣지 않고 .env.local에 넣는다.

## 지금 상태 (2026-10-16, main = PR #27 머지)
- 운영: crowdview.app (Cloudflare는 도메인·DNS만, Vercel Hobby, 리전 icn1). Pro 전환은 아직 안 함
- 수집 구조: Upstash QStash가 10분마다 /api/cron/refresh 호출 → 실시간 API(인천공항 T1·T2, 한국공항공사, 서울시 도시데이터) → Redis crowd:*. 사용자는 Redis만 읽음
- 외부 API 캐시: lib/cached.ts (메모리 → Redis → 원본, 장애·한도 시 마지막 데이터). 공공데이터는 lib/datagokr.ts
- 호출 한도 보호: lib/api-quota.ts (API별 하루 호출 수 quota:{날짜}:{API}, 개발계정 한도의 90%에서 자동 정지). 한도·사용률은 docs/api-costs.html/pdf
- 매일 09시 비용 리포트 PDF (디스코드·메일), 2쪽에 어제 API 호출 수/한도
- 다국어: /en /ja /zh-CN /zh-TW (한국어는 접두사 없음). UI 번역 원본 scripts/i18n/*.mjs → node scripts/i18n/build.mjs. 축제 이름·지역명은 Papago 자동 번역(lib/name-translate.ts, Redis 90일)
- 화면: 모바일(<768px)은 앱 UI 그대로 유지, md 이상은 웹 레이아웃. 탭: 공항·놀이공원·명소·축제, 공항 상세(출국장·시간대·기록·주차), 축제(관광공사+서울시, 서울 축제는 실시간 인구)

## 남은 일 (우선순위)
1. 내가 할 일: NCP Papago Application 사용 한도·알람 설정 / 1주 뒤 Upstash Usage 확인(월 50만 명령 넘으면 Pay-as-you-go)
2. 출시 전: Vercel Pro 전환 + Spend Management($100, 알림 50/75/100%) → Vercel Cron 10분으로 옮기고 QStash 해지
3. 출시 전: 공공데이터 운영계정 전환(API마다 활용사례 등록), 서울시 활용사례 등록
4. 사업자 정보 받으면: 푸터 사업자 정보, 이용약관·개인정보처리방침·환불정책·요금 페이지 → 포트원+토스페이먼츠 결제 연동(서비스 URL https://crowdview.app)
5. Google Play 개발자 승인 대기 → 앱 출시(모바일 UI 그대로)
6. 해양수산부 해수욕장 혼잡도 문의 발송(초안 있음), Resend 도메인 인증(선택), 에어코리아 경보 API(선택)
7. 2026 신설 행정구역(전남광주통합특별시, 인천 영종구·제물포구)이 데이터랩 코드와 안 맞아 "준비 중"으로 나옴

## 작업 규칙
- 브랜치 → PR → 확인 후 머지. 커밋 끝에 "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>", PR 본문 끝에 "🤖 Generated with [Claude Code](https://claude.com/claude-code)"
- Vercel CLI는 한글 호스트명 문제로 NODE_OPTIONS shim 필요 (메모리 vercel-cli-korean-hostname 참고)
- 새 공공데이터 API는 lib/api-quota.ts APIS에 한 줄 추가 + dataGoKr(경로, 파라미터, 캐시초)로 호출, 하루 최대 호출이 한도의 30% 이하가 되게 캐시 주기 설정
- 화면 문구를 추가하면 t("한국어")로 감싸고 scripts/i18n/ui.mjs에 4개 언어 번역 추가 후 build.mjs 실행
- 참고 문서: docs/SETUP.md(운영 설정), docs/api-costs.pdf(API·요금·한도), docs/requests-log.pdf(지금까지 요청 목록)

---
