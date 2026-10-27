import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/i18n/link";
import { NoTrack } from "@/components/NoTrack";
import { currentAdmin } from "@/lib/admin";
import { dbEnabled } from "@/lib/db";
import { withAffiliate } from "@/lib/affiliate";
import { COUPANG_LINKS } from "@/lib/coupang-links";
import { getApiUsage } from "@/lib/api-quota";
import { GROUP_LABEL, INTEGRATIONS, statusOf, type Group, type Status } from "@/lib/integrations";

// 연동·권한 상태 (경수님 10/27: 관련 모든 권한·상태를 한 화면에서). 운영자만. 환경변수는 '있다/없다'만 보이고 값은 절대 내보내지 않는다
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "연동·권한 상태", robots: { index: false, follow: false } };

const BADGE: Record<Status, [string, string]> = {
  ok: ["연결됨", "bg-emerald-50 text-emerald-700"],
  partial: ["일부만", "bg-amber-50 text-amber-800"],
  pending: ["승인 대기", "bg-sky-50 text-sky-800"],
  todo: ["할 일", "bg-rose-50 text-rose-700"],
  "app-only": ["앱만", "bg-gray-100 text-gray-600"],
};

/** 제휴 링크가 실제로 업체로 넘어가는지 (첫 리다이렉트까지만, 4초) */
async function probe(url: string): Promise<{ code: number | null; to?: string }> {
  try {
    const r = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(4000), headers: { "user-agent": "Mozilla/5.0 CrowdView-admin-check" } });
    const loc = r.headers.get("location") ?? undefined;
    return { code: r.status, to: loc ? new URL(loc, url).host : undefined };
  } catch {
    return { code: null };
  }
}

const raw = (id: string, url: string) => ({ id, url: withAffiliate(id, url), tagged: withAffiliate(id, url) !== url });
const SAMPLES: { id: string; name: string; url: string; tagged: boolean }[] = [
  { name: "Trip.com 투어", ...raw("trip-tour", "https://kr.trip.com/things-to-do/list?keyword=%EC%97%90%EB%B2%84%EB%9E%9C%EB%93%9C") },
  { name: "아고다 숙소", ...raw("agoda", "https://www.agoda.com/ko-kr/search?textToSearch=%EC%97%90%EB%B2%84%EB%9E%9C%EB%93%9C") },
  { name: "클룩", ...raw("klook", "https://www.klook.com/ko/search/result/?query=%EC%97%90%EB%B2%84%EB%9E%9C%EB%93%9C") },
  { name: "마이리얼트립", ...raw("myrealtrip", "https://www.myrealtrip.com/search?q=%EC%97%90%EB%B2%84%EB%9E%9C%EB%93%9C") },
  { name: "GetYourGuide", ...raw("getyourguide", "https://www.getyourguide.com/s/?q=Everland") },
  { name: "KKday (링크프라이스)", ...raw("kkday", "https://www.kkday.com/ko/product/productlist?keyword=%EC%97%90%EB%B2%84%EB%9E%9C%EB%93%9C") },
  // 쿠팡은 주소 자체가 파트너스 짧은 링크
  { id: "coupang", name: "쿠팡 (에버랜드)", url: COUPANG_LINKS["에버랜드"], tagged: true },
];

