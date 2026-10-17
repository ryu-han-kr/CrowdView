-- ☆ 담은 곳 (서울 실시간 지역 seoul-<코드> · 여행 가이드 vs-<id>). 로그인하면 기기 사이에 동기화
create table if not exists pick (
  user_id text not null references "user" ("id") on delete cascade,
  pick_id text not null,
  -- 담을 때 화면에 보이던 이름 (그 언어). 주소는 서버가 pick_id로 만든다
  label text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, pick_id)
);
