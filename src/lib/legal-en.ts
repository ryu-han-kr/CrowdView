// 이용약관·개인정보처리방침·환불정책 영어 번역본 (외국어 화면, Paddle 사이트 심사용 10/28). 한국어 원문(lib/legal)이 기준
import { BUSINESS, LEGAL_EFFECTIVE_DATE, PLANS, PRIVACY_EFFECTIVE_DATE } from "./business";
import { PLANS_EFFECTIVE_DATE, type LegalDoc } from "./legal";

const B = BUSINESS;
const krw = (n: number) => `KRW ${n.toLocaleString("en-US")}`;
const seller = `${B.company} (sole proprietor, business registration no. ${B.bizNo}, mail-order registration ${B.mailOrderNo}), ${B.address}, Republic of Korea`;

export const TERMS_EN: LegalDoc = {
  title: "Terms of Service",
  lang: "en",
  effectiveDate: PLANS_EFFECTIVE_DATE,
  sections: [
    {
      title: "1. About these terms",
      body: [
        `These terms govern your use of ${B.serviceName} (${B.url}, including the mobile app, the "Service"), operated by ${seller} ("we", "us").`,
      ],
    },
    {
      title: "2. Definitions",
      body: [
        `- "Users" means members and non-members who use the Service.`,
        `- "Members" means users who sign in with a Kakao, Naver or Google account.`,
        `- "Paid Services" means ${PLANS.plus.name}, ${PLANS.pro.name} and the Travel Pass.`,
        `- "Crowd information" means crowd levels, estimated headcounts and forecasts for places, produced from public data, telecom data and our forecasting models.`,
      ],
    },
    {
      title: "3. Changes to these terms",
      body: [
        "We post these terms on the Service. We may change them within the limits of applicable law and will announce changes and their effective date at least 7 days in advance (30 days if the change is unfavorable to you).",
        "If you do not agree to the changed terms, you may stop using the Service and delete your account.",
      ],
    },
    {
      title: "4. The Service",
      body: [
        "- Live crowd levels and hourly forecasts for airports, theme parks, attractions and festivals (free)",
        "- Festival schedules, weather, air quality, parking and other visit information (free)",
        `- Paid Services: ad-free browsing, live measured crowd counts (SK Telecom data), a 1-year crowd calendar, full quiet-route itineraries and crowd alerts`,
        "We aim to run the Service 24/7, but parts of it may be unavailable due to maintenance, outages or issues at our data providers.",
      ],
    },
    {
      title: "5. Nature of crowd information",
      body: [
        "Crowd information is for reference only and may differ from actual conditions. Data from providers can be delayed, wrong or interrupted.",
        "Do not rely solely on crowd information for safety decisions; always follow on-site guidance and instructions from authorities.",
      ],
    },
    {
      title: "6. Paid Services in Korea (Plus · Pro)",
      body: [
        `${PLANS.plus.name}: ${krw(PLANS.plus.priceKrw)} per month; ${PLANS.pro.name}: ${krw(PLANS.pro.priceKrw)} per month (VAT included). You can choose a one-time 1-month pass or monthly auto-renewal.`,
        `Live crowd count checks: Plus ${PLANS.plus.liveDaily}/day and ${PLANS.plus.liveMonthly}/month, Pro ${PLANS.pro.liveDaily}/day and ${PLANS.pro.liveMonthly}/month. A place another member checked within the last 10 minutes does not count.`,
        "Korean card payments are processed by Toss Payments. We never store card numbers. Monthly auto-renewal can be cancelled at any time in My page and stays active until the end of the paid period.",
      ],
    },
    {
      title: "7. Travel Pass (international payments)",
      body: [
        "International visitors can buy a Travel Pass: 7-day pass USD 3.99 or 30-day pass USD 6.99 (prices may be shown in your local currency). It is a one-time payment with no automatic renewal and unlocks Pro features for the pass period.",
        "Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our Travel Pass orders. Paddle provides all customer service inquiries and handles returns. Paddle's Buyer Terms apply to your purchase.",
      ],
    },
    {
      title: "8. Access codes",
      body: [
        "We may issue access codes for events, trials or partnerships. Entering a code in My page grants the Paid Service tier and period specified for that code. Codes cannot be exchanged for cash or refunded, and each member can use a given code only once.",
      ],
    },
    {
      title: "9. Accounts",
      body: [
        "You sign up with a Kakao, Naver or Google account. Children under 14 cannot sign up. You can delete your account at any time in My page; deleting it also cancels auto-renewal.",
      ],
    },
    {
      title: "10. Acceptable use",
      body: [
        "- Do not scrape the Service at scale or put excessive load on our servers.",
        "- Do not redistribute Service information commercially without our consent.",
        "- Do not use another person's account or payment method.",
        "- Do not act against the law or public order.",
      ],
    },
    {
      title: "11. Liability",
      body: [
        "We are not liable for damages caused by events beyond our control (natural disasters, data provider outages, etc.).",
        "If you cannot use a Paid Service for 4 or more consecutive hours due to our fault, we extend your period or refund the corresponding amount.",
      ],
    },
    {
      title: "12. Governing law and contact",
      body: [`These terms are governed by the laws of the Republic of Korea.`, `Contact: ${B.email} / ${B.phone}`],
    },
    { title: "Effective date", body: [`These terms are effective from ${PLANS_EFFECTIVE_DATE} (first published ${LEGAL_EFFECTIVE_DATE}). This is an English translation; the Korean original prevails.`] },
  ],
};

