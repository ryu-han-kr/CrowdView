// CrowdView Plus 구독: 첫 결제 → 다음 달 같은 날 결제 예약 → 웹훅으로 연장 → 해지·환불·만료.
// 돈이 오가는 판단(결제 성공 여부, 금액)은 항상 포트원에서 다시 조회한 값으로만 한다.
import { PLUS } from "./business";
import { pool, sql } from "./db";
import {
  cancelPayment,
  cancelSchedules,
  deleteBillingKey,
  getPayment,
  payWithBillingKey,
  schedulePayment,
  type PortOnePayment,
} from "./portone";

export interface PlusState {
  status: "none" | "active" | "canceled" | "past_due" | "expired";
  /** 이용 가능 (해지·결제 실패라도 기간이 남았으면 true) */
  active: boolean;
  periodEnd?: string;
  /** 결제 후 7일 이내이고 유료 기능을 쓰지 않아 전액 환불 가능 */
  refundable: boolean;
}

interface SubRow {
  user_id: string;
  status: PlusState["status"];
  billing_key: string | null;
  current_period_end: Date;
  next_payment_id: string | null;
  next_schedule_id: string | null;
}

const ORDER_NAME = `${PLUS.name} 월 이용권`;
/** 결제 실패 후 다시 시도하는 간격과 횟수 */
const RETRY_HOURS = 24;
const MAX_RETRIES = 3;

/** 같은 날짜의 다음 달 (1/31 → 2/28) */
export function addMonth(d: Date): Date {
  const out = new Date(d);
  const day = out.getUTCDate();
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + PLUS.periodMonths);
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, last));
  return out;
}

const newPaymentId = (userId: string) => `plus_${userId.slice(0, 12)}_${Date.now().toString(36)}`;

async function sub(userId: string): Promise<SubRow | undefined> {
  return (await sql<SubRow>("select * from plus_subscription where user_id = $1", [userId]))[0];
}

export async function getPlus(userId: string): Promise<PlusState> {
  if (!pool) return { status: "none", active: false, refundable: false };
  const s = await sub(userId);
  if (!s) return { status: "none", active: false, refundable: false };
  const active = s.status !== "expired" && s.current_period_end > new Date();
  const [last] = await sql<{ paid_at: Date; first_used_at: Date | null }>(
    "select paid_at, first_used_at from payment where user_id = $1 and status = 'paid' order by paid_at desc limit 1",
    [userId],
  );
  const refundable = active && !!last && !last.first_used_at && Date.now() - last.paid_at.getTime() < 7 * 86_400_000;
  return { status: s.status, active, periodEnd: s.current_period_end.toISOString(), refundable };
}

export const isPlus = async (userId: string) => (await getPlus(userId)).active;

/** 결제 결과를 포트원에서 다시 확인 (금액까지) */
async function confirmPaid(paymentId: string): Promise<PortOnePayment> {
  const p = await getPayment(paymentId);
  if (p.status !== "PAID") throw new Error(`결제 상태 ${p.status}`);
  if (p.amount.total !== PLUS.priceKrw) throw new Error(`결제 금액 불일치 ${p.amount.total}`);
  return p;
}

async function scheduleNext(userId: string, billingKey: string, at: Date) {
  const paymentId = newPaymentId(userId);
  const scheduleId = await schedulePayment(paymentId, { billingKey, orderName: ORDER_NAME, amount: PLUS.priceKrw, customerId: userId }, at);
  await sql("update plus_subscription set next_payment_id = $2, next_schedule_id = $3, updated_at = now() where user_id = $1", [
    userId,
    paymentId,
    scheduleId ?? null,
  ]);
}

/** 처음 구독: 빌링키로 첫 달 결제 → 구독 시작 → 다음 달 예약 */
export async function subscribe(userId: string, billingKey: string): Promise<PlusState> {
  const cur = await getPlus(userId);
  if (cur.active && cur.status === "active") throw new Error("이미 Plus를 이용 중이에요");
  const paymentId = newPaymentId(userId);
  await payWithBillingKey(paymentId, { billingKey, orderName: ORDER_NAME, amount: PLUS.priceKrw, customerId: userId });
  const p = await confirmPaid(paymentId);
  const start = new Date(p.paidAt ?? Date.now());
  // 해지 후 기간이 남은 상태에서 다시 구독하면 남은 기간 뒤로 이어 붙인다
  const base = cur.active && cur.periodEnd ? new Date(cur.periodEnd) : start;
  const end = addMonth(base);
  await sql(
    `insert into payment (id, user_id, amount, status, paid_at, period_start, period_end, raw)
     values ($1, $2, $3, 'paid', $4, $5, $6, $7) on conflict (id) do nothing`,
    [paymentId, userId, p.amount.total, start, base, end, JSON.stringify(p)],
  );
  await sql(
    `insert into plus_subscription (user_id, status, billing_key, current_period_end)
     values ($1, 'active', $2, $3)
     on conflict (user_id) do update set status = 'active', billing_key = $2, current_period_end = $3, canceled_at = null, updated_at = now()`,
    [userId, billingKey, end],
  );
  await scheduleNext(userId, billingKey, end);
  return getPlus(userId);
}

