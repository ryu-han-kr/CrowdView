-- 운영 보강: 자동결제 7일 전 안내를 어느 결제일에 대해 보냈는지 (같은 결제일에 두 번 보내지 않게)
alter table plus_subscription add column if not exists renewal_notice_for timestamptz;
