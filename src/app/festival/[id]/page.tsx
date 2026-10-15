import Link from "next/link";
import { notFound } from "next/navigation";
import { DataTag } from "@/components/DataTag";
import { LevelBadge } from "@/components/Level";
import { FESTIVAL_STEPS, getFestival, getFestivalCrowd, getFestivalLive, isLongRunning, seoulAreaOf } from "@/lib/festivals";
import { compactNumber } from "@/lib/format";
import { LEVELS, levelOf } from "@/lib/levels";
import { daysUntil, kst } from "@/lib/time";

export const revalidate = 3600;

const pct = (r: number) => `${r >= 1 ? "+" : ""}${Math.round((r - 1) * 100)}%`;

export default async function FestivalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = await getFestival(id);
  if (!f) notFound();
  const [crowd, live] = await Promise.all([getFestivalCrowd(f), getFestivalLive(f)]);
  const area = seoulAreaOf(f);
  const today = kst().date;
  const dday = daysUntil(f.start);
  const ongoing = f.start <= today && f.end >= today;
  const level = crowd && levelOf(crowd.score);
  const mapUrl = `https://map.naver.com/p/search/${encodeURIComponent(`${f.title} ${f.region}`)}`;

  return (
    <main className="px-5 pt-4 pb-10 md:px-0 md:pt-8">
      <Link href="/events" className="text-sm text-gray-500">
        ← 축제 목록
      </Link>

      <div className="mt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-10">
        <div>
          <div className="relative h-56 overflow-hidden rounded-3xl bg-gray-100 md:h-80">
            {f.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.image} alt={f.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-7xl">🎪</div>
            )}
            <span className="absolute right-2 bottom-2 rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white/90">
              사진 {f.source === "tourapi" ? "한국관광공사" : "서울시 문화행사 정보"}
            </span>
          </div>
          <div className="mt-4 flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold md:text-3xl">{f.title}</h1>
            <span className="mt-1 shrink-0 rounded-full bg-gray-900 px-2.5 py-1 text-xs font-bold text-white">
              {ongoing ? "진행 중" : dday > 0 ? `D-${dday}` : "종료"}
            </span>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="기간">
              {f.start}
              {f.end !== f.start && ` ~ ${f.end}`}
            </Row>
            <Row label="장소">
              {f.place}
              <a href={mapUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs font-semibold text-indigo-600">
                지도 보기 ›
              </a>
            </Row>
            {f.fee && <Row label="요금">{f.fee}</Row>}
            {f.tel && <Row label="문의">{f.tel}</Row>}
            {f.link && (
              <Row label="홈페이지">
                <a href={f.link} target="_blank" rel="noreferrer" className="break-all text-indigo-600 underline">
                  {f.link}
                </a>
              </Row>
            )}
          </dl>
        </div>

        <div className="mt-6 lg:mt-0">
          {live && (
            <section className="mb-4 rounded-3xl p-5" style={{ background: `${levelOf(live.score).color}14` }}>
              <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <span className="rounded bg-emerald-600 px-1.5 py-px text-[10px] font-bold text-white">실시간</span>
                지금 {live.area} 일대
              </p>
              <p className="mt-1 text-2xl font-extrabold" style={{ color: levelOf(live.score).color }}>
                {levelOf(live.score).label}
                <span className="ml-2 text-base font-semibold text-gray-900">
                  {compactNumber(live.min)}~{compactNumber(live.max)}명
                </span>
              </p>
              {live.forecast.length > 0 && (
                <ul className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
                  {live.forecast.slice(0, 8).map((p) => (
                    <li key={p.time} className="w-16 shrink-0 rounded-xl bg-white/80 py-1.5 text-center">
                      <p className="text-[10px] text-gray-500">{p.time.slice(11, 13)}시</p>
                      <p className="text-xs font-bold" style={{ color: levelOf(p.score).color }}>
                        {levelOf(p.score).label.replace("매우 ", "매우")}
                      </p>
                      <p className="text-[10px] text-gray-500">{compactNumber(Math.round((p.min + p.max) / 2))}</p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] text-gray-400">
                서울시 실시간 도시데이터 · 서울시 단계 &lsquo;{live.level}&rsquo; · {live.time} 기준 · 축제 장소에서 {live.distance}m
                떨어진 실시간 지역
              </p>
            </section>
          )}
          {!live && area && (
            <p className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
              이 축제는 서울시 실시간 지역 &lsquo;{area.name}&rsquo; 안에서 열려요. 축제가 시작되면 실시간 인구를 보여드려요.
            </p>
          )}
          <section className="rounded-3xl p-5" style={{ background: level ? `${level.color}14` : "#f9fafb" }}>
            <p className="text-xs font-medium text-gray-500">
              예상 혼잡도
              <DataTag />
            </p>
            {crowd && level ? (
              <>
                <p className="mt-1 text-2xl font-extrabold" style={{ color: level.color }}>
                  {level.label}
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  작년 이 기간 {crowd.signguName} 방문객이 평소보다 <b>{pct(crowd.ratio)}</b>
                  {crowd.ratio >= 1 ? " 많았어요" : " 적었어요"}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-gray-600">
                {isLongRunning(f)
                  ? "한 달 넘게 이어지는 상설·장기 행사라 특정일 혼잡 예측은 하지 않아요."
                  : "이 지역의 작년 방문객 데이터가 없어 예측하지 못했어요."}
              </p>
            )}
          </section>

          {crowd && (
            <section className="mt-4 rounded-2xl border border-gray-100 p-4 text-sm">
              <h2 className="font-bold">이렇게 예측했어요</h2>
              <ul className="mt-2 space-y-1.5 text-xs text-gray-600">
                <li>
                  · 작년 같은 요일 기간 ({crowd.days[0].slice(5)}
                  {crowd.days.length > 1 && ` ~ ${crowd.days.at(-1)!.slice(5)}`}) {crowd.signguName} 외지인·외국인 방문객 하루 평균{" "}
                  <b>{crowd.festivalAvg.toLocaleString()}명</b>
                </li>
                <li>
                  · 평소 (그 전 4주 같은 요일) 하루 평균 <b>{crowd.baselineAvg.toLocaleString()}명</b> → <b>{crowd.ratio.toFixed(2)}배</b>
                </li>
                <li>· 시군구 전체 기준이라 작은 축제는 변화가 작게 나올 수 있어요.</li>
              </ul>
              <div className="mt-3 flex overflow-hidden rounded-lg text-center text-[10px] leading-tight">
                {LEVELS.map((l, i) => (
                  <div key={l.key} className="flex-1 py-1.5" style={{ background: `${l.color}1f`, color: l.color }}>
                    <b>{l.label}</b>
                    <br />
                    {i === 0
                      ? `~${pct(FESTIVAL_STEPS[0])}`
                      : i === 4
                        ? `${pct(FESTIVAL_STEPS[3])}+`
                        : `~${pct(FESTIVAL_STEPS[i])}`}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-gray-400">출처: 한국관광공사 데이터랩 (이동통신 방문자, 시군구 일별)</p>
            </section>
          )}

          {crowd && level && (
            <p className="mt-4 text-xs text-gray-500">
              <LevelBadge score={crowd.score} /> 은 평소 대비 방문객 증가율로 정한 단계예요.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-14 shrink-0 text-gray-400">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}
