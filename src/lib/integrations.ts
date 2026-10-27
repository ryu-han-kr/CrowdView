// 외부 연동·권한 목록 (경수님 10/27: 관련 권한·상태를 한 화면에서 모두 확인). /admin/status 가 읽는다.
// - 환경변수는 '있는지'만 서버에서 본다 (값은 절대 화면에 내보내지 않는다)
// - 승인·가입처럼 코드로 알 수 없는 상태는 여기 manual 에 손으로 적는다 (바뀌면 이 파일을 고친다, 날짜와 함께)

export type Group = "data" | "ai" | "affiliate" | "ads" | "analytics" | "infra" | "auth" | "pay";
export type Manual = "ok" | "pending" | "todo" | "app-only";

export interface Integration {
  id: string;
  group: Group;
  name: string;
  /** 이 연동에 필요한 환경변수 (전부 있어야 '연결됨') */
  env: string[];
  /** 코드로 확인할 수 없는 상태: 승인 대기·미가입 등 */
  manual?: Manual;
  /** 어느 계정으로 가입했나 */
  account?: string;
  /** 비용·수수료·한도 */
  cost?: string;
  /** 지금 상태 설명 / 다음 할 일 */
  note?: string;
  /** 경수님이 하실 일 (있으면 '할 일'에 모인다) */
  todo?: string;
  /** 관리 화면 주소 */
  url?: string;
  /** 마지막으로 사람이 확인한 날 */
  checked?: string;
}

export const GROUP_LABEL: Record<Group, string> = {
  data: "공공·실시간 데이터",
  ai: "AI·검색",
  affiliate: "제휴(수수료)",
  ads: "광고",
  analytics: "분석·검색 노출",
  infra: "인프라",
  auth: "로그인",
  pay: "결제",
};

const G = "hks.han666@gmail.com";

