// CrowdView Plus 구독: 카드 등록(토스 빌링키) → 첫 달 결제 → 다음 결제일(next_charge_at)에 수집기가 결제 → 해지·환불·만료.
// 1개월 이용권(status 'pass'): 토스 일반 결제창 → 서버 승인 → 한 달 이용, 자동 갱신 없음 (자동결제 계약 전에도 팔 수 있다)
// 돈이 오가는 판단(결제 성공 여부, 금액)은 항상 토스가 돌려준 값(또는 다시 조회한 값)으로만 한다.
import { pushToUser } from "./alerts";
import { PLUS, planOf, type PlanId } from "./business";
import { pool, sql } from "./db";
import { isDeliverable, mailEnabled, sendMail } from "./mail";
import { opsAlert } from "./ops";
import { kv } from "./cache";
import { cancelPayment, chargeBillingKey, confirmPayment, customerKeyOf, getPaymentByOrder, issueBillingKey, TossError, tossEnabled, type TossPayment } from "./toss";

export interface PlusState {
  status: "none" | "active" | "canceled" | "past_due" | "expired" | "pass";
  /** 이용 가능 (해지·결제 실패라도 기간이 남았으면 true) */
  active: boolean;
  periodEnd?: string;
  /** 결제 후 7일 이내이고 유료 기능을 쓰지 않아 전액 환불 가능 */
  refundable: boolean;
  /** 유료 단계 (plus·pro) */
  plan?: PlanId;
}

interface SubRow {
  user_id: string;
  status: PlusState["status"];
  billing_key: string | null;
  customer_key: string | null;
  current_period_end: Date;
  next_charge_at: Date | null;
  /** 지금 결제 중인 주문 번호 (결과를 모를 때 같은 번호로 다시 보내 두 번 결제되지 않게) */
  next_payment_id: string | null;
  plan: PlanId;
}

const orderName = (plan: PlanId) => `${planOf(plan).name} 월 이용권`;
const passOrderName = (plan: PlanId) => `${planOf(plan).name} 1개월 이용권`;
/** 이용권 결제창을 연 뒤 승인까지 기다리는 시간 (주문 번호의 주인을 이 동안 기억) */
const PASS_ORDER_TTL = 60 * 60;
/** 결제 실패 후 다시 시도하는 간격과 횟수 */
const RETRY_HOURS = 24;
const MAX_RETRIES = 3;
/** 수집기가 결제를 맡으면 이 시간 동안 다른 수집기가 같은 회원을 건드리지 않는다 */
const CLAIM_MINUTES = 30;

/**
 * 단계(plan) 열: db/migrations/010_plan_tier.sql 을 아직 운영 DB에 돌리지 않았어도 결제가 깨지지 않게,
 * 결제 기록을 쓰기 전에 처음 한 번 열을 만든다 (add column if not exists — 여러 번 불러도 같다)
 */
let schemaReady: Promise<void> | undefined;
function planColumns(): Promise<void> {
  if (!pool) return Promise.resolve();
  schemaReady ??= (async () => {
    await sql("alter table plus_subscription add column if not exists plan text not null default 'plus'");
    await sql("alter table payment add column if not exists plan text");
  })().catch((e) => {
    schemaReady = undefined;
    throw e;
  });
  return schemaReady;
}

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

/** 토스 주문 번호 규칙: 6~64자 영문·숫자·-_ */
const newPaymentId = (userId: string) => `plus_${userId.slice(0, 12).replace(/[^A-Za-z0-9_-]/g, "")}_${Date.now().toString(36)}`;

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
  return { status: s.status, active, periodEnd: s.current_period_end.toISOString(), refundable, plan: s.plan ?? "plus" };
}

export const isPlus = async (userId: string) => (await getPlus(userId)).active;

/** 지금 이용 중인 Plus 회원 수 (구독·이용권, 기간 안). SK 실측 하루 한도를 회원 수만큼 늘리는 데 쓴다 */
export async function activePlusCount(): Promise<number> {
  if (!pool) return 0;
  const [{ n }] = await sql<{ n: number }>("select count(*)::int as n from plus_subscription where status <> 'expired' and current_period_end > now()");
  return n;
}

