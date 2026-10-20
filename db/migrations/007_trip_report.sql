-- 여행 날짜 저장 (Plus): 그 날 예측 단계가 바뀌면, 그리고 전날 아침에 웹 푸시 (레퍼런스: TouringPlans 'Crowd change notifications')
-- last_level: 마지막으로 알린(또는 저장할 때 본) 그날 예측 단계 1~5
create table if not exists trip_watch (
  user_id text not null references "user" ("id") on delete cascade,
  place_id text not null,
  date date not null,
  last_level integer,
  eve_sent boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id, date)
);
create index if not exists trip_watch_date_idx on trip_watch (date);

-- 현장 혼잡 제보 (레퍼런스: Queue-Times 'Submit queue time'): 로그인 없이도, IP는 해시만. 예측 정확도 점검에 쓴다
-- level: 1 쾌적 ~ 5 매우 혼잡 / wait_min: 놀이공원 등 줄 선 시간(선택)
create table if not exists crowd_report (
  id bigserial primary key,
  place_id text not null,
  level integer not null check (level between 1 and 5),
  wait_min integer check (wait_min between 0 and 300),
  user_id text references "user" ("id") on delete set null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists crowd_report_place_idx on crowd_report (place_id, created_at desc);
