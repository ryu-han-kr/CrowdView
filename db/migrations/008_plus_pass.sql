-- Plus 1개월 이용권(한 번 결제, 자동 갱신 없음)을 자동결제 구독과 함께 판다 → 상태 'pass' 추가
-- pass: 이용권으로 이용 중 (billing_key·next_charge_at 없음, 기간이 끝나면 expired)
alter table plus_subscription drop constraint if exists plus_subscription_status_check;
alter table plus_subscription add constraint plus_subscription_status_check
  check (status in ('active', 'canceled', 'past_due', 'expired', 'pass'));