/** 결제 결과 확인 (상태·금액은 그 단계 가격과 같아야) */
function confirmPaid(p: TossPayment, plan: PlanId): TossPayment {
  if (p.status !== "DONE") throw new Error(`결제 상태 ${p.status}`);
  if (p.totalAmount !== planOf(plan).priceKrw) throw new Error(`결제 금액 불일치 ${p.totalAmount}`);
  return p;
}

/**
 * 빌링키로 결제. 토스가 거절하면 TossError. 시간 초과처럼 결과를 모르면 주문 번호로 다시 조회해
 * 결제됐으면 그 결제를, 아니면 undefined(나중에 같은 번호로 다시)를 돌려준다
 */
async function charge(userId: string, billingKey: string, customerKey: string, orderId: string, plan: PlanId): Promise<TossPayment | undefined> {
  try {
    return confirmPaid(await chargeBillingKey(billingKey, { customerKey, orderId, orderName: orderName(plan), amount: planOf(plan).priceKrw }), plan);
  } catch (e) {
    if (e instanceof TossError) throw e;
    const p = await getPaymentByOrder(orderId).catch(() => undefined);
    if (p?.status === "DONE") return confirmPaid(p, plan);
    console.warn("[plus] charge unknown", userId, orderId, e);
    return undefined;
  }
}

async function recordPaid(userId: string, p: TossPayment, start: Date, end: Date, plan: PlanId) {
  await planColumns();
  await sql(
    `insert into payment (id, user_id, amount, status, paid_at, period_start, period_end, payment_key, raw, plan)
     values ($1, $2, $3, 'paid', $4, $5, $6, $7, $8, $9)
     on conflict (id) do update set status = 'paid', paid_at = $4, period_start = $5, period_end = $6, payment_key = $7, raw = $8, plan = $9`,
    [p.orderId, userId, p.totalAmount, new Date(p.approvedAt ?? Date.now()), start, end, p.paymentKey, JSON.stringify(p), plan],
  );
}

/** 카드 등록창을 열 때 브라우저에 주는 토스 고객 키 */
export const checkoutCustomerKey = (userId: string) => customerKeyOf(userId);

/** 처음 구독: 카드 등록창에서 돌아온 authKey로 빌링키 발급 → 첫 달 결제 → 구독 시작 (다음 결제일은 한 달 뒤) */
export async function subscribe(userId: string, authKey: string, customerKey: string, plan: PlanId = "plus"): Promise<PlusState> {
  await planColumns();
  if (customerKey !== customerKeyOf(userId)) throw new Error("카드 등록 정보가 이 계정과 맞지 않아요. 다시 시도해 주세요.");
  const cur = await getPlus(userId);
  if (cur.active && cur.status === "active") throw new Error("이미 Plus를 이용 중이에요");
  const { billingKey } = await issueBillingKey(authKey, customerKey);
  const p = await charge(userId, billingKey, customerKey, newPaymentId(userId), plan);
  if (!p) throw new Error("결제 결과를 확인하지 못했어요. 잠시 뒤 마이페이지에서 확인해 주세요.");
  const start = new Date(p.approvedAt ?? Date.now());
  // 해지 후 기간이 남은 상태에서 다시 구독하면 남은 기간 뒤로 이어 붙인다
  const base = cur.active && cur.periodEnd ? new Date(cur.periodEnd) : start;
  const end = addMonth(base);
  await recordPaid(userId, p, base, end, plan);
  await sql(
    `insert into plus_subscription (user_id, status, billing_key, customer_key, current_period_end, next_charge_at, plan)
     values ($1, 'active', $2, $3, $4, $4, $5)
     on conflict (user_id) do update set status = 'active', billing_key = $2, customer_key = $3, current_period_end = $4,
       next_charge_at = $4, next_payment_id = null, canceled_at = null, plan = $5, updated_at = now()`,
    [userId, billingKey, customerKey, end, plan],
  );
  return getPlus(userId);
}

/**
 * 1개월 이용권 결제창 열기 전: 주문 번호를 만들고 누구 주문인지 Redis에 1시간 기억한다 (승인 때 남의 주문을 쓰지 못하게).
 * 자동결제로 이용 중이면 막는다 (두 번 내지 않게)
 */
