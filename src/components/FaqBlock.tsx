import { jsonLd } from "@/lib/seo";

export interface Faq {
  q: string;
  a: string;
}

/**
 * 자주 묻는 질문 + FAQPage 구조화 데이터.
 * 생성형 AI 검색(ChatGPT·Perplexity·구글 AI 개요 등)이 그대로 인용할 수 있게, 질문 하나에 숫자와 기준 시각이 든 짧은 답 하나.
 * 구글 지침상 구조화 데이터의 내용은 화면에도 보여야 해서 접힌 목록으로 함께 그린다
 */
export function FaqBlock({ title, items, className = "" }: { title: string; items: Faq[]; className?: string }) {
  if (!items.length) return null;
  return (
    <section className={className}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          }),
        }}
      />
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-2 divide-y divide-gray-100 rounded-2xl border border-gray-100">
        {items.map((f) => (
          <details key={f.q} className="group px-4 py-3">
            <summary className="cursor-pointer list-none text-sm font-semibold">
              <span className="mr-1 text-indigo-500">Q.</span>
              {f.q}
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
