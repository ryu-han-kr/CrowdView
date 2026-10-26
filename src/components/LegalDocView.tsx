import type { Lang } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/business";
import type { LegalDoc } from "@/lib/legal";

/** 약관·방침 본문. 한국어 원문이 기준이라 다른 언어 화면에는 안내 문구를 붙인다 */
export function LegalDocView({ doc, lang }: { doc: LegalDoc; lang: Lang }) {
  const t = getT(lang);
  return (
    <main className="px-5 pt-6 pb-12 md:px-0 md:pt-10">
      <article className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold md:text-3xl">{t(doc.title)}</h1>
        <p className="mt-1 text-xs text-gray-500">{t("시행일 {date}", { date: doc.effectiveDate ?? LEGAL_EFFECTIVE_DATE })}</p>
        {doc.revision && (
          <section lang="ko" className="mt-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <h2 className="font-bold">
              개정 안내 · {doc.revision.noticeDate} 공지, {doc.effectiveDate} 시행
            </h2>
            <ul className="mt-1.5 space-y-1 text-xs leading-relaxed">
              {doc.revision.changes.map((c) => (
                <li key={c}>• {c}</li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs">이전 방침({LEGAL_EFFECTIVE_DATE} 시행)과 다른 내용은 위 항목뿐이에요.</p>
          </section>
        )}
        {lang !== "ko" && (
          <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
            {t("이 문서는 한국어 원문이 기준이에요. 번역은 제공하지 않아요.")}
          </p>
        )}
        {doc.sections.map((s) => (
          <section key={s.title} lang="ko" className="mt-7">
            <h2 className="text-base font-bold">{s.title}</h2>
            <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-gray-700">
              {s.body.map((p, i) =>
                p.startsWith("- ") ? (
                  <p key={i} className="flex gap-2 pl-1">
                    <span className="text-gray-500">•</span>
                    <span>{p.slice(2)}</span>
                  </p>
                ) : (
                  <p key={i}>{p}</p>
                ),
              )}
            </div>
          </section>
        ))}
      </article>
    </main>
  );
}
