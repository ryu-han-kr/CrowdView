// 운영 도구 첫머리 (사용자 10/26: 회원·수입·비용·데이터 정확도·보관 용량을 한 곳에서, 표는 보기 좋게).
// 서버에서 모아 그리는 표시 전용. 수치 출처: Postgres(회원·결제·지난 기록), Redis(이용 집계·정확도), 비용 리포트(lib/billing/report)
import Link from "@/i18n/link";
import { HORIZONS, getAccuracy, type DayStat } from "@/lib/accuracy";
import { storageStats } from "@/lib/archive-daily";
import { buildCostReport } from "@/lib/billing/report";
import { sql } from "@/lib/db";
import { dayRevenue } from "@/lib/revenue";
import { getTraffic } from "@/lib/traffic";

const won = (n: number) => `${Math.round(n).toLocaleString()}원`;
const mb = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(2)}GB` : `${(b / 1e6).toFixed(1)}MB`);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "-");

function Kpi({ label, value, sub, tone = "gray" }: { label: string; value: string; sub?: string; tone?: "gray" | "green" | "red" | "indigo" }) {
  const color = { gray: "text-gray-900", green: "text-emerald-700", red: "text-rose-700", indigo: "text-indigo-700" }[tone];
  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-500">{sub}</p>}
    </div>
  );
}

/** 표 공통 겉모양: 머리 회색, 줄마다 가는 선, 숫자는 오른쪽 정렬 */
function Table({ head, rows, foot, alignLeft = 1 }: { head: string[]; rows: (string | number)[][]; foot?: (string | number)[]; alignLeft?: number }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white">
      <table className="w-full text-sm whitespace-nowrap">
        <thead className="bg-gray-50 text-xs text-gray-500">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`px-3 py-2 ${i < alignLeft ? "text-left" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-gray-100 even:bg-gray-50/40">
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-2 tabular-nums ${j < alignLeft ? "text-left font-medium" : "text-right"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-bold">
            <tr>
              {foot.map((c, j) => (
                <td key={j} className={`px-3 py-2 tabular-nums ${j < alignLeft ? "text-left" : "text-right"}`}>
                  {c}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export async function AdminOverview() {
  const [members, pays, traffic, cost, acc, store] = await Promise.all([
    sql<{ m: string; n: string }>(`select to_char("createdAt" at time zone 'Asia/Seoul','YYYY-MM') m, count(*) n from "user" group by 1 order by 1`).catch(() => []),
    sql<{ m: string; paid: string; n: string }>(
      `select to_char(paid_at at time zone 'Asia/Seoul','YYYY-MM') m, sum(amount - cancelled_amount) paid, count(*) n
         from payment where status in ('paid','partial_cancelled','cancelled') and paid_at is not null group by 1 order by 1`,
    ).catch(() => []),
    getTraffic(62),
    buildCostReport().catch(() => null),
    getAccuracy(7),
    storageStats(),
  ]);
  const plus = await sql<{ n: string }>(`select count(*) n from plus_subscription where status in ('active','canceled')`).catch(() => [{ n: "0" }]);

  // 월별: 회원(누적), 결제, 광고·제휴 기대(이용 집계가 있는 날만), 비용(고정 월비 + 이번 달은 네이버 예상)
  const fixed = cost ? cost.fixed.reduce((s, f) => s + f.krw, 0) : 0;
  const thisMonth = cost?.month ?? new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7);
  const monthSet = new Set<string>([...members.map((r) => r.m), ...pays.map((r) => r.m), ...traffic.filter((d) => d.pv).map((d) => d.date.slice(0, 7)), thisMonth]);
  const months = [...monthSet].sort().slice(-6);
  let cum = members.filter((r) => r.m < (months[0] ?? "")).reduce((s, r) => s + Number(r.n), 0);
  const monthly = months.map((m) => {
    const joined = Number(members.find((r) => r.m === m)?.n ?? 0);
    cum += joined;
    const paid = Number(pays.find((r) => r.m === m)?.paid ?? 0);
    const days = traffic.filter((d) => d.date.startsWith(m));
    const expected = days.reduce((s, d) => s + dayRevenue(d).total, 0);
    const uv = days.reduce((s, d) => s + d.uv, 0);
    const spend = m === thisMonth && cost ? cost.projectedKrw : fixed;
    return { m, joined, cum, paid, expected, uv, spend, profit: paid + expected - spend };
  });
  const cur = monthly.find((x) => x.m === thisMonth);
  const totalMembers = members.reduce((s, r) => s + Number(r.n), 0);

  // 정확도 7일 합계
  const accSum = HORIZONS.map((h) => {
    const s = acc.reduce<DayStat>(
      (a, d) => {
        const x = d.stats[h.id];
        return x ? { n: a.n + x.n, match: a.match + x.match, absErr: a.absErr + x.absErr } : a;
      },
      { n: 0, match: 0, absErr: 0 },
    );
    return { label: h.label, ...s };
  });

  // 보관: 하루 평균 원본 크기로 1년 예상
  const perDay = store.days ? store.rawBytes / store.days : 0;
  const perDayRows = store.days ? store.rows / store.days : 0;

  return (
    <>
      <section className="mt-6">
        <h2 className="text-lg font-bold">한눈에 ({thisMonth})</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          <Kpi label="전체 회원" value={`${totalMembers.toLocaleString()}명`} sub={`이번 달 신규 ${cur?.joined ?? 0}명`} tone="indigo" />
          <Kpi label="Plus 이용 중" value={`${Number(plus[0]?.n ?? 0)}명`} sub={`회원의 ${pct(Number(plus[0]?.n ?? 0), totalMembers)}`} />
          <Kpi label="이번 달 결제 수입" value={won(cur?.paid ?? 0)} sub="취소 금액 뺀 값" />
          <Kpi label="이번 달 광고·제휴 기대" value={won(cur?.expected ?? 0)} sub="이용 집계로 본 추정" />
          <Kpi label="이번 달 예상 비용" value={won(cur?.spend ?? fixed)} sub={cost ? `지금까지 ${won(cost.monthToDateKrw)}` : "비용 리포트 실패"} tone="red" />
          <Kpi label="예상 손익" value={won(cur?.profit ?? 0)} sub="수입 + 기대 − 비용" tone={(cur?.profit ?? 0) >= 0 ? "green" : "red"} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold">월별 회원·수입·비용 (최근 6개월)</h2>
        <Table
          head={["월", "신규 회원", "누적 회원", "순방문(합)", "결제 수입", "광고·제휴 기대", "비용", "손익"]}
          rows={monthly.map((x) => [
            x.m,
            x.joined.toLocaleString(),
            x.cum.toLocaleString(),
            x.uv.toLocaleString(),
            won(x.paid),
            won(x.expected),
            won(x.spend),
            won(x.profit),
          ])}
          foot={[
            "합계",
            monthly.reduce((s, x) => s + x.joined, 0).toLocaleString(),
            "",
            monthly.reduce((s, x) => s + x.uv, 0).toLocaleString(),
            won(monthly.reduce((s, x) => s + x.paid, 0)),
            won(monthly.reduce((s, x) => s + x.expected, 0)),
            won(monthly.reduce((s, x) => s + x.spend, 0)),
            won(monthly.reduce((s, x) => s + x.profit, 0)),
          ]}
        />
        <p className="mt-1 text-[11px] text-gray-500">
          비용: 지난달까지는 고정 월비, 이번 달은 네이버 클라우드 청구 추정을 더한 월말 예상. 광고·제휴 기대는 이용 집계(최근 62일)가 있는 날만 더한 추정이라 실제
          애드센스·제휴 보고서와 다를 수 있어요.
        </p>
      </section>

      {cost && (
        <section className="mt-8">
          <h2 className="text-lg font-bold">비용 내역 ({cost.month})</h2>
          <Table
            head={["서비스", "요금제·메모", "월 금액"]}
            alignLeft={2}
            rows={[
              ...cost.fixed.map((f) => [f.name, f.note, won(f.krw)]),
              ["네이버 클라우드 (지도·Papago)", "error" in cost.naver ? `조회 실패: ${cost.naver.error.slice(0, 40)}` : "이번 달 청구 추정", "error" in cost.naver ? "-" : won(cost.naver.demandKrw)],
            ]}
            foot={["월말 예상", `${cost.daysElapsed}/${cost.daysInMonth}일 기준`, won(cost.projectedKrw)]}
          />
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-bold">데이터 정확도 (최근 7일)</h2>
        <Table
          head={["예측", "비교 수", "단계 일치", "평균 오차(점)"]}
          rows={accSum.map((a) => [a.label, a.n.toLocaleString(), pct(a.match, a.n), a.n ? (a.absErr / a.n).toFixed(1) : "-"])}
        />
        <p className="mt-1 text-[11px] text-gray-500">
          서울 121곳에서 매시간 예측을 저장해 두고 그 시각의 서울시 실측과 비교. 단계 일치 = 화면 5단계가 맞은 비율, 평균 오차 = 0~100점 차이.{" "}
          <Link href="/accuracy" className="font-semibold text-indigo-600">
            공개 정확도 페이지 ›
          </Link>
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold">데이터 보관 (매일 저장)</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Kpi label="정리한 날" value={`${store.days}일`} sub={store.first ? `${store.first} ~ ${store.last}` : "아직 없음 (매시 40분 정리)"} />
          <Kpi label="원본 (R2, 5분마다)" value={mb(store.rawBytes)} sub={`스냅샷 ${store.snapshots.toLocaleString()}개`} />
          <Kpi label="날짜별 요약 (Postgres)" value={`${store.rows.toLocaleString()}줄`} sub={store.dailyTableBytes !== undefined ? mb(store.dailyTableBytes) : undefined} />
          <Kpi label="1년 예상" value={mb(perDay * 365)} sub={`요약 ${Math.round(perDayRows * 365).toLocaleString()}줄 · DB 전체 ${store.dbBytes ? mb(store.dbBytes) : "-"}`} />
        </div>
        {store.byMonth.length > 0 && (
          <Table
            head={["월", "정리한 날", "스냅샷", "원본 크기", "하루 평균"]}
            rows={store.byMonth.map((m) => [m.month, `${m.days}일`, m.snapshots.toLocaleString(), mb(m.rawBytes), mb(m.rawBytes / m.days)])}
          />
        )}
        <div className="mt-3 overflow-x-auto rounded-2xl border border-gray-100 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">어디에</th>
                <th className="px-3 py-2 text-left">무엇을</th>
                <th className="px-3 py-2 text-left">얼마나 · 비용</th>
              </tr>
            </thead>
            <tbody className="[&_td]:px-3 [&_td]:py-2 [&_tr]:border-t [&_tr]:border-gray-100">
              <tr>
                <td className="font-medium whitespace-nowrap">Cloudflare R2</td>
                <td>5분마다 전체 원본 (장소 약 45곳 + 서울 121곳, gzip). 나중에 모델 학습·재계산용</td>
                <td>하루 약 {perDay ? mb(perDay) : "3MB"}, 1년 약 {perDay ? mb(perDay * 365) : "1.1GB"} · 10GB까지 무료, 넘으면 GB당 월 약 $0.015</td>
              </tr>
              <tr>
                <td className="font-medium whitespace-nowrap">Postgres (Neon)</td>
                <td>매일 한 곳 한 줄: 하루 평균·최대·가장 붐빈 시각·0~23시 띠 → 공개 ‘지난 혼잡 기록’ 화면</td>
                <td>하루 약 {Math.round(perDayRows || 170)}줄(약 50KB), 1년 약 20MB · 무료 0.5GB 안</td>
              </tr>
              <tr>
                <td className="font-medium whitespace-nowrap">Redis (Upstash)</td>
                <td>화면용 최근 8일 5분 기록 + 장소별 하루 요약 400일 + 정확도 60일</td>
                <td>명령 수 과금 (월 상한 $20)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[11px] text-gray-500">
          정리는 매시 40분 cron(archive-daily)이 아직 안 한 지난 날을 찾아 한 번에 4일까지. 공개 화면:{" "}
          <Link href="/history" className="font-semibold text-indigo-600">
            지난 혼잡 기록 ›
          </Link>
        </p>
      </section>
    </>
  );
}