export const INTEGRATIONS: Integration[] = [
  // ── 데이터
  { id: "datagokr", group: "data", name: "공공데이터포털 (공항·기상·관광공사 등 40건)", env: ["DATA_GO_KR_KEY"], cost: "무료, API별 일일 한도", url: "https://www.data.go.kr/iim/api/selectAcountList.do", note: "운영계정 33건 승인. 관광공사 4개·강원랜드는 운영 승인 대기(개발 한도)" },
  { id: "seoul", group: "data", name: "서울시 열린데이터 (실시간 인구 121곳)", env: ["SEOUL_OPENAPI_KEY"], cost: "무료", url: "https://data.seoul.go.kr/together/mypage/actkeyMng_ss.do" },
  { id: "seoul-subway", group: "data", name: "서울 지하철 실시간", env: ["SEOUL_SUBWAY_KEY"], cost: "무료" },
  { id: "its", group: "data", name: "ITS 국가교통정보 (도로 상황)", env: ["ITS_API_KEY"], cost: "무료" },
  { id: "ex", group: "data", name: "한국도로공사 (고속도로)", env: ["EX_API_KEY"], cost: "무료" },
  { id: "neis", group: "data", name: "나이스 학사일정 (방학·시험 기간)", env: ["NEIS_API_KEY"], cost: "무료" },
  { id: "parking-high1", group: "data", name: "강원랜드 광장주차장 (하이원 혼잡)", env: ["PARKING_HIGH1_URL", "PARKING_HIGH1_FIELDS"], manual: "todo", todo: "data.go.kr 마이페이지 → 활용신청 15168488 → 요청 주소·응답 필드 이름 전달", url: "https://www.data.go.kr/iim/api/selectAcountList.do" },
  { id: "sk", group: "data", name: "SK 오픈API (지오비전 혼잡도)", env: ["SK_OPENAPI_APP_KEY"], manual: "todo", todo: "openapi.sk.com → 앱 만들기 → App Key 전달", url: "https://openapi.sk.com" },
  { id: "google-places", group: "data", name: "구글 플레이스 API (New) — 매장 사진", env: ["GOOGLE_PLACES_API_KEY"], manual: "todo", account: G, cost: "사진(Place Details Photos) 월 1,000장 무료, 넘으면 1,000장당 $7. 결제 계정 10/27 생성, API 사용 설정됨, 키는 아직 없음", todo: "Cloud 콘솔 → Places API (New) 사용 → API 키 만들기 → 키 전달", url: "https://console.cloud.google.com/apis/library/places.googleapis.com" },
  { id: "naver-map", group: "data", name: "네이버 지도 (NCP Maps)", env: ["NEXT_PUBLIC_NAVER_MAP_CLIENT_ID", "NAVER_MAP_CLIENT_SECRET"], cost: "월 무료 한도", url: "https://console.ncloud.com/naver-service/application" },
  { id: "naver-search", group: "data", name: "네이버 검색·데이터랩 (요즘 뜨는 곳 검색량)", env: ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET", "NAVER_DATALAB_CLIENT_ID", "NAVER_DATALAB_CLIENT_SECRET"], cost: "무료, 일 1,000회" },
  { id: "ncp", group: "data", name: "NCP 검색어 트렌드", env: ["NCP_ACCESS_KEY", "NCP_SECRET_KEY"] },
  { id: "kakao", group: "data", name: "카카오 로컬 (주소·좌표)", env: ["KAKAO_REST_API_KEY"], cost: "무료 한도" },
  // ── AI·검색
  { id: "anthropic", group: "ai", name: "Claude API (매일 이벤트·'지금 중요' 탭)", env: ["ANTHROPIC_API_KEY"], manual: "todo", cost: "Haiku 기준 월 약 $0.1~1", todo: "console.anthropic.com → API Keys → 키 전달 (결제 수단·$5 충전)", url: "https://console.anthropic.com/settings/keys" },
  { id: "papago", group: "ai", name: "Papago 번역 (장소 이름)", env: ["PAPAGO_CLIENT_ID", "PAPAGO_CLIENT_PASSWORD"], cost: "월 한도 보호" },
  { id: "brave", group: "ai", name: "Brave Search (뉴스 화제)", env: ["BRAVE_SEARCH_API_KEY"], cost: "월 $5 무료 크레딧" },
  { id: "tavily", group: "ai", name: "Tavily (뉴스 검색 보조)", env: ["TAVILY_API_KEY"], cost: "월 1,000회 무료" },
  // ── 제휴
  { id: "myrealtrip", group: "affiliate", name: "마이리얼트립", env: ["NEXT_PUBLIC_AFF_MYREALTRIP"], account: G, cost: "투어·입장권 수수료", url: "https://partner.myrealtrip.com", checked: "10/26" },
  { id: "klook", group: "affiliate", name: "클룩", env: ["NEXT_PUBLIC_AFF_KLOOK"], account: G, note: "10/27 본인 인증 완료(경수님)", todo: "파트너 화면에서 프로필·정산 정보 입력 확인", url: "https://affiliate.klook.com", checked: "10/27" },
  { id: "getyourguide", group: "affiliate", name: "GetYourGuide", env: ["NEXT_PUBLIC_AFF_GETYOURGUIDE"], account: G, note: "계정 활성(대시보드 정상)", todo: "Account → Payment details 에 정산 정보 입력", url: "https://partner.getyourguide.com/en-us/account/payment", checked: "10/27" },
  { id: "trip", group: "affiliate", name: "Trip.com", env: ["NEXT_PUBLIC_AFF_TRIP"], account: G, cost: "최대 7%", note: "승인 완료, Allianceid·SID 반영", todo: "Account → Bank Details 에 정산 계좌 입력", url: "https://www.trip.com/partners/account/bank", checked: "10/27" },
  { id: "agoda", group: "affiliate", name: "아고다 (사이트 1978913)", env: ["NEXT_PUBLIC_AFF_AGODA"], manual: "pending", account: G, cost: "최대 5.6%", note: "수동 도메인 인증 심사 중(최대 1주). CID는 미리 반영", todo: "11/2까지 심사 메일 없으면 파트너 화면 Help로 문의", url: "https://partners.agoda.com/profile/addsites", checked: "10/27" },
  { id: "kkday", group: "affiliate", name: "KKday (링크프라이스 경유)", env: ["NEXT_PUBLIC_LINKPRICE_ID"], account: G, cost: "최대 2.1%", note: "링크프라이스 머천트 승인 완료(10/27). 직접 제휴(KKpartners) CID는 없어도 됨", url: "https://ac.linkprice.net/merchants/cps/kkday/info", checked: "10/27" },
  { id: "linkprice", group: "affiliate", name: "링크프라이스 (A100709266)", env: ["NEXT_PUBLIC_LINKPRICE_ID"], account: "링크프라이스 회원 crowdview", note: "승인: NOL(앱 실적만)·KKday·호텔스컴바인·제주패스 / 대기: 익스피디아·호텔스닷컴. 사업자등록증 관리자 승인 대기", url: "https://ac.linkprice.net/merchants/cps?category=8", checked: "10/27" },
  { id: "coupang", group: "affiliate", name: "쿠팡파트너스 (AF2411021)", env: [], manual: "pending", account: "쿠팡 계정(네이버 메일)", cost: "3%", note: "입장권 23곳 링크를 손으로 만들어 반영. Open API 키는 최종 승인(실적 필요) 뒤에만 발급", todo: "최종 승인 나면 파트너스 API에서 키 '생성' → 알려 주기", url: "https://partners.coupang.com/#affiliate/ws/tools/open-api", checked: "10/27" },
  { id: "booking", group: "affiliate", name: "Booking.com", env: ["NEXT_PUBLIC_AFF_BOOKING"], manual: "todo", note: "미가입 (일반 검색 링크로 동작)" },
  { id: "expedia", group: "affiliate", name: "익스피디아·호텔스닷컴", env: ["NEXT_PUBLIC_AFF_EXPEDIA"], manual: "pending", note: "링크프라이스에서 승인 대기 (10/27 신청)" },
  // ── 광고
  { id: "adsense", group: "ads", name: "구글 애드센스", env: ["NEXT_PUBLIC_ADSENSE_CLIENT"], account: G, note: "사이트 연결됨", url: "https://adsense.google.com" },
  { id: "adsense-slots", group: "ads", name: "애드센스 광고 단위 2개 (목록 사이·옆 레일)", env: ["NEXT_PUBLIC_ADSENSE_SLOT_INLINE", "NEXT_PUBLIC_ADSENSE_SLOT_RAIL"], manual: "todo", todo: "애드센스 → 광고 → 광고 단위 기준 → 디스플레이 2개 → data-ad-slot 숫자 전달", url: "https://adsense.google.com" },
  // ── 분석
  { id: "search-console", group: "analytics", name: "구글 서치콘솔", env: [], manual: "ok", note: "DNS 소유 확인. 색인 요청은 하루 3~5개", todo: "10/28~29 '페이지' 색인 수 확인", url: "https://search.google.com/search-console" },
  { id: "naver-webmaster", group: "analytics", name: "네이버 서치어드바이저", env: ["NEXT_PUBLIC_NAVER_SITE_VERIFICATION"], url: "https://searchadvisor.naver.com" },
  { id: "bing", group: "analytics", name: "Bing 웹마스터", env: ["NEXT_PUBLIC_BING_SITE_VERIFICATION"], manual: "todo" },
  { id: "clarity", group: "analytics", name: "Microsoft Clarity (화면 녹화·열지도)", env: ["NEXT_PUBLIC_CLARITY_ID"], manual: "todo", todo: "clarity.microsoft.com → 새 프로젝트 → Project ID 전달", url: "https://clarity.microsoft.com" },
  { id: "sentry", group: "analytics", name: "Sentry (오류 추적)", env: ["NEXT_PUBLIC_SENTRY_DSN"] },
  // ── 인프라
  { id: "db", group: "infra", name: "Neon Postgres (회원·결제·기록)", env: ["DATABASE_URL"] },
  { id: "redis", group: "infra", name: "Upstash Redis (캐시·집계)", env: ["KV_REST_API_URL", "KV_REST_API_TOKEN"] },
  { id: "r2", group: "infra", name: "Cloudflare R2 (자료 보관·사진)", env: ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] },
  { id: "qstash", group: "infra", name: "QStash (예약 작업)", env: ["QSTASH_TOKEN"] },
  { id: "cron", group: "infra", name: "크론 보호 키", env: ["CRON_SECRET"] },
  { id: "resend", group: "infra", name: "Resend (메일 발송)", env: ["RESEND_API_KEY"] },
  { id: "push", group: "infra", name: "웹 푸시 (VAPID)", env: ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"] },
  { id: "discord", group: "infra", name: "디스코드 알림", env: ["DISCORD_WEBHOOK_URL"] },
  // ── 로그인·결제
  { id: "auth", group: "auth", name: "로그인 (Better Auth)", env: ["BETTER_AUTH_SECRET", "BETTER_AUTH_URL"] },
  { id: "google-login", group: "auth", name: "구글 로그인", env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
  { id: "kakao-login", group: "auth", name: "카카오 로그인", env: ["KAKAO_CLIENT_ID", "KAKAO_CLIENT_SECRET"] },
  { id: "admin", group: "auth", name: "운영자 이메일", env: ["ADMIN_EMAILS"] },
  { id: "toss", group: "pay", name: "토스페이먼츠 (Plus 결제)", env: ["NEXT_PUBLIC_TOSS_CLIENT_KEY", "TOSS_SECRET_KEY"], note: "라이브 결제 열림(통신판매업 반영)" },
];

export type Status = "ok" | "partial" | "pending" | "todo" | "app-only";

/** 환경변수 존재(서버) + 손으로 적은 상태로 최종 상태를 정한다 */
export function statusOf(i: Integration): { status: Status; missing: string[] } {
  const missing = i.env.filter((k) => !process.env[k]?.trim());
  if (i.manual === "pending") return { status: "pending", missing };
  if (i.manual === "todo" && missing.length) return { status: "todo", missing };
  if (i.manual === "app-only") return { status: "app-only", missing };
  if (!i.env.length) return { status: i.manual === "todo" ? "todo" : "ok", missing };
  if (!missing.length) return { status: "ok", missing };
  return { status: missing.length < i.env.length ? "partial" : "todo", missing };
}
