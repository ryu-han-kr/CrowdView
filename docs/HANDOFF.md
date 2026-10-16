# CrowdView 이어서 작업하기 (새 채팅 시작 프롬프트)

아래를 새 채팅 첫 메시지로 그대로 붙여넣으면 됩니다.

---

CrowdView(Next.js 16, 저장소 ryu-han-kr/CrowdView, 운영 https://crowdview.app)를 이어서 작업한다. 한국어로 답하고, 처음 하는 사람에게 설명하듯 쉽게 써 줘. 나는 SA(솔루션 아키텍트)가 목표라 지금은 Vercel로 운영하지만 나중에 직접 클라우드로 옮길 예정이니, 특정 플랫폼에 묶이지 않는 구조를 선호한다. 비밀 키는 채팅에 붙여넣지 않고 .env.local에 넣는다.

## 지금 상태 (2026-10-16 저녁)
- 운영: crowdview.app (Cloudflare DNS, Vercel Pro, icn1, Spend Management $50). 10분 수집 = Vercel Cron (QStash 삭제)
- main = PR #31. **PR #32~#43이 줄줄이 쌓여 있음** (각 PR의 base가 바로 앞 PR). #32부터 순서대로 머지하면 다음 PR의 base가 main으로 자동 변경
  - #32 신설 행정구역 축제 예측 / #33 축제 종류 분류 / #34 웹 배너·탭·누름 반응(UX) / #35 공공데이터 5종(입국장·주차면·통보문·고농도PM·연관관광지)
  - #36 서울 실시간 119곳 (/seoul) / #37 SKT 장소 혼잡도(키 필요) / #38 요금·약관·개인정보·환불·푸터 / #39 SEO + 해외 IP 자동 언어
  - #40 애드센스 / #41 카카오·구글 로그인 + Postgres / #42 Plus 정기결제(포트원) + 혼잡 알림(웹 푸시) / #43 설계 문서
- 수집: Vercel Cron 10분 → 실시간 API → Redis crowd:*. 서울 119곳은 볼 때만 (키 하나 seoul:live:all, 10분)
- 외부 API 캐시 lib/cached.ts, 호출 한도 lib/api-quota.ts (Papago는 글자 수, 하루 3만 자)
- 다국어 /en /ja /zh-CN /zh-TW, 처음 온 해외 이용자는 국가별 언어로 이동(로봇 제외, src/proxy.ts)
- 결제·로그인·알림·광고·SKT는 **환경변수가 없으면 꺼져 있고** 나머지는 그대로 동작 (.env.example에 목록)
- 확장 설계: docs/PLATFORM-DESIGN.md (명소 디렉터리 → 맛집 → 추천 루트(Plus))

## 남은 일 (우선순위)
1. 내가 할 일: PR #32~#43 확인·머지 / 10월 23일쯤 Upstash 사용량 확인
2. 키 발급 후 환경변수: DATABASE_URL(+ npm run db:migrate), BETTER_AUTH_SECRET/URL, KAKAO_*, GOOGLE_*, PORTONE_*(토스 채널), PORTONE_WEBHOOK_SECRET, VAPID 키, NEXT_PUBLIC_ADSENSE_*, 검색엔진 소유 확인, SK_OPENAPI_APP_KEY
3. 키를 넣은 뒤 실제 확인: 카카오·구글 로그인, 포트원 테스트 결제, SKT 응답 형식(lib/skt.ts)
4. 사업자 정보 → src/lib/business.ts "등록 예정" 값 교체, 약관 시행일, 법률 검토
5. 공공데이터 운영계정 전환(활용사례 작성 중), 서울시 활용사례 등록, Google Play 승인 대기
6. Search Console·네이버 서치어드바이저 등록 + sitemap 제출, 애드센스 신청

## 작업 규칙
- 브랜치 → PR → 확인 후 머지. 커밋 끝에 "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>", PR 본문 끝에 "🤖 Generated with [Claude Code](https://claude.com/claude-code)"
- Vercel CLI는 한글 호스트명 문제로 NODE_OPTIONS shim 필요 (메모리 vercel-cli-korean-hostname 참고)
- 새 공공데이터 API는 lib/api-quota.ts APIS에 한 줄 추가 + dataGoKr(경로, 파라미터, 캐시초)로 호출, 하루 최대 호출이 한도의 30% 이하가 되게 캐시 주기 설정
- 화면 문구를 추가하면 t("한국어")로 감싸고 scripts/i18n/ui.mjs에 4개 언어 번역 추가 후 build.mjs 실행
- 참고 문서: docs/SETUP.md(운영 설정), docs/api-costs.pdf(API·요금·한도), docs/requests-log.pdf(지금까지 요청 목록)

---