export async function startPass(userId: string, plan: PlanId = "plus"): Promise<{ orderId: string; orderName: string; amount: number; customerKey: string }> {
  const cur = await getPlus(userId);
  if (cur.active && cur.status === "active") throw new Error("이미 매달 자동결제로 Plus를 이용 중이에요");
  const orderId = newPaymentId(userId).replace(/^plus_/, "pass_");
  // 주문 주인과 단계를 같이 기억한다 (승인 때 금액을 그 단계 가격으로만 받는다)
  await kv.set(`passorder:${orderId}`, `${userId}|${plan}`, PASS_ORDER_TTL);
  return { orderId, orderName: passOrderName(plan), amount: planOf(plan).priceKrw, customerKey: customerKeyOf(userId) };
}

/**
 * 1개월 이용권 승인: 결제창에서 돌아온 값을 토스에 승인 요청 → 한 달 이용 (이용 중이면 남은 기간 뒤로 이어 붙임).
 * 결과를 모르는 오류(시간 초과 등)면 주문 번호로 다시 조회해 결제됐는지 확인한다
 */
export async function confirmPass(userId: string, paymentKey: string, orderId: string, amount: number): Promise<PlusState> {
  const [owner, planRaw] = String((await kv.get(`passorder:${orderId}`).catch(() => null)) ?? "").split("|");
  if (owner !== userId) throw new Error("주문 정보가 이 계정과 맞지 않아요. 다시 시도해 주세요.");
  const plan: PlanId = planRaw === "pro" ? "pro" : "plus";
  if (amount !== planOf(plan).priceKrw) throw new Error("결제 금액이 맞지 않아요");
  await planColumns();
  let p: TossPayment | undefined;
  try {
    p = confirmPaid(await confirmPayment(paymentKey, orderId, amount), plan);
  } catch (e) {
    if (e instanceof TossError) throw e;
    const found = await getPaymentByOrder(orderId).catch(() => undefined);
    if (found?.status !== "DONE") throw new Error("결제 결과를 확인하지 못했어요. 잠시 뒤 마이페이지에서 확인해 주세요.");
    p = confirmPaid(found, plan);
  }
  const cur = await getPlus(userId);
  const start = new Date(p.approvedAt ?? Date.now());
  const base = cur.active && cur.periodEnd ? new Date(cur.periodEnd) : start;
  const end = addMonth(base);
  // 같은 주문을 두 번 승인 처리하지 않는다 (QA 10/21 PLUS-04: 두 번 눌림·재시도·시간 초과 뒤 조회가 겹치면 한 달이 두 번 붙을 수 있었다).
  // 결제 기록(주문 번호가 키)을 먼저 넣은 요청만 기간을 늘리고, 이미 있으면 지금 상태만 돌려준다
  const claimed = await sql(
    `insert into payment (id, user_id, amount, status, paid_at, period_start, period_end, payment_key, raw, plan)
     values ($1, $2, $3, 'paid', $4, $5, $6, $7, $8, $9)
     on conflict (id) do nothing returning id`,
    [p.orderId, userId, p.totalAmount, new Date(p.approvedAt ?? Date.now()), base, end, p.paymentKey, JSON.stringify(p), plan],
  );
  if (!claimed.length) return getPlus(userId);
  await sql(
    `insert into plus_subscription (user_id, status, current_period_end, plan) values ($1, 'pass', $2, $3)
     on conflict (user_id) do update set status = 'pass', billing_key = null, current_period_end = $2,
       next_charge_at = null, next_payment_id = null, canceled_at = null, plan = $3, updated_at = now()`,
    [userId, end, plan],
  );
  await kv.set(`passorder:${orderId}`, "", 1).catch(() => {});
  return getPlus(userId);
}

/** 자동결제 성공: 한 달 연장, 다음 결제일 */
async function onPaid(s: SubRow, p: TossPayment): Promise<void> {
  const start = s.current_period_end > new Date() ? s.current_period_end : new Date();
  const end = addMonth(start);
  await recordPaid(s.user_id, p, start, end, s.plan ?? "plus");
  await sql(
    "update plus_subscription set status = 'active', current_period_end = $2, next_charge_at = $2, next_payment_id = null, updated_at = now() where user_id = $1",
    [s.user_id, end],
  );
}

