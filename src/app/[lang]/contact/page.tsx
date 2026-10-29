import type { Metadata } from "next";
import type { Lang } from "@/i18n/config";
import { pageMeta } from "@/lib/seo";
import { BUSINESS } from "@/lib/business";

// 문의하기 (애드센스 심사 10/28 메일: '소개'·'문의하기' 페이지). 연락처는 푸터와 같은 lib/business 값
export const revalidate = 86400;

type Copy = { title: string; lead: string; rows: { k: string; v: string; mail?: boolean }[]; tips: string[] };

const KO: Copy = {
  title: "문의하기",
  lead: "서비스 이용, 결제·환불, 데이터 오류 제보, 제휴 문의는 아래로 연락해 주세요. 보통 영업일 1~2일 안에 답장드려요.",
  rows: [
    { k: "이메일", v: BUSINESS.email, mail: true },
    { k: "전화", v: `${BUSINESS.phone} (평일 10:00~18:00)` },
    { k: "주소", v: BUSINESS.address },
    { k: "사업자", v: `${BUSINESS.company} · 대표 ${BUSINESS.ceo} · 사업자등록번호 ${BUSINESS.bizNo} · 통신판매업 신고 ${BUSINESS.mailOrderNo}` },
  ],
  tips: [
    "혼잡도가 실제와 다르면 장소 이름과 본 시각을 함께 보내 주시면 확인이 빨라요.",
    "결제·환불은 가입한 이메일과 결제 날짜를 적어 주세요.",
    "개인정보 관련 요청(열람·정정·삭제)도 같은 이메일로 받아요.",
  ],
};

const EN: Copy = {
  title: "Contact us",
  lead: "For help with the service, payments and refunds, data corrections or partnerships, contact us below. We usually reply within 1–2 business days.",
  rows: [
    { k: "Email", v: BUSINESS.email, mail: true },
    { k: "Phone", v: `+82 ${BUSINESS.phone.replace(/^0/, "")} (weekdays 10:00–18:00 KST)` },
    { k: "Address", v: "Seoul, Republic of Korea" },
    { k: "Business", v: `${BUSINESS.company} (sole proprietor) · registration no. ${BUSINESS.bizNo}` },
  ],
  tips: [
    "If a crowd level looks wrong, include the place name and the time you checked.",
    "For payments and refunds, include your account email and payment date.",
    "Privacy requests (access, correction, deletion) go to the same email.",
  ],
};

const copyOf = (lang: Lang) => (lang === "ko" ? KO : EN);

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  const c = copyOf(lang);
  return pageMeta({ lang, path: "/contact", title: c.title, description: c.lead });
}

export default async function ContactPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const c = copyOf(lang);
  return (
    <main className="px-5 pt-6 pb-10 md:px-0 md:pt-10">
      <article className="max-w-3xl">
        <h1 className="text-2xl font-bold md:text-3xl">{c.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">{c.lead}</p>
        <dl className="mt-6 divide-y divide-gray-100 rounded-2xl border border-gray-100 text-sm">
          {c.rows.map((r) => (
            <div key={r.k} className="flex gap-4 px-4 py-3">
              <dt className="w-20 shrink-0 font-semibold text-gray-500">{r.k}</dt>
              <dd className="min-w-0 break-words text-gray-900">
                {r.mail ? (
                  <a href={`mailto:${r.v}`} className="font-semibold text-indigo-700 underline">
                    {r.v}
                  </a>
                ) : (
                  r.v
                )}
              </dd>
            </div>
          ))}
        </dl>
        <ul className="mt-6 list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-700">
          {c.tips.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </article>
    </main>
  );
}
