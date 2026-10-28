-- 유료 단계 두 가지 (경수님 10/28): plus(월 3,900원) · pro(월 6,900원). 단계마다 SK 실측 횟수 등이 다르다
alter table plus_subscription add column if not exists plan text not null default 'plus';
alter table plus_subscription drop constraint if exists plus_subscription_plan_check;
alter table plus_subscription add constraint plus_subscription_plan_check check (plan in ('plus', 'pro'));
-- 결제 기록에도 어느 단계였는지 (환불·정산 확인용)
alter table payment add column if not exists plan text;
