import type { Metadata } from "next";
import Link from "@/i18n/link";
import { PlusCheckoutButton } from "@/components/PlusCheckoutButton";
import { TravelPass } from "@/components/TravelPass";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import type { T } from "@/i18n/translate";
import { pageMeta } from "@/lib/seo";
import { PLANS, PLUS } from "@/lib/business";
import { Glyph } from "@/components/Glyph";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const t = getT((await params).lang);
  return pageMeta({
    lang: (await params).lang,
    path: "/pricing",
    title: t("요금 안내"),
    description: t("CrowdView는 무료로 쓸 수 있어요. Plus는 광고 제거와 혼잡 알림을 1개월 {price}원에 제공해요.", {
      price: PLUS.priceKrw.toLocaleString(),
    }),
  });
}

// 무료 / Plus / Pro 비교 (✓ 제공, – 미제공, 글자면 그 범위만 제공)
const ROWS: [label: string, free: boolean | string, plus: boolean | string, pro: boolean | string][] = [
  ["실시간 혼잡도 (공항·놀이공원·관광지·축제·서울 121곳)", true, true, true],
  ["시간대별·주간·한 달 혼잡 예측", true, true, true],
  // 경수님 10/28: SK텔레콤 실측 '지금 실제 인원 보기' — 단계마다 횟수 (lib/business PLANS)
  ["지금 실제 인원 보기 (SK텔레콤 실측)", false, "하루 {d}회 · 월 {m}회:plus", "하루 {d}회 · 월 {m}회:pro"],
  ["방금 다른 회원이 본 곳은 횟수가 줄지 않아요 (10분 안)", false, true, true],
  // 경수님 QA #2 2단계 (10/27): 1년 혼잡 달력은 Plus 전용
  ["1년 혼잡 달력 (1년 중 한산한 날 한눈에)", false, true, true],
  ["한산한 코스 추천 전체 일정 (무료는 앞 2곳 미리보기)", false, true, true],
  ["광고 없이 보기", false, true, true],
  // 무료 회원도 알림 1개 (외부 점검 P2-1, 사용자 결정 10/21)
  ["찜한 장소가 한산해지면 알림 (웹 푸시)", "1개", "{n}개:plus", "{n}개:pro"],
  ["혼잡해지기 전에 미리 알림", "1개", "{n}개:plus", "{n}개:pro"],
  ["숙소 가성비 비교 (가격·평점·후기 AI 분석)", false, false, "곧 출시"],
  ["새 기능 먼저 써 보기", false, false, true],
  ["축제 일정, 날씨·미세먼지, 공항 주차·입국 정보", true, true, true],
  ["찜한 장소 · 여행 가이드 · 근처 숙소 찾기", true, true, true],
];

/** 표 칸: ✓ / – / 글자. 글자 끝 ':plus'·':pro'는 그 단계 숫자({d}·{m}·{n})로 채운다 */
function Cell({ v, color, t }: { v: boolean | string; color: string; t: T }) {
  if (typeof v !== "string") return v ? <Glyph e="✓" className={`mx-auto h-4 w-4 ${color}`} label="O" /> : <span className="text-gray-300">–</span>;
  const [text, plan] = v.split(":");
  const P = plan === "pro" ? PLANS.pro : plan === "plus" ? PLANS.plus : undefined;
  return <span className={`text-xs font-bold ${color}`}>{P ? t(text, { d: P.liveDaily, m: P.liveMonthly, n: P.alerts }) : t(text)}</span>;
}

