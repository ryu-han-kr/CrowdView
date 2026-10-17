# CrowdView 운영 설정 체크리스트

> 왜 이렇게 하는지에 대한 자세한 설명은 [setup-guide.pdf](./setup-guide.pdf)(원본 [setup-guide.html](./setup-guide.html))에 있습니다.

**방침**
- 초기에는 Vercel로 빠르게 운영합니다.
- Cloudflare는 도메인 구입과 DNS만 맡습니다. 프록시는 끕니다(회색 구름).
- 이후 SA 학습과 비용 최적화를 위해 AWS, GCP, NCP 같은 클라우드로 직접 옮길 예정입니다.
  - 그래서 코드는 표준 HTTP 캐시 헤더처럼 이식 가능한 방식을 우선합니다.
  - Vercel에만 있는 기능은 아래 "이전 시 대체할 것"에 기록합니다.

**표기**
- **(직접)**: 사용자가 할 일
- **(Claude)**: 코드로 처리할 일

---

## 0단계: 지금 (무료)

- [ ] (직접) 서울시 일반 인증키를 발급받습니다.
  - https://data.seoul.go.kr → 인증키 신청 → 일반 인증키
  - 발급받은 키를 `.env.local`에 `SEOUL_OPENAPI_KEY=키값` 형식으로 넣습니다. 따옴표나 백틱은 붙이지 않습니다.
- [ ] (직접) data.go.kr에서 "한국관광공사_관광지 집중률 방문자 추이 예측 정보" 활용을 신청합니다.
- [ ] (직접) 매일 09:00 PDF 리포트가 디스코드와 메일로 오는지 확인합니다.
- [ ] (직접) 중복 Vercel 프로젝트 `crowd-view`를 삭제할지 결정합니다.
- [ ] (Claude) 서울시 키를 Vercel에 등록하고, 장소명을 검증한 뒤 운영에 반영합니다.
- [x] (Claude) CDN 캐시를 설정했습니다.
  - 페이지: ISR 60초 (이벤트 페이지는 1시간)
  - `/api/crowd*`: `s-maxage=60, stale-while-revalidate=300`
- [ ] (Claude) 함수 리전을 iad1(미국)에서 icn1(서울)로 바꿉니다.

## 1단계: 도메인 구입 (Cloudflare Registrar)

- [ ] (직접) https://dash.cloudflare.com 에 가입합니다.
- [ ] (직접) Domain Registration → Register Domains에서 도메인을 검색하고 결제합니다.
  - `.com`, `.app` 등은 Cloudflare에서 원가로 살 수 있습니다.
  - **`.kr`과 `.co.kr`은 Cloudflare에서 팔지 않습니다.** 국내 등록업체(가비아 등)에서 산 뒤 네임서버만 Cloudflare로 바꿉니다.
- [ ] (직접) 구입한 도메인 이름을 Claude에게 알려줍니다.

## 2단계: 도메인을 Vercel에 연결

- [ ] (직접) Vercel → `crowdview` → Settings → Domains → Add에서 `도메인`과 `www.도메인`을 추가합니다.
- [ ] (직접) Vercel이 보여주는 A 레코드와 CNAME 레코드를 Cloudflare → DNS → Records에 그대로 입력합니다.
  - **Proxy status는 반드시 "DNS only"(회색 구름)로 둡니다.**
- [ ] (직접) Vercel Domains 화면에 "Valid Configuration ✓"가 뜰 때까지 기다립니다. HTTPS 인증서는 자동으로 발급됩니다.
- [ ] (직접) Cloudflare의 SSL, 캐시, 방화벽 설정은 건드리지 않습니다.

## 3단계: 도메인 연결 후

- [ ] (직접) NCP 콘솔 → Maps → Application → Web 서비스 URL에 `https://도메인`과 `https://www.도메인`을 추가합니다.
- [ ] (직접) Resend → Domains → Add Domain을 진행합니다.
  - 안내되는 TXT/MX 레코드를 Cloudflare DNS에 추가합니다. 이 레코드도 DNS only로 둡니다.
- [ ] (Claude) 리포트 발신 주소를 `report@도메인`으로 바꾸고, 리포트에 도메인 비용을 반영합니다.

## 4단계: 기능 개발 중 (필요할 때)

- [ ] (직접) Vercel → Storage → Create Database → Supabase를 만듭니다.
  - Free 플랜, Seoul 리전
  - Production, Preview, Development 환경을 모두 연결합니다.
- [ ] (직접) 같은 화면에서 Upstash for Redis를 만듭니다. Free 플랜, Seoul 또는 가장 가까운 아시아 리전으로 선택합니다.
- [ ] (Claude) 환경변수 이름을 맞추고, 연결 코드를 작성하고, 리포트에 비용 항목을 추가합니다.

