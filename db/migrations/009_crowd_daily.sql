-- 지난 날짜 혼잡 기록 (사용자 10/26: 지난 데이터를 사이트에서도 보이게, 매일 저장·관리).
-- R2에 5분마다 쌓는 원본(lib/archive)을 하루 한 번 장소·서울 지역마다 한 줄로 줄여 둔다 (cron archive-daily).
-- 한 줄 약 0.3KB × 하루 약 170곳 ≈ 하루 50KB, 1년 약 20MB (Neon 무료 0.5GB 안)
create table if not exists crowd_daily (
  kind text not null,              -- 'place' | 'seoul'
  id text not null,                -- 장소 id 또는 서울 지역 코드(POI001)
  date date not null,              -- KST 날짜
  label text,
  samples int not null,            -- 그날 스냅샷 수 (5분마다 → 최대 288)
  avg_score real,                  -- 장소는 문 연 시간만의 평균
  max_score smallint,
  max_at text,                     -- 가장 붐빈 시각 KST HH:mm
  avg_people int,
  max_people int,
  hourly smallint[],               -- 0~23시 평균 점수 (자료 없는 시간은 -1)
  primary key (kind, id, date)
);
create index if not exists crowd_daily_date on crowd_daily (date);

-- 어느 날을 다 정리했는지 (원본 크기와 함께, 운영 도구의 보관 용량 표)
create table if not exists archive_day (
  date date primary key,
  snapshots int not null,
  bytes bigint not null,
  rows int not null,
  done_at timestamptz not null default now()
);