/** 자동결제 실패(카드 거절 등) → 결제 실패 상태, 하루 뒤 다시 (최대 3번, 그 뒤에는 기간이 끝나면 만료) */
async function onFailed(s: SubRow, orderId: string, reason: string): Promise<void> {
  await sql(
    `insert into payment (id, user_id, amount, status, raw) values ($1, $2, $3, 'failed', $4) on conflict (id) do update set status = 'failed'`,
    [orderId, s.user_id, planOf(s.plan).priceKrw, JSON.stringify({ reason })],
  );
  const [{ n }] = await sql<{ n: number }>("select count(*)::int as n from payment where user_id = $1 and status = 'failed' and created_at > $2", [
    s.user_id,
    new Date(s.current_period_end.getTime() - 86_400_000),
  ]);
  const next = n < MAX_RETRIES ? new Date(Date.now() + RETRY_HOURS * 3600_000) : null;
  await sql("update plus_subscription set status = 'past_due', next_charge_at = $2, next_payment_id = null, updated_at = now() where user_id = $1", [
    s.user_id,
    next,
  ]);
  await opsAlert(`Plus 자동결제 실패 (${n}/${MAX_RETRIES})`, { userId: s.user_id, orderId, reason });
}

/**
 * 결제일이 된 구독을 결제한다 (10분 수집기가 부른다). 여러 서버가 동시에 불러도 한 회원은 한 곳만 맡는다
 * (UPDATE … RETURNING으로 맡은 표시를 하고, 결과를 모르면 같은 주문 번호로만 다시 보낸다). 결제된 회원 수를 돌려준다
 */
