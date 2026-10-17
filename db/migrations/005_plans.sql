-- 내 여행 계획: 추천 코스에서 저장한 코스 (공유 id = Redis route:share:<id>, 30일 보관). 로그인하면 기기 사이에 동기화
create table if not exists saved_plan (
  user_id text not null references "user" ("id") on delete cascade,
  share_id text not null,
  start_name text not null,
  day date not null,
  stops jsonb not null default '[]',
  position integer not null default 0,
  saved_at timestamptz not null default now(),
  primary key (user_id, share_id)
);
