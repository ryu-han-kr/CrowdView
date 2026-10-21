import type { Metadata } from "next";
import Link from "@/i18n/link";
import { PlusCheckoutButton } from "@/components/PlusCheckoutButton";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { pageMeta } from "@/lib/seo";
import { PLUS } from "@/lib/business";
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

// 무료 / Plus 비교 (✓ 제공, – 미제공)
const ROWS: [label: string, free: boolean, plus: boolean][] = [
  ["실시간 혼잡도 (공항·놀이공원·관광지·축제·서울 121곳)", true, true],
  ["시간대별·주간 혼잡 예측", true, true],
  ["축제 일정, 날씨·미세먼지, 공항 주차·입국 정보", true, true],
  ["찜한 장소 모아 보기", true, true],
  ["지역별 명소·서울 여행 가이드·근처 숙소 찾기", true, true],
  ["한산한 코스 추천 전체 일정 (무료는 앞 2곳 미리보기)", false, true],
  ["광고 없이 보기", false, true],
  ["찜한 장소가 한산해지면 알림 (웹 푸시)", false, true],
  ["혼잡해지기 전에 미리 알림", false, true],
];

export default async function PricingPage({ params }: { params: Promise<{ lang: string }> }) {
  // 매달 자동결제는 토스 자동결제 계약 뒤에 켠다 (components/PlusCheckoutButton 과 같은 스위치)
  const billing = process.env.NEXT_PUBLIC_PLUS_BILLING !== "off";
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  const price = PLUS.priceKrw.toLocaleString();
  return (
    <main className="px-5 pt-6 pb-12 md:px-0 md:pt-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold md:text-3xl">{t("요금 안내")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("혼잡도와 예측은 모두 무료예요. Plus는 더 편하게 쓰고 싶은 분을 위한 선택이에요.")}</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <section className="rounded-3xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-500">{t("무료")}</p>
            <p className="mt-1 text-3xl font-extrabold">{t("{n}원", { n: "0" })}</p>
            <p className="mt-1 text-xs text-gray-500">{t("로그인 없이 바로 써요")}</p>
            <Link href="/" className="mt-5 block rounded-2xl bg-gray-100 py-3 text-center text-sm font-bold text-gray-800">
              {t("무료로 둘러보기")}
            </Link>
          </section>
          <section className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white">
            <p className="text-sm font-semibold text-white/80">{PLUS.name}</p>
            <p className="mt-1 text-3xl font-extrabold">{billing ? t("월 {n}원", { n: price }) : t("1개월 {n}원", { n: price })}</p>
            <p className="mt-1 text-xs text-white/80">{billing ? t("부가세 포함 · 1개월 이용권 또는 매달 자동결제") : t("부가세 포함 · 1개월 이용권 (한 번 결제, 자동 갱신 없음)")}</p>
            {/* 결제대행사·카드사 심사: 상품 페이지에 서비스 제공 기간을 명확히 */}
            <p className="mt-1 text-xs font-semibold text-white">{billing ? t("이용 기간: 결제한 날부터 1개월 (자동결제를 고르면 매달 같은 날 갱신)") : t("이용 기간: 결제한 날부터 1개월")}</p>
            <PlusCheckoutButton className="mt-5 w-full" />
          </section>
        </div>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="py-2 font-medium">{t("기능")}</th>
              <th className="w-16 py-2 text-center font-medium">{t("무료")}</th>
              <th className="w-16 py-2 text-center font-medium">Plus</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([label, free, plus]) => (
              <tr key={label} className="border-b border-gray-100">
                <td className="py-3 pr-2">{t(label)}</td>
                <td className="text-center">
                  {free ? <Glyph e="✓" className="mx-auto h-4 w-4 text-emerald-700" label="O" /> : <span className="text-gray-300">–</span>}
                </td>
                <td className="text-center">
                  {plus ? <Glyph e="✓" className="mx-auto h-4 w-4 text-indigo-600" label="O" /> : <span className="text-gray-300">–</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-8 rounded-2xl bg-gray-50 p-4 text-xs leading-relaxed text-gray-600">
          <p className="font-bold text-gray-800">{t("결제 전에 꼭 확인하세요")}</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>{t("1개월 이용권은 {price}원을 한 번만 결제하고, 자동으로 다시 결제되지 않아요.", { price })}</li>
            {billing ? (
              <>
                <li>{t("매달 자동결제는 결제한 날부터 1개월마다 같은 날 {price}원이 결제돼요.", { price })}</li>
                <li>{t("자동결제는 마이페이지에서 언제든 해지할 수 있고, 해지해도 남은 기간은 계속 쓸 수 있어요.")}</li>
              </>
            ) : (
              <li>{t("이용 중에 다시 결제하면 남은 기간 뒤로 1개월이 더해져요.")}</li>
            )}
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
