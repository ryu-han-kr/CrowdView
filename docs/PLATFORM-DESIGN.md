# CrowdView 플랫폼 확장 설계 (초안, 2026-10-16)

> 목표: "지금 어디가 붐비나"를 알려주는 혼잡도 서비스에서 **"언제·어디로·어떤 순서로 가면 덜 붐비고 좋은가"**까지 답하는 여행·나들이 플랫폼으로 넓힌다.
> 원칙: 혼잡도와 기본 예측은 계속 무료로 두고, **시간을 아껴 주는 기능**을 Plus(유료)로 판다. 특정 클라우드에 묶이지 않는 구조(Postgres + Redis + 표준 HTTP)를 유지한다.

---

## 1. 단계별 로드맵

| 단계 | 기능 | 유료 여부 | 선행 조건 |
|---|---|---|---|
| **1. 지금 (완료·PR 중)** | 실시간 혼잡도, 서울 119곳, 축제, 공항, 연관 관광지, 혼잡 알림 | 알림·광고 제거만 Plus | 로그인·결제 키 |
| **2. 명소 디렉터리** | 지역별 명소 목록·검색(관광지·문화시설·레포츠), 명소별 혼잡 예측 | 무료 | 관광지 데이터 적재 (3장) |
| **3. 맛집·카페 검색** | 명소 주변 음식점·카페, "지금 덜 붐비는 맛집" 정렬 | 검색 무료 / 웨이팅 예측 Plus | 음식점 데이터 + 상권 혼잡 지표 |
| **4. 추천 루트 (핵심 유료)** | 지역·날짜·취향을 넣으면 시간대별 혼잡을 피하는 반나절·하루 코스 생성 | **Plus** | 2·3단계 데이터, 이동시간 API |
| **5. 개인화·커뮤니티** | 찜·방문 기록 기반 추천, 코스 공유, 후기 | 일부 Plus | 회원 데이터 축적 |

## 2. 유료(Plus) 범위 제안

- **추천 루트 생성**: 무료는 하루 1회 미리보기(첫 2곳만 공개), Plus는 무제한 + 시간표 전체 + 붐비면 대체 경로 다시 짜기
- **코스 진행 중 실시간 알림**: 다음 장소가 갑자기 붐비면 순서를 바꾸자고 알림 (지금의 혼잡 알림을 확장)
- **맛집 웨이팅 예측**: 상권 혼잡도 + 식사 시간대 패턴으로 "지금 가면 대기 짧을 가능성" 표시
- 가격: 지금 월 3,900원에 묶어서 가치를 올리는 방식을 추천 (가격을 나누면 결제 심사·환불 규칙이 복잡해짐). 나중에 **여행자용 단기권**(예: 7일 2,900원, 외국인 대상)을 추가 검토

## 3. 데이터 소스

| 데이터 | 출처 | 용도 | 비고 |
|---|---|---|---|
| 관광지·문화시설·레포츠·쇼핑 | 한국관광공사 TourAPI `areaBasedList2` (콘텐츠 유형 12·14·28·38) | 명소 디렉터리 | 이미 키 있음, 다국어 서비스(영·일·중) 별도 제공 |
| 음식점 | TourAPI 콘텐츠 유형 39 | 맛집 기본 목록 | 무료, 저장 가능 |
| 음식점 보강 | 카카오 로컬 API / 네이버 지역 검색 | 영업 여부·카테고리·좌표 보강 | **약관상 장기 저장 제한** → 검색 시점 호출 + 짧은 캐시만 |
| 연관 관광지 | 관광공사 연관 관광지 (TMAP 이동) | 코스 후보 묶기 ("같이 가는 곳") | 이번에 연동함 |
| 지역 관광 수요·집중률 | 관광공사 데이터랩·집중률 예측 | 날짜별 혼잡 예측 | 연동함 |
| 실시간 인구 | 서울시 도시데이터, SKT 장소 혼잡도 | 코스 중 현재 혼잡 | 연동함 (SKT는 키 필요) |
| 이동 시간 | TMAP 경로(자동차·도보) / ODsay 대중교통 | 장소 사이 이동시간 행렬 | 유료 구간 있음 → 행렬을 Redis에 캐시 |

## 4. 데이터 모델 (Postgres, PostGIS 권장)

```sql
-- 명소·음식점·카페를 하나의 장소 테이블로 (출처별 ID는 따로)
create table poi (
  id text primary key,                 -- 'kto-12345', 'seoul-POI001' ...
  kind text not null,                  -- attraction | food | cafe | culture | leisure | shopping
  name text not null,
  name_i18n jsonb,                     -- {"en": "...", "ja": "..."} (관광공사 다국어 / Papago)
  region_code text not null,           -- 시군구 코드 (데이터랩·집중률과 연결)
  geom geography(point) not null,      -- 거리 검색 (PostGIS)
  categories text[] not null default '{}',
  hours jsonb,                         -- 요일별 운영시간
  stay_minutes int,                    -- 평균 체류시간 (코스 계산용, 유형별 기본값)
  source text not null, source_id text not null,
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);
create index on poi using gist (geom);

-- 시간대별 혼잡 예측 (매일 밤 다음 7일치를 계산해 저장)
create table poi_crowd_forecast (
  poi_id text references poi(id) on delete cascade,
  at timestamptz not null,             -- 정시 단위
  score smallint not null,             -- 0~100 (지금 화면과 같은 눈금)
  basis text not null,                 -- seoul | skt | datalab | model
  primary key (poi_id, at)
);

-- 생성한 코스 (회원별 저장·공유)
create table route (
  id text primary key,
  user_id text references "user"(id) on delete cascade,
  region_code text not null,
  date date not null,
  prefs jsonb not null,                -- {start, end, kinds, pace, transport, budget}
  score numeric,                       -- 예상 혼잡 합계 (낮을수록 좋음)
  share_slug text unique,              -- 공유 링크
  created_at timestamptz not null default now()
);
create table route_stop (
  route_id text references route(id) on delete cascade,
  seq smallint not null,
  poi_id text references poi(id),
  arrive_at timestamptz not null,
  leave_at timestamptz not null,
  expected_score smallint not null,
  primary key (route_id, seq)
);
```