export const REFUND_EN: LegalDoc = {
  title: "Refund Policy",
  lang: "en",
  effectiveDate: PLANS_EFFECTIVE_DATE,
  sections: [
    {
      title: "1. Within 7 days of payment",
      body: ["If you have not used any paid feature within 7 days of payment, you get a full refund. If you have already used paid features, we refund the unused days as described below."],
    },
    {
      title: "2. Cancelling during use (Plus · Pro)",
      body: [
        "Monthly auto-renewal can be cancelled at any time in My page; you keep access until the end of the paid period.",
        "For a refund of the remaining period, contact us. We refund the amount paid minus the days used (amount ÷ 30 × days used) and a 10% cancellation fee.",
      ],
    },
    {
      title: "3. Travel Pass (international payments via Paddle)",
      body: [
        "Travel Pass orders are sold by Paddle.com as Merchant of Record, and Paddle handles refunds. If you have not used the pass within 7 days of purchase, you can get a full refund.",
        "Request a refund via the link in your Paddle receipt email (or at paddle.net), or contact us and we will ask Paddle to refund you. Refunds are returned to your original payment method.",
      ],
    },
    {
      title: "4. Service outages",
      body: ["If you cannot use a Paid Service for 4 or more consecutive hours due to our fault, we extend your period or refund the corresponding amount, with no cancellation fee."],
    },
    {
      title: "5. Access codes",
      body: ["Periods granted by access codes are free and are not refundable."],
    },
    {
      title: "6. How refunds are paid and contact",
      body: [
        "Refunds go back to the original payment method. Card refunds may take 3–7 business days depending on your card issuer. We process requests within 3 business days.",
        `Contact: ${B.email} / ${B.phone} — please include your sign-in account (Kakao, Naver or Google) and the payment date.`,
      ],
    },
    { title: "Effective date", body: [`Effective from ${PLANS_EFFECTIVE_DATE}. This is an English translation; the Korean original prevails.`] },
  ],
};

export const PRIVACY_EN: LegalDoc = {
  title: "Privacy Policy",
  lang: "en",
  effectiveDate: PRIVACY_EFFECTIVE_DATE,
  sections: [
    {
      title: "1. What we collect and why",
      body: [
        `${B.company} processes only the minimum personal information needed to run ${B.serviceName}.`,
        "- Without signing in: we collect no personal information. Saved places and language are stored only on your device.",
        "- Members (Kakao, Naver or Google sign-in): account identifier, email, name (nickname), profile photo — to identify you, sync saved places and answer inquiries.",
        "- Payments: order number, amount, date, status and (for auto-renewal) a billing key — for payments, refunds and fraud prevention. Card numbers are handled by the payment provider; we never store them.",
        "- Crowd alerts: places to watch and your web-push subscription — to send alerts.",
        "- Automatically generated: IP address, browser type, access time, error logs — for stability and abuse prevention.",
      ],
    },
    {
      title: "2. Retention",
      body: [
        "Member information is kept until you delete your account, except where law requires longer retention:",
        "- Contract, cancellation, payment records: 5 years (Korean E-Commerce Act)",
        "- Complaint and dispute records: 3 years",
        "- Access logs: 3 months",
      ],
    },
    {
      title: "3. Processors and international transfers",
      body: [
        "- Toss Payments (Korea): Korean card payments",
        "- Paddle.com Market Limited (United Kingdom): sale, payment, tax and refunds of the Travel Pass — only when you buy a Travel Pass (email, country, payment details and member identifier)",
        "- Vercel Inc. (USA): hosting and access logs",
        "- Neon, Upstash: database and cache storage",
        "- Kakao, Naver, Google: social sign-in",
        "- Functional Software, Inc. / Sentry (USA): error analysis (text, inputs and images are masked), deleted after 90 days",
        "If you do not want your data transferred abroad, you can use the Service without signing in or delete your account.",
      ],
    },
    {
      title: "4. Cookies and device storage",
      body: [
        "- cv-lang cookie: remembers your language (1 year). Sign-in cookie: keeps you signed in.",
        "- Browser storage: saved places and interests stay on your device.",
        "- Usage statistics: a random number in browser storage to count visits; it cannot identify you.",
        "- Ads (Google AdSense): Google may use cookies to show ads to free users. You can turn off personalized ads at adssettings.google.com.",
      ],
    },
    {
      title: "5. Your rights",
      body: ["You can view, correct or delete your personal information, or ask us to stop processing it, at any time in My page or by contacting us. We do not collect information from children under 14."],
    },
    {
      title: "6. Security and deletion",
      body: [
        "All traffic is encrypted with HTTPS. We use social sign-in only and never receive passwords. Database access is limited and keys are kept in server environment variables.",
        "Information past its retention period is deleted irreversibly without delay.",
      ],
    },
    {
      title: "7. Privacy officer and contact",
      body: [`Privacy officer: ${B.privacyOfficer} — ${B.email} / ${B.phone}`],
    },
    { title: "Effective date", body: [`Effective from ${PRIVACY_EFFECTIVE_DATE}. This is an English translation; the Korean original prevails.`] },
  ],
};
