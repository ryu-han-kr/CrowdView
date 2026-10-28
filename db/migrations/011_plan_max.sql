-- Max 단계 추가 (경수님 10/28 저녁: 등급 세 개 — plus 3,900 · pro 6,900 · max 9,900원). lib/plus planColumns 가 운영에서도 같은 일을 한다
alter table plus_subscription drop constraint if exists plus_subscription_plan_check;
alter table plus_subscription add constraint plus_subscription_plan_check check (plan in ('plus', 'pro', 'max'));