## 5. 추천 루트 알고리즘

1. **후보 고르기**: 지역 + 취향(kind·카테고리) + 운영시간 + 연관 관광지 점수로 후보 15~25곳
2. **비용 행렬**: 후보 사이 이동시간(TMAP/ODsay, 캐시), 각 장소의 시간대별 예측 혼잡(`poi_crowd_forecast`)
3. **최적화**: "시간창이 있는 순회 문제"(TSP with time windows)를 작게 푼다
   - 목적 함수 = Σ(도착 시각의 혼잡 점수 × 가중치) + 이동시간 × 가중치 − 취향 점수
   - 후보가 20곳 안팎이라 **욕심쟁이(greedy) + 2-opt 개선**으로 수십 ms 안에 충분
   - 식사 시간(11:30~13:30, 17:30~19:30)에는 음식점을 끼워 넣는 제약
4. **설명 붙이기**: "경복궁은 10시 전이 한산해서 첫 번째로" 같은 이유를 단계별로 보여줌 (신뢰도·전환율에 중요)
5. **재계획**: 코스 진행 중 다음 장소의 실시간 혼잡이 예측보다 20점 이상 높으면 남은 순서를 다시 계산 → 알림

LLM은 **설명 문장 다듬기·다국어 요약**에만 선택적으로 쓰고, 순서 결정은 위의 계산으로 한다 (비용·재현성·검증 가능성).

## 6. 시스템 구조 (이식 가능하게)

```
[브라우저/앱] ──HTTP──> [Next.js (Vercel → 나중에 컨테이너)]
                           │  읽기: Redis 캐시(혼잡·행렬) → Postgres
                           │  쓰기: 회원·코스·결제
                           ▼
                [작업자(cron/queue)]  매일 밤: POI 동기화, 7일 예측 계산
                                      10분마다: 실시간 혼잡 수집, 알림
```

- 지금 구조 그대로 확장: Postgres(회원·결제에 이미 도입) + Redis(캐시) + cron
- 무거운 작업(7일 예측, 이동시간 행렬)은 **별도 작업자**로 분리할 수 있게 함수 단위로 작성 → Vercel Cron에서 시작하고, 나중에 직접 운영 클라우드의 큐/워커로 옮김
- 외부 API는 모두 `lib/*` 한 파일씩 감싸서(지금처럼) 교체 가능하게

## 7. API (안)

| 메서드·경로 | 설명 | 권한 |
|---|---|---|
| `GET /api/poi?region=&kind=&near=lat,lng&sort=calm` | 명소·맛집 검색 | 무료 |
| `GET /api/poi/{id}/forecast?date=` | 시간대별 혼잡 예측 | 무료(오늘·내일) / Plus(7일) |
| `POST /api/routes` | 코스 생성 `{region, date, start, end, kinds, transport}` | 미리보기 무료 / 전체 Plus |
| `GET /api/routes/{id}` · `POST /api/routes/{id}/replan` | 코스 보기·다시 짜기 | Plus |
| `GET /r/{share_slug}` | 공유 코스 페이지 (SEO 대상) | 공개 |

## 8. 일정 제안 (1인 개발 기준)

| 주차 | 작업 |
|---|---|
| 1~2주 | POI 테이블·TourAPI 동기화(관광지·음식점, 다국어), 지역별 명소 목록·검색 화면 |
| 3주 | 7일 혼잡 예측 배치(`poi_crowd_forecast`), 명소 상세에 예측 |
| 4~5주 | 이동시간 행렬 + 코스 생성 알고리즘, 코스 화면(시간표·지도) |
| 6주 | Plus 연동(미리보기/전체), 공유 링크, 재계획 알림 |
| 7주~ | 맛집 웨이팅 예측, 개인화 추천 |

## 9. 위험과 대응

- **외부 API 약관**: 카카오·네이버 검색 결과는 장기 저장 금지 → TourAPI(저장 가능)를 기본으로, 보강 데이터는 짧은 캐시만
- **예측 정확도**: 실측(서울·SKT)이 있는 곳부터 코스에 우선 쓰고, 추정 구간은 화면에 "추정"으로 표시 (지금의 DataTag 원칙 유지)
- **API 비용**: 이동시간 행렬이 가장 비쌈 → 지역별 상위 POI 쌍만 미리 계산·캐시, 하루 한도 보호(`api-quota.ts`)에 등록
- **결제 심사**: 유료 기능을 늘릴 때 요금 페이지·약관·환불정책을 같이 갱신 (`src/lib/legal.ts`)