## 5단계: 출시 직전 (결제 켜는 날)

- [ ] (직접) 사업자등록을 합니다. 개인사업자로 충분합니다.
- [ ] (직접) 정부24에서 통신판매업 신고를 합니다.
- [ ] (같이) 이용약관과 개인정보처리방침을 만듭니다. 위치 기능을 쓰게 되면 위치기반서비스 신고도 해야 합니다.
- [ ] (직접) Vercel → Settings → Billing에서 Pro로 업그레이드합니다 ($20/월).
- [ ] (직접) Spend Management를 설정합니다.
  - 한도는 $50로 잡았습니다 (2026-10-16).
  - 50%, 75%, 100% 도달 시 알림을 받습니다.
  - 일시정지는 넉넉한 금액에서 걸리도록 합니다.
- [ ] (Claude) 지출 알림을 디스코드로 보내고, `/api/*` 레이트리밋을 걸고, 크론을 10분 주기로 되돌립니다.
- [ ] (직접) 외부 서비스마다 예산 상한을 설정합니다. 대상은 Upstash, 네이버 클라우드 예산 알림, Claude API입니다.
- [ ] (직접) 토스페이먼츠에 가입하고 계약합니다.
- [ ] (Claude) 결제를 연동하고, 리포트에 Vercel 사용량과 결제 수수료를 추가합니다.
- [ ] (직접) `npm run db:migrate` 로 `003_ops.sql`(자동결제 안내 기록)·`004_picks.sql`(담은 곳 동기화)까지 적용합니다.
- [ ] (직접) Vercel 환경변수 `ADMIN_EMAILS`에 운영자 로그인 이메일을 넣습니다. → `/admin` 에서 구독자 목록·최근 결제·수동 환불·해지
- [ ] (직접) Resend에서 crowdview.app 도메인을 인증하고 `MAIL_FROM`(예: `CrowdView <noreply@crowdview.app>`)을 넣습니다. 인증 전에는 회원에게 자동결제 7일 전 안내 메일이 가지 않고, 웹 푸시로만 안내합니다 (카카오 로그인 회원은 이메일을 받지 않아 웹 푸시로만).
- 운영 알림(디스코드, `DISCORD_WEBHOOK_URL`): 자동결제 실패, 구독 결제·해지 실패, 웹훅 서명 불일치·처리 실패, 혼잡 알림·만료 정리 실패, 실시간 수집 전체 실패, 운영자 환불·해지 기록. 같은 내용은 10분에 한 번만 옵니다.

---

## 역할 분담

| 서비스 | 역할 |
|---|---|
| Cloudflare | 도메인 구입, DNS 레코드 (프록시 끔) |
| Vercel | 호스팅, CDN 캐시, 방화벽/DDoS, Cron, 지출 한도 |
| Supabase / Upstash | DB·로그인 / 캐시 (Vercel Storage로 연결) |
| NCP / Resend / Discord | 지도 / 메일 발송 / 알림 |

## 직접 클라우드로 옮길 때 대체할 것

| 지금 (Vercel) | AWS | GCP | NCP |
|---|---|---|---|
| Edge CDN + ISR | CloudFront | Cloud CDN | Global Edge / CDN+ |
| Functions (Next.js) | Lambda + OpenNext(SST) 또는 ECS Fargate | Cloud Run | Server 또는 Cloud Functions |
| `vercel.json` crons | EventBridge Scheduler | Cloud Scheduler | Cloud Functions 트리거 |
| 환경변수 (Sensitive) | Secrets Manager / SSM Parameter Store | Secret Manager | Secret Manager |
| Firewall / DDoS | AWS WAF + Shield | Cloud Armor | Web Security Checker / ADS |
| Spend Management | AWS Budgets + Budget Actions | Budgets + Pub/Sub | 예산 관리 |
| Logs | CloudWatch Logs | Cloud Logging | Cloud Log Analytics |
| Upstash Redis | ElastiCache | Memorystore | Cloud DB for Redis |
| Supabase | RDS/Aurora + Cognito | Cloud SQL + Identity Platform | Cloud DB for PostgreSQL |

**이식 시 손볼 코드**

| 코드 | 이식 시 할 일 |
|---|---|
| `vercel.json`의 `crons` | 스케줄러에서 `Authorization: Bearer $CRON_SECRET` 헤더를 붙여 호출하도록 바꿉니다 |
| ISR (`revalidate`) | 자체 호스팅하면 Next 캐시 저장소를 S3나 Redis로 지정해야 합니다 (OpenNext가 처리) |
| `after()` | Next.js 기능이라 자체 호스팅에서도 동작하지만, Lambda에서는 응답 후 실행이 보장되지 않습니다. OpenNext 설정을 확인해야 합니다 |
| `src/lib/cdn.ts` | 표준 헤더라 수정 없이 동작합니다 |
