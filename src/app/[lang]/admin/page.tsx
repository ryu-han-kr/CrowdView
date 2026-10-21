import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminActions } from "@/components/AdminActions";
import { currentAdmin } from "@/lib/admin";
import { dbEnabled } from "@/lib/db";
import { listSubscribers, recentPayments } from "@/lib/plus";

// 운영 도구: 구독자 목록·최근 결제·수동 환불/해지. ADMIN_EMAILS 운영자만 (그 외에는 없는 페이지)
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "운영 도구", robots: { index: false, follow: false } };

const STATUS: Record<string, string> = { active: "이용 중", canceled: "해지(기간 남음)", past_due: "결제 실패", expired: "끝남" };
const PAY: Record<string, string> = { paid: "결제", failed: "실패", cancelled: "전액 취소", partial_cancelled: "일부 취소" };
const day = (d: Date | null) => (d ? new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 16).replace("T", " ") : "-");

export default async function AdminPage() {
  if (!dbEnabled || !(await currentAdmin())) notFound();
  const [subs, pays] = await Promise.all([listSubscribers(), recentPayments(100)]);
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

      <section className="mt-6">
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
