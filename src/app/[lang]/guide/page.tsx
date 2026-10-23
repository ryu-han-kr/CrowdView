import type { Metadata } from "next";
import { GuideList, type Row } from "@/components/GuideList";
import { translateNames } from "@/lib/name-translate";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { GUIDE, GUIDE_KINDS, RESERVATIONS, type GuidePlace } from "@/lib/seoul-guide";
import { LANDMARKS } from "@/lib/korea";
import { SEOUL_AREAS } from "@/lib/seoul-areas";
import { guideNames } from "@/lib/guide-names";
import { pageMeta } from "@/lib/seo";
import { Glyph } from "@/components/Glyph";

// 정적 데이터 + 하루 한 번 다시 그림 (체험 예약 마감 순서만 바뀐다)
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = (await params).lang;
  const t = getT(lang);
  return pageMeta({
    lang,
    path: "/guide",
    title: t("서울 여행 가이드: 명소·맛집·쇼핑"),
    description: t("Visit Seoul 공식 다국어 명소·맛집·쇼핑·자연 정보에 그 동네의 지금 혼잡도를 붙였어요"),
  });
}

// '기본순'은 이름난 곳부터 (UI QA: 달마사·금선사처럼 덜 알려진 곳이 맨 위였다).
// 서울 대표 명소와 이름이 같은 곳(명소 목록 순서) → 이름 일부가 겹치는 곳(경복궁 돌담길 등) → 서울 실시간 지역 이름 → 사진 있음 → 나머지
const norm = (s: string) => s.replace(/[\s()·]/g, "");
const FAMOUS = LANDMARKS.filter((l) => l.region === "서울").map((l) => norm(l.n.ko));
const AREAS = SEOUL_AREAS.map((a) => norm(a.name.replace(/관광특구|역$/g, ""))).filter((n) => n.length >= 3);
function fame(p: GuidePlace): number {
  const n = norm(p.t.ko?.n ?? "");
  // 같은 곳의 다른 표기: '동대문디자인플라자(DDP)' ↔ '동대문디자인플라자', '롯데월드타워' ↔ '롯데월드타워 서울스카이'
  // (경복궁 집옥재·경복궁 돌담길처럼 대표 명소 안의 작은 곳은 다음 등급)
  const exact = FAMOUS.findIndex(
    (f) => f === n || (n.length >= 3 && f.startsWith(n) && f.length - n.length <= 6) || (n.startsWith(f) && /^[A-Za-z]+$/.test(n.slice(f.length))),
  );
  if (n.length >= 2 && exact >= 0) return exact / 100;
  // 사진이 없는 곳은 이름이 알려져 있어도 사진 있는 곳 뒤로 (목록 위쪽이 아이콘으로 차지 않게)
  if (n.length >= 3 && FAMOUS.some((f) => n.startsWith(f) || f.includes(n))) return p.img ? 1 : 3.5;
  if (n.length >= 3 && AREAS.some((a) => n.startsWith(a))) return p.img ? 2 : 3.5;
  return p.img ? 3 : 4;
}

export default async function GuidePage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const t = getT(lang);
  // 접수 마감이 지난 것은 빼고 (데이터는 주 1회 갱신이라 상태만으로는 늦다)
  const nowKst = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 16).replace("T", " ");
  const open = RESERVATIONS.filter((r) => r.status === "접수중" && (!r.rcptEnd || r.rcptEnd >= nowKst))
    .sort((a, b) => a.rcptEnd.localeCompare(b.rcptEnd))
    .slice(0, 6);
  // 첫 탭(명소) 이름: 그 언어 글이 없는 곳은 이름만 번역 (다른 탭은 /data/guide-{lang}.json이 같은 방식)
  const attractions = GUIDE.filter((p) => p.kind === "attraction" && (lang === "ko" || !p.id.startsWith("kt-"))).sort(
    (a, b) => fame(a) - fame(b),
  );
  const [names, resTr] = await Promise.all([
    guideNames(attractions, lang),
    // 체험 이름·장소도 외국어로 (6건, Papago 캐시). 자체 QA 10/22: en·ja에 한글 그대로
    translateNames(open.flatMap((r) => [r.n, r.place]), lang),
  ]);
  const rt = (x: string) => resTr.get(x) ?? x;
  return (
    <main className="px-5 pt-6 pb-10 md:px-0 md:pt-10">
      <h1 className="text-2xl font-bold md:text-3xl">{t("서울 여행 가이드")}</h1>
      <p className="mt-1 mb-5 text-sm text-gray-500">{t("명소·맛집·쇼핑·자연 + 그 동네의 지금 혼잡도")}</p>
      <GuideList
        initial={attractions.map((p) => [p.id, p.kind, names.get(p.id) ?? p.id, p.lat ?? null, p.lng ?? null, p.gu ?? null, p.img ?? null] as Row)}
        counts={Object.fromEntries(
          GUIDE_KINDS.map((k) => [k.id, GUIDE.filter((p) => p.kind === k.id && (lang === "ko" || !p.id.startsWith("kt-"))).length]),
        )}
      />

      {open.length > 0 && (
        <section className="mt-10">
          <h2 className="flex items-center gap-1.5 text-lg font-bold">
            <Glyph e="🎟️" className="h-5 w-5 text-indigo-500" /> {t("지금 예약할 수 있는 체험")}
          </h2>
          <p className="text-xs text-gray-500">{t("서울시 공공서비스 예약 (고궁·박물관·문화시설)")}</p>
          <ul className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {open.map((r) => (
              <li key={r.id}>
                <a href={r.url} target="_blank" rel="noreferrer" className="block h-full rounded-2xl border border-gray-100 px-4 py-3">
                  <span className="block line-clamp-2 text-sm font-semibold">{rt(r.n)}</span>
                  <span className="mt-1 block text-xs text-gray-500">
                    {rt(r.place)} · {t(r.fee)} · {t("접수 마감")} {r.rcptEnd.slice(5, 10)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
          {lang !== "ko" && <p className="mt-2 text-[11px] text-gray-500">{t("체험 이름은 자동 번역이에요. 예약은 서울시 사이트(한국어)에서 해요.")}</p>}
        </section>
      )}
      <p className="mt-8 text-center text-[11px] text-gray-500">
        {t("Visit Seoul · 서울시 공공서비스예약 (서울 열린데이터광장, 주 1회 갱신). 위치는 가까운 지하철역 기준이에요.")}
      </p>
    </main>
  );
}
