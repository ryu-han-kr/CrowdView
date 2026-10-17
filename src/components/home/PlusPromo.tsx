import Link from "@/i18n/link";
import type { T } from "@/i18n/translate";

// 홈 중간의 Plus 혜택 배너: 혜택 3가지를 색 카드로 보여주고 요금 안내로 보낸다
const CARDS = [
  {
    title: "광고 없이 깔끔하게",
    sub: "보고 싶은 정보만",
    emoji: "🚫",
    head: "from-orange-500 to-amber-400",
    points: ["모든 화면의 광고 제거", "혼잡도·예측을 더 넓게"],
  },
  {
    title: "붐비기 전에 알림",
    sub: "찜한 곳이 한산해지면",
    emoji: "🔔",
    head: "from-indigo-600 to-blue-500",
    points: ["찜한 곳 혼잡 알림", "축제·명소 혼잡 변화 알림"],
  },
  {
    title: "맞춤 여행 추천",
    sub: "덜 붐비는 순서로",
    emoji: "🧭",
    head: "from-slate-700 to-slate-500",
    points: ["한산한 코스 전체 보기", "관심사·지역별 명소 추천"],
  },
];

export function PlusPromo({ t, price }: { t: T; price: string }) {
  return (
    <section className="mt-10 md:mt-14">
      <div className="flex items-end justify-between">
        <h2 className="text-lg font-bold md:text-xl">
          {t("CrowdView Plus")}
          <span className="ml-2 text-sm font-normal text-gray-500">{t("월 {n}원으로 더 편한 여행", { n: price })}</span>
        </h2>
      </div>
      <ul className="no-scrollbar -mx-5 mt-3 flex snap-x gap-3 overflow-x-auto px-5 md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:px-0">
        {CARDS.map((c) => (
          <li key={c.title} className="w-[78%] shrink-0 snap-start md:w-auto">
            <Link href="/pricing" className="block overflow-hidden rounded-3xl bg-white shadow-[0_2px_16px_rgba(15,23,42,0.08)]">
              <div className={`relative bg-gradient-to-r px-5 pt-4 pb-7 text-white ${c.head}`}>
                <p className="font-bold">{t(c.title)}</p>
                <p className="text-xs text-white/85">{t(c.sub)}</p>
                <span className="absolute top-2 right-4 text-4xl drop-shadow">{c.emoji}</span>
              </div>
              <div className="-mt-3 rounded-t-3xl bg-white px-5 pt-4 pb-5">
                <ul className="space-y-1 text-sm text-gray-700">
                  {c.points.map((p) => (
                    <li key={p}>· {t(p)}</li>
                  ))}
                </ul>
                <span className="mt-4 block rounded-xl bg-indigo-50 py-2.5 text-center text-sm font-bold text-indigo-600">{t("Plus 혜택 보기")}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