export default async function PricingPage({ params }: { params: Promise<{ lang: string }> }) {
  // 매달 자동결제는 토스 자동결제 계약 뒤에 켠다 (components/PlusCheckoutButton 과 같은 스위치)
  const billing = process.env.NEXT_PUBLIC_PLUS_BILLING !== "off";
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const won = (n: number) => n.toLocaleString();
  return (
    <main className="px-5 pt-6 pb-12 md:px-0 md:pt-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold md:text-3xl">{t("요금 안내")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("혼잡도와 예측은 모두 무료예요. 지금 실제 인원까지 보고 싶다면 Plus·Pro를 골라 보세요.")}</p>

        {/* 외국어 화면: 해외 카드로 결제하는 여행 패스(Paddle)를 먼저 (경수님 10/28 '해외는 패스로') */}
        {lang !== "ko" && <TravelPass />}

        {/* 세 단계 카드: 무료(흰) · Plus(보라) · Pro(검정·금색) — 경수님 10/28 '단계를 까리하게, 색다르게' */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <section className="flex flex-col rounded-3xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-500">{t("무료")}</p>
            <p className="mt-1 text-3xl font-extrabold">{t("{n}원", { n: "0" })}</p>
            <p className="mt-1 text-xs text-gray-500">{t("로그인 없이 바로 써요")}</p>
            <ul className="mt-4 flex-1 space-y-1.5 text-sm text-gray-700">
              <li>· {t("실시간 혼잡도·예측 전부")}</li>
              <li>· {t("알림 {n}개", { n: 1 })}</li>
            </ul>
            <Link href="/" className="mt-5 block rounded-2xl bg-gray-100 py-3 text-center text-sm font-bold text-gray-800">
              {t("무료로 둘러보기")}
            </Link>
          </section>

          <section className="relative flex flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white shadow-lg shadow-indigo-500/20">
            <p className="text-sm font-semibold text-white/80">{PLANS.plus.name}</p>
            <p className="mt-1 text-3xl font-extrabold">{t("월 {n}원", { n: won(PLANS.plus.priceKrw) })}</p>
            <p className="mt-1 text-xs text-white/80">{t("부가세 포함 · 매달 자동결제 또는 1개월 이용권")}</p>
            <ul className="mt-4 flex-1 space-y-1.5 text-sm">
              <li>· {t("지금 실제 인원 보기 하루 {d}회 (월 {m}회)", { d: PLANS.plus.liveDaily, m: PLANS.plus.liveMonthly })}</li>
              <li>· {t("광고 없이 · 1년 혼잡 달력 · 코스 전체")}</li>
              <li>· {t("알림 {n}개", { n: PLANS.plus.alerts })}</li>
            </ul>
            <PlusCheckoutButton className="mt-5 w-full" plan="plus" />
          </section>

          <section className="relative flex flex-col overflow-hidden rounded-3xl bg-gray-950 p-5 text-white shadow-xl ring-1 ring-amber-300/60">
            {/* 금빛 테두리 빛: 카드 위쪽에 은은한 광 */}
            <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-amber-300/25 blur-3xl" />
            <span className="absolute top-4 right-4 rounded-full bg-gradient-to-r from-amber-300 to-yellow-200 px-2.5 py-0.5 text-[11px] font-extrabold text-gray-900">
              {t("가장 넉넉하게")}
            </span>
            <p className="w-fit bg-gradient-to-r from-amber-200 to-yellow-100 bg-clip-text text-sm font-bold text-transparent">{PLANS.pro.name}</p>
            <p className="mt-1 text-3xl font-extrabold">{t("월 {n}원", { n: won(PLANS.pro.priceKrw) })}</p>
            <p className="mt-1 text-xs text-white/70">{t("부가세 포함 · 매달 자동결제 또는 1개월 이용권")}</p>
            <ul className="mt-4 flex-1 space-y-1.5 text-sm text-white/90">
              <li>
                · <b className="text-amber-200">{t("지금 실제 인원 보기 하루 {d}회 (월 {m}회)", { d: PLANS.pro.liveDaily, m: PLANS.pro.liveMonthly })}</b>
              </li>
              <li>· {t("Plus 기능 전부 + 알림 {n}개", { n: PLANS.pro.alerts })}</li>
              <li>· {t("숙소 가성비 AI 비교 (곧 출시) · 새 기능 먼저")}</li>
            </ul>
            <PlusCheckoutButton className="mt-5 w-full" plan="pro" tone="gold" />
          </section>
        </div>

        {/* 결제대행사·카드사 심사: 상품마다 가격·결제 주기·제공 기간·해지·환불을 명확히 */}
        <section className="mt-6 grid gap-3 rounded-3xl bg-indigo-50/60 p-4 text-sm md:grid-cols-3">
          <div>
            <p className="font-bold text-gray-900">{t("매달 자동결제")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-600">
              {billing
                ? t("첫 결제일과 같은 날 매달 자동으로 결제돼요. 결제 7일 전에 미리 알려 드려요.")
                : t("토스페이먼츠 자동결제 준비가 끝나는 대로 열려요. 그동안은 1개월 이용권으로 쓸 수 있어요.")}
            </p>
          </div>
          <div>
            <p className="font-bold text-gray-900">{t("언제든 해지")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{t("마이페이지에서 바로 해지돼요. 해지해도 이미 낸 기간까지는 계속 써요.")}</p>
          </div>
          <div>
            <p className="font-bold text-gray-900">{t("7일 안 전액 환불")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{t("결제 후 7일 안에 유료 기능을 쓰지 않았다면 전액 돌려 드려요.")}</p>
          </div>
        </section>

        {/* 휴대폰에선 옆으로 밀어 보는 표: 키보드로도 넘기게 (axe scrollable-region-focusable) */}
        <div className="mt-8 overflow-x-auto" tabIndex={0} role="region" aria-label={t("무료·Plus·Pro 기능 비교")}>
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <th className="py-2 font-medium">{t("기능")}</th>
                <th className="w-20 py-2 text-center font-medium">{t("무료")}</th>
                <th className="w-28 py-2 text-center font-bold text-indigo-600">Plus</th>
                <th className="w-28 bg-amber-50/60 py-2 text-center font-bold text-amber-700">Pro</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, free, plus, pro]) => (
                <tr key={label} className="border-b border-gray-100">
                  <td className="py-3 pr-2">{t(label)}</td>
                  <td className="text-center">
                    <Cell v={free} color="text-emerald-700" t={t} />
                  </td>
                  <td className="text-center">
                    <Cell v={plus} color="text-indigo-600" t={t} />
                  </td>
                  <td className="bg-amber-50/60 text-center">
                    <Cell v={pro} color="text-amber-700" t={t} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-8 rounded-2xl bg-gray-50 p-4 text-xs leading-relaxed text-gray-600">
          <p className="font-bold text-gray-800">{t("결제 전에 꼭 확인하세요")}</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>{t("Plus는 월 {plus}원, Pro는 월 {pro}원이에요 (부가세 포함).", { plus: won(PLANS.plus.priceKrw), pro: won(PLANS.pro.priceKrw) })}</li>
            <li>{t("1개월 이용권은 한 번만 결제하고, 자동으로 다시 결제되지 않아요.")}</li>
            {billing ? (
              <>
                <li>{t("매달 자동결제는 결제한 날부터 1개월마다 같은 날 같은 금액이 결제돼요.")}</li>
                <li>{t("자동결제는 마이페이지에서 언제든 해지할 수 있고, 해지해도 남은 기간은 계속 쓸 수 있어요.")}</li>
              </>
            ) : (
              <li>{t("이용 중에 다시 결제하면 남은 기간 뒤로 1개월이 더해져요.")}</li>
            )}
            <li>{t("지금 실제 인원은 SK텔레콤 장소 혼잡도 자료이며, 하루·월 횟수는 다음 날·다음 달에 다시 채워져요.")}</li>
            <li>{t("결제 후 7일 안에 유료 기능을 쓰지 않았다면 전액 환불해 드려요.")}</li>
            <li>{t("결제는 토스페이먼츠가 처리하며 CrowdView는 카드번호를 저장하지 않아요.")}</li>
          </ul>
          <p className="mt-3 flex gap-3 font-semibold">
            <Link href="/refund" className="text-indigo-600">
              {t("환불정책")} ›
            </Link>
            <Link href="/terms" className="text-indigo-600">
              {t("이용약관")} ›
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
