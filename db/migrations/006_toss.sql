-- 결제를 토스페이먼츠 직접 연동으로 바꾼다 (포트원 결제 예약 대신 우리가 다음 결제일을 들고 수집기가 결제)
-- customer_key: 토스 빌링키가 묶인 고객 키 / next_charge_at: 다음 자동결제 시각 (해지·만료면 null)
alter table plus_subscription add column if not exists customer_key text;
alter table plus_subscription add column if not exists next_charge_at timestamptz;
create index if not exists plus_subscription_charge_idx on plus_subscription (next_charge_at) where next_charge_at is not null;
-- 토스 결제 키 (취소·환불에 필요)
alter table payment add column if not exists payment_key text;
