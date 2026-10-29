import type { Metadata } from "next";
import Link from "@/i18n/link";
import type { Lang } from "@/i18n/config";
import { pageMeta } from "@/lib/seo";
import { BUSINESS } from "@/lib/business";

// 서비스 소개 (애드센스 심사 10/28 메일: '소개'·'문의하기' 페이지가 있어야 한다). 한국어·영어 본문, 일본어·중국어 화면은 영어
export const revalidate = 86400;

type Copy = { title: string; lead: string; sections: { h: string; body: string[] }[]; links: [string, string][] };

const KO: Copy = {
  title: "CrowdView 소개",
  lead: "CrowdView는 한국의 놀이공원·궁궐·해수욕장·스키장·공항·축제가 지금 얼마나 붐비는지, 언제 가면 한산한지 알려 주는 혼잡도·여행 안내 서비스예요.",
  sections: [
    {
      h: "무엇을 보여 주나요",
      body: [
        "지금 혼잡도: 서울시 실시간 도시데이터, 공항 출국장 대기, 놀이기구 대기시간처럼 기관이 공개한 실측 값을 5단계로 보여 줘요.",
        "시간대별 예측: 오늘·내일·주말 중 언제 가장 한산한지 시간 단위로 예측해요. 실측이 없는 곳은 요일·공휴일·날씨·관광공사 집중률로 계산한 추정이라고 화면에 표시해요.",
        "여행 정보: 가는 길, 운영 시간, 가까운 지하철역, 근처 명소와 맛집, 한산한 순서로 묶은 코스를 함께 보여 줘요.",
      ],
    },
    {
      h: "왜 만들었나요",
      body: [
        "같은 곳도 언제 가느냐에 따라 기다림이 몇 배씩 달라져요. 붐비는 시간을 피하면 여행이 훨씬 편해지니까, 흩어져 있는 공공데이터를 한 화면에 모아 누구나 쉽게 비교할 수 있게 만들었어요.",
        "한국어·영어·일본어·중국어(간체·번체)로 제공해 한국을 찾는 외국인 여행자도 같은 정보를 볼 수 있어요.",
      ],
    },
    {
      h: "데이터와 정확도",
      body: ["모든 숫자의 출처와 계산 방식, 한계를 공개하고, 예측이 실제와 얼마나 맞았는지 매시간 채점해 공개해요. 혼잡도는 참고 정보라 실제와 다를 수 있어요."],
    },
    {
      h: "운영자",
      body: [`${BUSINESS.serviceName}는 개인사업자 ${BUSINESS.company}(대표 ${BUSINESS.ceo}, 사업자등록번호 ${BUSINESS.bizNo})가 운영해요.`],
    },
  ],
  links: [
    ["/methodology", "데이터 출처·계산 방식"],
    ["/accuracy", "예측 정확도"],
    ["/pricing", "요금 안내"],
    ["/privacy", "개인정보처리방침"],
    ["/contact", "문의하기"],
  ],
};

const EN: Copy = {
  title: "About CrowdView",
  lead: "CrowdView shows how crowded Korea's theme parks, palaces, beaches, ski resorts, airports and festivals are right now, and when they will be quiet.",
  sections: [
    {
      h: "What you get",
      body: [
        "Crowd levels now: values measured and published by public agencies — Seoul real-time city data, airport departure waits, ride wait times — shown on a five-level scale.",
        "Hourly forecasts: when today, tomorrow or this weekend will be quietest. Places without live data are labeled as estimates based on day of week, holidays, weather and Korea Tourism Organization visitor forecasts.",
        "Trip info: directions, opening hours, nearest subway stations, nearby sights and food, and routes ordered to avoid crowds.",
      ],
    },
    {
      h: "Why we built it",
      body: [
        "The same place can mean a few minutes or a few hours of waiting depending on when you go. We bring scattered public data together on one screen so anyone can compare and pick a quieter time.",
        "CrowdView is available in Korean, English, Japanese and Chinese (Simplified and Traditional) for visitors to Korea.",
      ],
    },
    {
      h: "Data and accuracy",
      body: ["We publish every source, how we calculate, and our limitations, and we score our forecasts against actual values every hour. Crowd levels are for reference and may differ from reality."],
    },
    {
      h: "Operator",
      body: [`${BUSINESS.serviceName} is run by ${BUSINESS.company} (sole proprietor, business registration no. ${BUSINESS.bizNo}), Seoul, Korea.`],
    },
  ],
  links: [
    ["/methodology", "Data sources and methodology"],
    ["/accuracy", "Forecast accuracy"],
    ["/pricing", "Pricing"],
    ["/privacy", "Privacy policy"],
    ["/contact", "Contact us"],
  ],
};

const copyOf = (lang: Lang) => (lang === "ko" ? KO : EN);

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = (await params).lang as Lang;
  const c = copyOf(lang);
  return pageMeta({ lang, path: "/about", title: c.title, description: c.lead });
}

export default async function AboutPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = (await params).lang as Lang;
  const c = copyOf(lang);
  return (
    <main className="px-5 pt-6 pb-10 md:px-0 md:pt-10">
      <article className="max-w-3xl">
        <h1 className="text-2xl font-bold md:text-3xl">{c.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">{c.lead}</p>
        {c.sections.map((s) => (
          <section key={s.h} className="mt-8">
            <h2 className="text-lg font-bold">{s.h}</h2>
            {s.body.map((b) => (
              <p key={b} className="mt-2 text-sm leading-relaxed text-gray-700">
                {b}
              </p>
            ))}
          </section>
        ))}
        <nav className="mt-8 flex flex-wrap gap-2 text-sm font-semibold">
          {c.links.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-800">
              {label}
            </Link>
          ))}
        </nav>
      </article>
    </main>
  );
}
