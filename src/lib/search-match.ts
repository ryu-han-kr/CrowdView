// 검색어 맞추기 (10/31 경수님: '남산 타워'를 치면 '남산 N서울타워'가 안 나온다 → 연관된 말이면 나오게).
// 띄어쓰기·대소문자·기호를 무시하고, 낱말마다 따로 찾고, 글자 순서만 맞아도(남산타워 → 남산서울타워) 찾고, 초성(ㄴㅅㅌㅇ)도 된다.
// 점수가 높을수록 위에: 그대로 들어 있음 > 낱말 모두 들어 있음 > 글자 순서만 맞음

/** 흔히 부르는 다른 이름 → 실제 이름에 들어 있는 말 */
const ALIASES: [RegExp, string][] = [
  [/^(남산|엔|n)?타워$/, "서울타워"],
  [/^롯데타워$/, "롯데월드타워"],
  [/^(동대문)?ddp$/, "동대문디자인플라자"],
  [/^민속촌$/, "한국민속촌"],
  [/^캐비$/, "캐리비안베이"],
  [/^롯데월드어드벤처$/, "롯데월드"],
  [/^(인천)?공항$/, "인천공항"],
  [/^한강$/, "한강공원"],
];

const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";

/** 비교용: 소문자, 띄어쓰기·기호 없애기 */
export const squash = (s: string) => s.toLowerCase().replace(/[\s·・,.\-_/()[\]'"‘’“”!?&+:]/g, "");

/** 한글 음절 → 초성 (그 밖의 글자는 그대로) */
const choseong = (s: string) =>
  [...s].map((c) => {
    const code = c.charCodeAt(0) - 0xac00;
    return code >= 0 && code < 11172 ? CHO[Math.floor(code / 588)] : c;
  }).join("");

/** 글자가 순서대로 다 들어 있나 (사이에 다른 글자가 끼어도 된다) */
function inOrder(needle: string, hay: string) {
  let i = 0;
  for (const c of hay) if (c === needle[i] && ++i === needle.length) return true;
  return false;
}

/** 검색어가 이 글자들에 얼마나 맞는지 (0이면 안 맞음). 검색어가 비면 1 */
export function matchScore(query: string, fields: (string | undefined)[]): number {
  const raw = query.trim().toLowerCase();
  if (!raw) return 1;
  const q = squash(raw);
  if (!q) return 1;
  const hays = fields.filter((s): s is string => !!s).map(squash);
  const all = hays.join(" ");
  let best = 0;
  for (const h of hays) {
    if (h === q) return 100;
    if (h.startsWith(q)) best = Math.max(best, 90);
    else if (h.includes(q)) best = Math.max(best, 80);
  }
  if (best) return best;
  const alias = ALIASES.find(([re]) => re.test(q))?.[1];
  if (alias && all.includes(squash(alias))) return 75;
  // 낱말마다 (남산 + 타워)
  const words = raw.split(/\s+/).map(squash).filter(Boolean);
  if (words.length > 1 && words.every((w) => all.includes(w))) return 70;
  // 초성만 쳤을 때 (ㄴㅅㅌㅇ)
  if (/^[ㄱ-ㅎ]+$/.test(q)) return hays.some((h) => choseong(h).includes(q)) ? 60 : 0;
  // 글자 순서만 맞음 (남산타워 → 남산서울타워). 짧은 검색어는 아무 데나 걸려서 3글자부터, 한 이름 안에서만
  if ([...q].length >= 3 && hays.some((h) => inOrder(q, h))) return 50;
  return 0;
}