/** 예약 결제 성공 (웹훅) → 한 달 연장, 다음 예약 */
export async function onScheduledPaid(paymentId: string): Promise<void> {
  const [s] = await sql<SubRow>("select * from plus_subscription where next_payment_id = $1", [paymentId]);
  if (!s || !s.billing_key) return;
  const done = await sql("select 1 from payment where id = $1 and status = 'paid'", [paymentId]);
  if (done.length) return; // 같은 웹훅이 다시 와도 한 번만
  const p = await confirmPaid(paymentId);
  const start = s.current_period_end > new Date() ? s.current_period_end : new Date();
  const end = addMonth(start);
  await sql(
    `insert into payment (id, user_id, amount, status, paid_at, period_start, period_end, raw)
     values ($1, $2, $3, 'paid', $4, $5, $6, $7)
     on conflict (id) do update set status = 'paid', paid_at = $4, period_start = $5, period_end = $6, raw = $7`,
    [paymentId, s.user_id, p.amount.total, new Date(p.paidAt ?? Date.now()), start, end, JSON.stringify(p)],
  );
  await sql("update plus_subscription set status = 'active', current_period_end = $2, updated_at = now() where user_id = $1", [s.user_id, end]);
  await scheduleNext(s.user_id, s.billing_key, end);
}

/** 예약 결제 실패 (웹훅) → 결제 실패 상태, 하루 뒤 다시 시도 (최대 3번) */
export async function onScheduledFailed(paymentId: string, reason?: string): Promise<void> {
  const [s] = await sql<SubRow>("select * from plus_subscription where next_payment_id = $1", [paymentId]);
  if (!s || !s.billing_key) return;
  await sql(
    `insert into payment (id, user_id, amount, status, raw) values ($1, $2, $3, 'failed', $4) on conflict (id) do update set status = 'failed'`,
    [paymentId, s.user_id, PLUS.priceKrw, JSON.stringify({ reason })],
  );
  const [{ n }] = await sql<{ n: number }>(
    "select count(*)::int as n from payment where user_id = $1 and status = 'failed' and created_at > $2",
    [s.user_id, new Date(s.current_period_end.getTime() - 86_400_000)],
  );
  await sql("update plus_subscription set status = 'past_due', updated_at = now() where user_id = $1", [s.user_id]);
  if (n < MAX_RETRIES) await scheduleNext(s.user_id, s.billing_key, new Date(Date.now() + RETRY_HOURS * 3600_000));
}

/** 해지: 다음 결제 예약을 취소하고, 이미 낸 기간이 끝날 때까지는 계속 이용 */
export async function cancel(userId: string): Promise<PlusState> {
  const s = await sub(userId);
  if (!s || s.status === "expired") return getPlus(userId);
  if (s.billing_key && s.next_schedule_id) await cancelSchedules(s.billing_key, [s.next_schedule_id]).catch(() => {});
  await sql(
    "update plus_subscription set status = 'canceled', canceled_at = now(), next_payment_id = null, next_schedule_id = null, updated_at = now() where user_id = $1",
    [userId],
  );
  return getPlus(userId);
}

/** 결제 후 7일 이내, 유료 기능을 쓰지 않았으면 전액 환불하고 바로 끝낸다 (환불정책 1번) */
export async function refundWithin7Days(userId: string): Promise<PlusState> {
  const state = await getPlus(userId);
  if (!state.refundable) throw new Error("환불 가능 기간이 지났거나 유료 기능을 이미 사용했어요. 고객센터로 문의해 주세요.");
  const [last] = await sql<{ id: string; amount: number }>(
    "select id, amount from payment where user_id = $1 and status = 'paid' order by paid_at desc limit 1",
    [userId],
  );
  await cancelPayment(last.id, "결제 후 7일 이내 미사용 전액 환불");
  await sql("update payment set status = 'cancelled', cancelled_amount = amount where id = $1", [last.id]);
  await cancel(userId);
  await expire(userId);
  return getPlus(userId);
}

/** 유료 기능을 처음 쓴 시각 기록 (혼잡 알림 등록 등) */
export async function markPlusUsed(userId: string): Promise<void> {
  await sql(
    `update payment set first_used_at = now()
     where id = (select id from payment where user_id = $1 and status = 'paid' order by paid_at desc limit 1) and first_used_at is null`,
    [userId],
  );
}

async function expire(userId: string) {
  const s = await sub(userId);
  if (s?.billing_key) await deleteBillingKey(s.billing_key).catch(() => {});
  await sql("update plus_subscription set status = 'expired', billing_key = null, updated_at = now() where user_id = $1", [userId]);
}

/** 기간이 끝난 해지·결제 실패 구독을 만료 처리 (매일 수집기에서 부른다) */
export async function expireEnded(): Promise<number> {
  if (!pool) return 0;
  const rows = await sql<{ user_id: string }>(
    "select user_id from plus_subscription where status in ('canceled', 'past_due') and current_period_end < now() - interval '3 days'",
  );
  for (const r of rows) await expire(r.user_id);
  return rows.length;
}