export default async function AdminStatusPage() {
  if (!dbEnabled || !(await currentAdmin())) notFound();
  const rows = INTEGRATIONS.map((i) => ({ ...i, ...statusOf(i) }));
  const [usage, probes] = await Promise.all([getApiUsage().catch(() => []), Promise.all(SAMPLES.map((s) => probe(s.url)))]);
  const count = (s: Status) => rows.filter((r) => r.status === s).length;
  const todos = rows.filter((r) => r.todo && r.status !== "ok");
  const groups = Object.keys(GROUP_LABEL) as Group[];
  const hot = usage.filter((u) => u.count > 0 || (u.pct ?? 0) > 0).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));

  return (
    <main className="px-5 pt-6 pb-10 md:px-0 md:pt-10">
      <NoTrack />
      <p className="text-sm">
        <Link href="/admin" className="text-indigo-600">
          ‹ 운영 도구
        </Link>
      </p>
      <h1 className="mt-1 text-2xl font-bold">연동·권한 상태</h1>
      <p className="mt-1 text-sm text-gray-500">
        API 키·제휴·광고·분석·인프라를 한 곳에서. 환경변수는 운영 서버에 &apos;있는지&apos;만 표시(값은 보이지 않음). 승인·가입 상태는 마지막 확인 날짜 기준이고{" "}
        <code className="text-xs">src/lib/integrations.ts</code>에서 고친다.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(["ok", "pending", "todo", "partial"] as Status[]).map((s) => (
          <div key={s} className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold text-gray-500">{BADGE[s][0]}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{count(s)}</p>
          </div>
        ))}
      </div>

      {todos.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold">경수님 할 일 {todos.length}개</h2>
          <ol className="mt-2 space-y-2">
            {todos.map((r) => (
              <li key={r.id} className="rounded-2xl border border-rose-100 bg-rose-50/40 px-4 py-3 text-sm">
                <p className="font-bold">
                  {r.name} <span className={`ml-1 rounded-md px-1.5 py-0.5 text-xs ${BADGE[r.status][1]}`}>{BADGE[r.status][0]}</span>
                </p>
                <p className="mt-1 text-gray-700">{r.todo}</p>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-indigo-600">
                    관리 화면 열기 ›
                  </a>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {groups.map((g) => {
        const list = rows.filter((r) => r.group === g);
        if (!list.length) return null;
        return (
          <section key={g} className="mt-8">
            <h2 className="text-lg font-bold">{GROUP_LABEL[g]}</h2>
            <div className="mt-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2">연동</th>
                    <th className="px-3 py-2">상태</th>
                    <th className="px-3 py-2">환경변수</th>
                    <th className="px-3 py-2">계정·비용</th>
                    <th className="px-3 py-2">메모</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100 align-top">
                      <td className="px-3 py-2 font-semibold">
                        {r.url ? (
                          <a href={r.url} target="_blank" rel="noreferrer" className="text-gray-900 underline decoration-gray-300 underline-offset-2">
                            {r.name}
                          </a>
                        ) : (
                          r.name
                        )}
                        {r.checked && <span className="ml-1 text-xs font-normal text-gray-500">({r.checked} 확인)</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${BADGE[r.status][1]}`}>{BADGE[r.status][0]}</span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.env.length ? (
                          <ul className="space-y-0.5">
                            {r.env.map((k) => (
                              <li key={k} className={r.missing.includes(k) ? "text-rose-700" : "text-emerald-700"}>
                                {r.missing.includes(k) ? "✗" : "✓"} <code>{k}</code>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-gray-500">없음</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">{[r.account, r.cost].filter(Boolean).join(" · ") || "-"}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">{r.note ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <section className="mt-8">
        <h2 className="text-lg font-bold">제휴 링크 실제 연결 점검 (지금)</h2>
        <p className="mt-1 text-xs text-gray-500">운영 서버에서 첫 이동만 확인. 3xx면 업체로 넘어감, 200이면 바로 열림. 일부 업체는 서버 요청을 막아 403이 나와도 브라우저에선 열린다.</p>
        <div className="mt-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2">링크</th>
                <th className="px-3 py-2">제휴 값 붙음</th>
                <th className="px-3 py-2">응답</th>
                <th className="px-3 py-2">넘어간 곳</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLES.map((s, i) => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-semibold">{s.name}</td>
                  <td className={`px-3 py-2 text-xs font-bold ${s.tagged ? "text-emerald-700" : "text-rose-700"}`}>
                    {s.tagged ? "✓ 붙음" : "✗ 없음"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{probes[i].code ?? "실패"}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{probes[i].to ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold">오늘 외부 API 사용량</h2>
        <p className="mt-1 text-xs text-gray-500">원본 API를 실제로 부른 횟수(캐시 제외). 한도의 90%에서 자동으로 멈추고 마지막 자료를 쓴다.</p>
        <div className="mt-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">API</th>
                <th className="px-3 py-2 text-right">오늘</th>
                <th className="px-3 py-2 text-right">일 한도</th>
                <th className="px-3 py-2 text-right">사용률</th>
              </tr>
            </thead>
            <tbody>
              {hot.map((u) => (
                <tr key={u.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-left">{u.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{u.count.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{u.limit ? `${u.limit.toLocaleString()}${u.limitGuess ? " (추정)" : ""}` : "-"}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${(u.pct ?? 0) >= 80 ? "font-bold text-rose-700" : ""}`}>{u.pct !== undefined ? `${u.pct.toFixed(1)}%` : "-"}</td>
                </tr>
              ))}
              {!hot.length && (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-center text-gray-500">
                    오늘 호출 기록이 없어요
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
