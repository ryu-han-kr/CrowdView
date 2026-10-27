import type { Metadata } from "next";
import Link from "@/i18n/link";
import { notFound } from "next/navigation";
import { AdminActions } from "@/components/AdminActions";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { currentAdmin } from "@/lib/admin";
import { dbEnabled } from "@/lib/db";
import { listSubscribers, recentPayments } from "@/lib/plus";
import { NoTrack } from "@/components/NoTrack";
import { getTraffic } from "@/lib/traffic";
import { AD_IMPRESSION_RPM, AFFILIATE, dayRevenue } from "@/lib/revenue";

// 운영 도구: 구독자 목록·최근 결제·수동 환불/해지. ADMIN_EMAILS 운영자만 (그 외에는 없는 페이지)
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "운영 도구", robots: { index: false, follow: false } };

const STATUS: Record<string, string> = { active: "이용 중", canceled: "해지(기간 남음)", past_due: "결제 실패", expired: "끝남" };
const PAY: Record<string, string> = { paid: "결제", failed: "실패", cancelled: "전액 취소", partial_cancelled: "일부 취소" };
const won = (n: number) => `${Math.round(n).toLocaleString()}원`;
const day = (d: Date | null) => (d ? new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 16).replace("T", " ") : "-");

export default async function AdminPage() {
  if (!dbEnabled || !(await currentAdmin())) notFound();
  const [subs, pays, traffic] = await Promise.all([listSubscribers(), recentPayments(100), getTraffic(14)]);
  const active = subs.filter((s) => s.status === "active" || s.status === "canceled").length;
  const month = pays.filter((p) => p.status === "paid" && p.paid_at && Date.now() - p.paid_at.getTime() < 30 * 86_400_000);
  const revenue = month.reduce((s, p) => s + p.amount - p.cancelled_amount, 0);

  return (
    <main className="px-5 pt-6 pb-10 md:px-0 md:pt-10">
      <h1 className="text-2xl font-bold">운영 도구</h1>
      <p className="mt-1 text-sm text-gray-500">
        이용 중 {active}명 · 결제 실패 {subs.filter((s) => s.status === "past_due").length}명 · 최근 30일 결제 {month.length}건{" "}
        {revenue.toLocaleString()}원 (KST 표시)
      </p>

      <NoTrack />
      <p className="mt-3 text-sm">
        <Link href="/admin/status" className="font-semibold text-indigo-600">
          연동·권한 상태 (API 키·제휴·광고·분석·인프라) ›
        </Link>
      </p>
      <AdminOverview />
      <section className="mt-8">
        <h2 className="text-lg font-bold">이용·기대수익 (최근 14일)</h2>
        <p className="mt-1 text-xs text-gray-500">
          순방문자는 하루에 여러 번 와도 1명, 방문은 탭을 새로 열 때마다 1번, 페이지뷰는 화면을 넘길 때마다 1. 애드센스는 페이지뷰(채워진 광고 노출)에,
          제휴는 클릭 뒤 실제 이용한 예약에 돈이 붙는다. 봇·자동화 브라우저·이 관리자 브라우저는 빠진다.
        </p>
        <div className="mt-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white">
          <table className="w-full text-right text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">날짜</th>
                <th className="px-3 py-2">순방문자</th>
                <th className="px-3 py-2">방문</th>
                <th className="px-3 py-2">페이지뷰</th>
                <th className="px-3 py-2">1인당 페이지</th>
                <th className="px-3 py-2">휴대폰</th>
                <th className="px-3 py-2">외국어</th>
                <th className="px-3 py-2">광고 노출</th>
                <th className="px-3 py-2">제휴 클릭</th>
                <th className="px-3 py-2">광고 기대</th>
                <th className="px-3 py-2">제휴 기대 (잠재)</th>
                <th className="px-3 py-2">1인당</th>
              </tr>
            </thead>
            <tbody>
              {traffic.map((d) => {
                const r = dayRevenue(d);
                const ads = Object.entries(d.f).filter(([k]) => /^ad:(rail|inline)$/.test(k)).reduce((s, [, n]) => s + n, 0);
                const aff = Object.entries(d.f).filter(([k]) => k.startsWith("aff:")).reduce((s, [, n]) => s + n, 0);
                const foreign = d.pv ? 1 - (d.f["pv:ko"] ?? 0) / d.pv : 0;
                return (
                  <tr key={d.date} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-left">{d.date.slice(5)}</td>
                    <td className="px-3 py-2">{d.uv.toLocaleString()}</td>
                    <td className="px-3 py-2">{d.sessions.toLocaleString()}</td>
                    <td className="px-3 py-2">{d.pv.toLocaleString()}</td>
                    <td className="px-3 py-2">{d.uv ? (d.pv / d.uv).toFixed(1) : "-"}</td>
                    <td className="px-3 py-2">{d.pv ? `${Math.round(((d.f["pv:m"] ?? 0) / d.pv) * 100)}%` : "-"}</td>
                    <td className="px-3 py-2">{d.pv ? `${Math.round(foreign * 100)}%` : "-"}</td>
                    <td className="px-3 py-2">{ads.toLocaleString()}</td>
                    <td className="px-3 py-2">{aff.toLocaleString()}</td>
                    <td className="px-3 py-2">
                      {won(r.ads)}
                      {r.adsFrom === "estimated" && d.pv > 0 && <span className="text-[10px] text-gray-400"> 추정</span>}
                    </td>
                    <td className="px-3 py-2">
                      {won(r.affiliate)} <span className="text-[10px] text-gray-400">({won(r.affiliatePotential)})</span>
                    </td>
                    <td className="px-3 py-2 font-bold">{d.uv ? won(r.perUser) : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[11px] text-gray-500">
          가정 (lib/revenue.ts, 실제 보고서가 쌓이면 바꾼다): 광고 노출 1,000번당{" "}
          {Object.entries(AD_IMPRESSION_RPM)
            .map(([l, v]) => `${l} ${v.toLocaleString()}원`)
            .join(" · ")}
          , 광고가 아직 없을 때는 페이지뷰 × 1칸 × 채움 80% · 숙소 클릭의 {AFFILIATE.stay.conversion * 100}%가 평균 {AFFILIATE.stay.avgOrder.toLocaleString()}원 예약 ×{" "}
          {AFFILIATE.stay.commission * 100}% · 투어 {AFFILIATE.tour.conversion * 100}% × {AFFILIATE.tour.avgOrder.toLocaleString()}원 × {AFFILIATE.tour.commission * 100}%
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold">구독자</h2>
        <div className="mt-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2">회원</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">이용 끝</th>
                <th className="px-3 py-2">최근 결제</th>
                <th className="px-3 py-2">30일 실패</th>
                <th className="px-3 py-2">처리</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.user_id} className="border-t border-gray-100 align-top">
                  <td className="px-3 py-2">
                    <b>{s.name ?? "-"}</b>
                    <span className="block text-xs text-gray-500">{s.email}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{STATUS[s.status] ?? s.status}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{day(s.current_period_end)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {day(s.last_paid_at)}
                    {s.last_amount !== null && <span className="block text-xs text-gray-500">{s.last_amount.toLocaleString()}원</span>}
                  </td>
                  <td className={`px-3 py-2 ${s.failed ? "font-bold text-red-600" : ""}`}>{s.failed}</td>
                  <td className="px-3 py-2">{s.status !== "expired" && <AdminActions userId={s.user_id} label={s.email ?? s.user_id} />}</td>
                </tr>
              ))}
              {!subs.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                    아직 구독자가 없어요
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold">최근 결제 100건</h2>
        <div className="mt-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2">시각</th>
                <th className="px-3 py-2">회원</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2 text-right">금액</th>
                <th className="px-3 py-2 text-right">취소</th>
                <th className="px-3 py-2">결제 ID</th>
              </tr>
            </thead>
            <tbody>
              {pays.map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 whitespace-nowrap">{day(p.paid_at ?? p.created_at)}</td>
                  <td className="px-3 py-2 text-xs">{p.email ?? "(탈퇴)"}</td>
                  <td className={`px-3 py-2 whitespace-nowrap ${p.status === "failed" ? "font-bold text-red-600" : ""}`}>
                    {PAY[p.status] ?? p.status}
                  </td>
                  <td className="px-3 py-2 text-right">{p.amount.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{p.cancelled_amount ? p.cancelled_amount.toLocaleString() : ""}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-gray-500">{p.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="mt-6 text-[11px] text-gray-500">환불은 토스페이먼츠에서 실제로 처리되고, 처리할 때마다 디스코드 운영 채널에 기록이 남아요.</p>
    </main>
  );
}
