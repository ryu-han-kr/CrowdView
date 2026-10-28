import type { CharacterName } from "@/lib/characters";

/** 기념일 날 홈 배경 효과 (계절·날씨 효과 대신) */
export type DayFx = "snow" | "confetti" | "moon";

export interface KrDay {
  id: string;
  /** 홈 띠에 쓰는 인사 (한국어 원문, 화면에서 t()로 번역) */
  msg: string;
  sub: string;
  /** 띠 왼쪽 큰 그림·캐릭터 머리 위 꾸밈 */
  emoji: string;
  deco: string;
  character: CharacterName;
  /** 띠 바탕 그라데이션 (왼쪽 → 오른쪽) */
  bg: [string, string];
  fx?: DayFx;
}

/** 음력 명절의 양력 날짜 (한국천문연구원 월력요항 기준, 명절 당일). 해마다 다시 확인해 덧붙인다 */
const LUNAR: Record<"seollal" | "chuseok", Record<number, string>> = {
  seollal: { 2026: "02-17", 2027: "02-07", 2028: "01-27", 2029: "02-13", 2030: "02-03" },
  chuseok: { 2026: "09-25", 2027: "09-15", 2028: "10-03", 2029: "09-22", 2030: "09-12" },
};

const DAYS: Record<string, Omit<KrDay, "id">> = {
  newyear: {
    msg: "새해 복 많이 받으세요!",
    sub: "올해도 한산한 곳으로 안내할게요",
    emoji: "🎉",
    deco: "🎊",
    character: "rabbit",
    bg: ["#fef3c7", "#fde68a"],
    fx: "confetti",
  },
  seollal: {
    msg: "설 연휴, 가족과 따뜻하게 보내세요",
    sub: "고궁·민속촌 설 행사와 귀성길 혼잡을 확인하세요",
    emoji: "🧧",
    deco: "🪁",
    character: "fox",
    bg: ["#fee2e2", "#fecaca"],
    fx: "confetti",
  },
  samiljeol: {
    msg: "3·1절, 그날의 함성을 기억해요",
    sub: "독립기념관·서대문형무소역사관도 둘러보세요",
    emoji: "🇰🇷",
    deco: "🇰🇷",
    character: "raccoon",
    bg: ["#e0e7ff", "#fee2e2"],
  },
  children: {
    msg: "어린이날, 마음껏 뛰어놀아요!",
    sub: "놀이공원·테마파크 혼잡을 미리 보고 가세요",
    emoji: "🎈",
    deco: "🎈",
    character: "hamster",
    bg: ["#dbeafe", "#fce7f3"],
    fx: "confetti",
  },
  liberation: {
    msg: "광복절, 빛을 되찾은 날",
    sub: "태극기 달고 의미 있는 하루 보내세요",
    emoji: "🇰🇷",
    deco: "🇰🇷",
    character: "raccoon",
    bg: ["#e0e7ff", "#fee2e2"],
  },
  chuseok: {
    msg: "풍성한 한가위 보내세요",
    sub: "고궁 한가위 행사와 연휴 혼잡을 미리 확인하세요",
    emoji: "🌕",
    deco: "🌾",
    character: "otter",
    bg: ["#fef9c3", "#fed7aa"],
    fx: "moon",
  },
  gaecheon: {
    msg: "개천절, 하늘이 열린 날",
    sub: "가을 하늘 아래 한산한 명소로 떠나 보세요",
    emoji: "🇰🇷",
    deco: "🇰🇷",
    character: "fox",
    bg: ["#e0f2fe", "#e0e7ff"],
  },
  hangeul: {
    msg: "한글날, 우리 글을 기려요",
    sub: "국립한글박물관·세종대왕 동상도 둘러보세요",
    emoji: "ㄱ",
    deco: "📜",
    character: "rabbit",
    bg: ["#ecfccb", "#e0f2fe"],
  },
  christmas: {
    msg: "메리 크리스마스!",
    sub: "트리·조명 명소, 붐비기 전에 다녀오세요",
    emoji: "🎄",
    deco: "🎅",
    character: "hamster",
    bg: ["#dcfce7", "#fee2e2"],
    fx: "snow",
  },
};

const md = (date: string) => date.slice(5);
const shift = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** 그날(KST YYYY-MM-DD)의 기념일. 명절은 연휴 사흘(전날·당일·다음날), 크리스마스는 12/20~25, 새해는 12/31~1/2 */
export function krDayOn(date: string): KrDay | undefined {
  const y = Number(date.slice(0, 4));
  const m = md(date);
  const pick = (id: string): KrDay => ({ id, ...DAYS[id] });
  for (const id of ["seollal", "chuseok"] as const) {
    const day = LUNAR[id][y] && `${y}-${LUNAR[id][y]}`;
    if (day && date >= shift(day, -1) && date <= shift(day, 1)) return pick(id);
  }
  if (m === "12-31" || m <= "01-02") return pick("newyear");
  if (m === "03-01") return pick("samiljeol");
  if (m >= "05-03" && m <= "05-05") return pick("children");
  if (m === "08-15") return pick("liberation");
  if (m === "10-03") return pick("gaecheon");
  if (m === "10-09") return pick("hangeul");
  if (m >= "12-20" && m <= "12-25") return pick("christmas");
  return undefined;
}

/** 미리 보기용 (?day=christmas) */
export function krDayById(id: string): KrDay | undefined {
  return DAYS[id] ? { id, ...DAYS[id] } : undefined;
}