export async function chargeDue(): Promise<number> {
  if (!pool || !tossEnabled) return 0;
  const due = await sql<SubRow>(
    `update plus_subscription set next_charge_at = now() + make_interval(mins => $1), updated_at = now()
     where status in ('active', 'past_due') and billing_key is not null and next_charge_at <= now()
     returning *`,
    [CLAIM_MINUTES],
  );
  let paid = 0;
  for (const s of due) {
    const orderId = s.next_payment_id ?? newPaymentId(s.user_id);
    await sql("update plus_subscription set next_payment_id = $2 where user_id = $1", [s.user_id, orderId]);
    try {
      const p = await charge(s.user_id, s.billing_key!, s.customer_key ?? customerKeyOf(s.user_id), orderId, s.plan ?? "plus");
      if (p) {
        await onPaid(s, p);
        paid++;
      }
      // p가 없으면 결과를 모르는 것: 맡은 시간(30분)이 지나면 같은 주문 번호로 다시 시도된다
    } catch (e) {
      if (e instanceof TossError) await onFailed(s, orderId, e.message);
      else await opsAlert("Plus 자동결제 처리 오류", { userId: s.user_id, orderId, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return paid;
}

/** 해지: 다음 자동결제를 멈추고, 이미 낸 기간이 끝날 때까지는 계속 이용 */
export async function cancel(userId: string): Promise<PlusState> {
  const s = await sub(userId);
  if (!s || s.status === "expired") return getPlus(userId);
  await sql(
    "update plus_subscription set status = 'canceled', canceled_at = now(), next_charge_at = null, next_payment_id = null, updated_at = now() where user_id = $1",
    [userId],
  );
  return getPlus(userId);
}

/** 결제 후 7일 이내, 유료 기능을 쓰지 않았으면 전액 환불하고 바로 끝낸다 (환불정책 1번) */
export async function refundWithin7Days(userId: string): Promise<PlusState> {
  const state = await getPlus(userId);
  if (!state.refundable) throw new Error("환불 가능 기간이 지났거나 유료 기능을 이미 사용했어요. 고객센터로 문의해 주세요.");
  const [last] = await sql<{ id: string; payment_key: string }>(
    "select id, payment_key from payment where user_id = $1 and status = 'paid' order by paid_at desc limit 1",
    [userId],
  );
  await cancelPayment(last.payment_key, "결제 후 7일 이내 미사용 전액 환불");
  await sql("update payment set status = 'cancelled', cancelled_amount = amount where id = $1", [last.id]);
  await cancel(userId);
  await expire(userId);
  return getPlus(userId);
}

/**
 * 해외 여행 패스 (Paddle, 10/28): 결제 완료 알림 한 건 → days일 이용 (Pro 기능). 이용 중이면 남은 기간 뒤로 이어 붙인다.
 * 같은 거래(transaction id)는 한 번만 — 결제 기록을 먼저 넣은 요청만 기간을 늘린다 (Paddle은 알림을 여러 번 보낼 수 있다).
 * amount는 그 통화의 가장 작은 단위(센트 등), 통화·원본은 raw에
 */
export async function grantTravelPass(userId: string, txId: string, days: number, amountMinor: number, raw: unknown): Promise<PlusState> {
  await planColumns();
  const cur = await getPlus(userId);
  const start = new Date();
  const base = cur.active && cur.periodEnd ? new Date(cur.periodEnd) : start;
  const end = new Date(base.getTime() + days * 86_400_000);
  const claimed = await sql(
    `insert into payment (id, user_id, amount, status, paid_at, period_start, period_end, raw, plan)
     values ($1, $2, $3, 'paid', now(), $4, $5, $6, 'pro')
     on conflict (id) do nothing returning id`,
    [txId, userId, amountMinor, base, end, JSON.stringify(raw)],
  );
  if (!claimed.length) return getPlus(userId);
  // 자동결제로 이용 중이면 그 기간은 그대로 두고 결제 기록만 (두 번 내지 않게 화면에서 막지만, 혹시 겹치면 기간만 늘린다)
  await sql(
    `insert into plus_subscription (user_id, status, current_period_end, plan) values ($1, 'pass', $2, 'pro')
     on conflict (user_id) do update set
       status = case when plus_subscription.status = 'active' then 'active' else 'pass' end,
       current_period_end = $2, plan = 'pro', canceled_at = null, updated_at = now()`,
    [userId, end],
  );
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

/** 만료: 빌링키를 지운다 (토스 빌링키는 우리 시크릿 키 없이는 쓸 수 없고, 카드 정보는 토스에만 있다) */
async function expire(userId: string) {
  await sql(
    "update plus_subscription set status = 'expired', billing_key = null, next_charge_at = null, next_payment_id = null, updated_at = now() where user_id = $1",
    [userId],
  );
}

/** 기간이 끝난 해지·결제 실패 구독을 만료 처리 (매일 수집기에서 부른다) */
export async function expireEnded(): Promise<number> {
  if (!pool) return 0;
  const rows = await sql<{ user_id: string }>(
    "select user_id from plus_subscription where status in ('canceled', 'past_due', 'pass') and current_period_end < now() - interval '3 days'",
  );
  for (const r of rows) await expire(r.user_id);
  return rows.length;
}

// ── 자동결제 7일 전 안내 (정기결제 사전 고지). 매일 새벽 수집기에서 부른다

/** 7일(±1일) 뒤 자동결제 예정인 회원에게 메일(받을 수 있는 주소면)과 웹 푸시로 알린다. 보낸 회원 수를 돌려준다 */
export async function sendRenewalNotices(): Promise<number> {
  if (!pool) return 0;
  const due = await sql<{ user_id: string; email: string | null; current_period_end: Date }>(
    `select s.user_id, u.email, s.current_period_end
     from plus_subscription s join "user" u on u.id = s.user_id
     where s.status = 'active' and s.next_charge_at is not null
       and s.current_period_end between now() + interval '6 days' and now() + interval '8 days'
       and s.renewal_notice_for is distinct from s.current_period_end`,
  );
  let sent = 0;
  for (const d of due) {
    const date = d.current_period_end.toISOString().slice(0, 10);
    const price = PLUS.priceKrw.toLocaleString();
    let mailed = false;
    if (mailEnabled && isDeliverable(d.email)) {
      try {
        await sendMail({ to: d.email!, subject: `[CrowdView] ${date}에 Plus 이용료 ${price}원이 자동 결제돼요`, text: renewalText(date, price) });
        mailed = true;
      } catch (e) {
        await opsAlert("자동결제 안내 메일 실패", { userId: d.user_id, error: String(e) });
      }
    }
    const pushed = await pushToUser(d.user_id, (t, lang) => ({
      title: t("{date}에 Plus가 자동 결제돼요", { date }),
      body: t("월 {price}원 · 원하지 않으면 결제일 전에 마이페이지에서 해지하세요", { price }),
      url: lang === "ko" ? "/me" : `/${lang}/me`,
      tag: `renewal-${date}`,
    })).catch(() => 0);
    if (mailed || pushed) {
      sent++;
      await sql("update plus_subscription set renewal_notice_for = current_period_end where user_id = $1", [d.user_id]);
    } else {
      await opsAlert("자동결제 안내를 보낼 방법이 없어요 (메일·푸시 없음)", { userId: d.user_id, date });
    }
  }
  return sent;
}

export function renewalText(date: string, price: string): string {
  return [
    "안녕하세요, CrowdView입니다.",
    "",
    `${date}에 ${PLUS.name} 다음 달 이용료 ${price}원(부가세 포함)이 등록하신 카드로 자동 결제될 예정이에요.`,
    "계속 이용하시면 따로 하실 일은 없어요. 원하지 않으시면 결제일 전에 마이페이지에서 해지해 주세요.",
    "해지해도 이미 낸 기간이 끝날 때까지 Plus를 쓸 수 있어요.",
    "",
    "마이페이지: https://crowdview.app/me",
    "",
    `Your ${PLUS.name} (KRW ${price}) renews automatically on ${date}. You can cancel anytime before then: https://crowdview.app/en/me`,
  ].join("\n");
}

// ── 운영 도구 (/admin): 구독자 목록·결제 내역·수동 환불·해지

export interface AdminSubscriber {
  user_id: string;
  email: string | null;
  name: string | null;
  status: PlusState["status"];
  current_period_end: Date;
  canceled_at: Date | null;
  last_paid_at: Date | null;
  last_amount: number | null;
  failed: number;
}

export async function listSubscribers(): Promise<AdminSubscriber[]> {
  if (!pool) return [];
  return sql<AdminSubscriber>(
    `select s.user_id, u.email, u.name, s.status, s.current_period_end, s.canceled_at,
            p.paid_at as last_paid_at, p.amount as last_amount,
            (select count(*)::int from payment f where f.user_id = s.user_id and f.status = 'failed' and f.created_at > now() - interval '30 days') as failed
     from plus_subscription s
     join "user" u on u.id = s.user_id
     left join lateral (select paid_at, amount from payment where user_id = s.user_id and status = 'paid' order by paid_at desc limit 1) p on true
     order by s.updated_at desc limit 500`,
  );
}

export interface AdminPayment {
  id: string;
  user_id: string | null;
  email: string | null;
  amount: number;
  cancelled_amount: number;
  status: string;
  paid_at: Date | null;
  created_at: Date;
}

export async function recentPayments(limit = 100): Promise<AdminPayment[]> {
  if (!pool) return [];
  return sql<AdminPayment>(
    `select p.id, p.user_id, u.email, p.amount, p.cancelled_amount, p.status, p.paid_at, p.created_at
     from payment p left join "user" u on u.id = p.user_id order by p.created_at desc limit $1`,
    [limit],
  );
}

/** 운영자 환불: 가장 최근 결제를 전액(또는 amount원만) 취소. 전액이면 구독도 바로 끝낸다 */
export async function adminRefund(userId: string, reason: string, amount?: number): Promise<void> {
  const [last] = await sql<{ id: string; payment_key: string; amount: number; cancelled_amount: number }>(
    "select id, payment_key, amount, cancelled_amount from payment where user_id = $1 and status in ('paid', 'partial_cancelled') order by paid_at desc limit 1",
    [userId],
  );
  if (!last) throw new Error("환불할 결제가 없어요");
  const left = last.amount - last.cancelled_amount;
  const refund = amount === undefined ? left : Math.min(Math.max(1, Math.round(amount)), left);
  // 남은 금액 전부면 금액을 빼고 보낸다 (토스: 금액이 없으면 남은 금액 전액)
  await cancelPayment(last.payment_key, reason || "운영자 환불", refund === left ? undefined : refund);
  const full = refund === left;
  await sql("update payment set status = $2, cancelled_amount = cancelled_amount + $3 where id = $1", [
    last.id,
    full ? "cancelled" : "partial_cancelled",
    refund,
  ]);
  if (full) {
    await cancel(userId);
    await expire(userId);
  }
}

/** 운영자 해지: 다음 자동결제만 멈춤 (이미 낸 기간은 이용) */
export const adminCancel = (userId: string) => cancel(userId);
