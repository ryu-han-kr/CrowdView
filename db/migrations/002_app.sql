-- CrowdView 앱 테이블: Plus 구독, 결제 기록, 찜, 웹 푸시 구독, 혼잡 알림

-- Plus 구독 (회원당 하나). 정기결제는 포트원 빌링키 + 다음 결제 예약으로 돌린다
create table if not exists plus_subscription (
  user_id text primary key references "user" ("id") on delete cascade,
  -- active: 이용 중 / canceled: 해지(기간 끝까지 이용) / past_due: 결제 실패 / expired: 끝남
  status text not null check (status in ('active', 'canceled', 'past_due', 'expired')),
  billing_key text,
  current_period_end timestamptz not null,
  -- 포트원에 예약해 둔 다음 결제 ID (해지하면 예약 취소)
  next_payment_id text,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 결제 기록. 전자상거래법상 5년 보관 → 회원이 탈퇴해도 기록은 남기고 user_id만 비운다
create table if not exists payment (
  id text primary key,
  user_id text references "user" ("id") on delete set null,
  amount integer not null,
  -- paid / failed / cancelled / partial_cancelled / scheduled
  status text not null,
  paid_at timestamptz,
  cancelled_amount integer not null default 0,
  period_start timestamptz,
  period_end timestamptz,
  -- 유료 기능을 처음 쓴 시각 (7일 이내 미사용 전액 환불 판단)
  first_used_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index if not exists payment_user_idx on payment (user_id, created_at desc);

-- 찜 (로그인하면 기기 사이에 동기화)
create table if not exists favorite (
  user_id text not null references "user" ("id") on delete cascade,
  place_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

-- 웹 푸시 구독 (브라우저마다 하나)
create table if not exists push_subscription (
  endpoint text primary key,
  user_id text not null references "user" ("id") on delete cascade,
  p256dh text not null,
  auth text not null,
  lang text not null default 'ko',
  created_at timestamptz not null default now()
);
create index if not exists push_subscription_user_idx on push_subscription (user_id);

-- 혼잡 알림 설정. calm: 한산해지면 / busy: 붐비기 시작하면
create table if not exists crowd_alert (
  user_id text not null references "user" ("id") on delete cascade,
  place_id text not null,
  kind text not null check (kind in ('calm', 'busy')),
  last_sent_at timestamptz,
  -- 마지막으로 본 단계 (같은 단계에서 반복 발송하지 않게)
  last_score integer,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id, kind)
);
create index if not exists crowd_alert_place_idx on crowd_alert (place_id);
