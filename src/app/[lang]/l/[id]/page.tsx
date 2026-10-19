import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/i18n/link";
import { ImportListButton } from "@/components/ShareListButtons";
import { PlaceRow } from "@/components/PlaceRow";
import { Glyph } from "@/components/Glyph";
import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { getAllCrowd } from "@/lib/crowd/service";
import { getSharedList } from "@/lib/list-share";
import { getPlace } from "@/lib/places";

// 공유받은 찜 목록 (마이페이지에서 만든 링크, 30일 보관). 개인 목록이라 검색엔진에는 올리지 않는다
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string; id: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const t = getT(lang);
  return { title: t("공유받은 찜 목록"), robots: { index: false, follow: true } };
}

export default async function SharedListPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  const t = getT(lang as Lang);
  const list = await getSharedList(id);
  if (!list) notFound();
  const places = list.favorites.map(getPlace).filter((p) => !!p);
  const crowd = places.length ? await getAllCrowd() : {};
  return (
    <main className="px-5 pt-6 pb-10 md:px-0 md:pt-10">
      <p className="text-xs font-semibold text-indigo-500">{t("공유받은 찜 목록")}</p>
      <h1 className="mt-1 text-2xl font-bold md:text-3xl">{t("가고 싶은 곳")}</h1>
      <p className="mt-1 text-sm text-gray-500">{t("혼잡도는 지금 기준이에요")}</p>
      <div className="mt-6 max-w-2xl space-y-8">
        {places.length > 0 && (
          <section>
            <h2 className="flex items-center gap-1.5 text-lg font-bold">
              <Glyph e="❤️" className="h-5 w-5 text-rose-500" /> {t("즐겨찾기")}
            </h2>
            <ul className="mt-1 divide-y divide-gray-100">
              {places.map((p) => (
                <li key={p.id}>{crowd[p.id] && <PlaceRow place={p} crowd={crowd[p.id]} />}</li>
              ))}
            </ul>
          </section>
        )}
        {list.picks.length > 0 && (
          <section>
            <h2 className="flex items-center gap-1.5 text-lg font-bold">
              <Glyph e="⭐" className="h-5 w-5 text-amber-400" /> {t("담은 곳")}
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {list.picks.map((p) => (
                <li key={p.id}>
                  <Link href={p.href} className="block rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900">
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div>
          <ImportListButton favorites={places.map((p) => p.id)} picks={list.picks} />
          <Link
            href="/route"
            className="mt-3 block rounded-2xl border border-indigo-200 bg-white py-3.5 text-center text-sm font-bold text-indigo-700"
          >
            <Glyph e="🧭" /> {t("담은 곳으로 코스 짜기")}
          </Link>
        </div>
      </div>
    </main>
  );
}
