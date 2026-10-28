/** 홈 순서를 계절에 맞춘다 (경수님 10/28: 겨울엔 스키장, 여름엔 워터파크가 위로, 봄·가을은 꽃·단풍 명소·축제) */
export type Season = "ski" | "spring" | "summer" | "autumn";

/** 10/20~2월은 스키 시즌(개장 준비 소식부터), 3~5월 봄, 6~8월 여름, 9월~10/19 가을 */
export function seasonOf(date: string): Season {
  const md = date.slice(5);
  if (md >= "10-20" || md < "03-01") return "ski";
  if (md < "06-01") return "spring";
  if (md < "09-01") return "summer";
  return "autumn";
}

// 앞으로 올릴 것·뒤로 내릴 것 (분류 id·주제 id)
const UP: Record<Season, string[]> = {
  ski: ["ski"],
  spring: ["festival", "landmark", "flower"],
  summer: ["waterpark"],
  autumn: ["landmark", "festival", "autumn"],
};
const DOWN: Record<Season, string[]> = { ski: ["waterpark"], spring: ["ski"], summer: ["ski"], autumn: ["ski", "waterpark"] };

/** 계절 가중치: 올릴 것 -1, 내릴 것 +1 */
export function seasonWeight(season: Season, key: string): number {
  return UP[season].includes(key) ? -1 - (UP[season].length - UP[season].indexOf(key)) / 10 : DOWN[season].includes(key) ? 1 : 0;
}

/** 순서는 그대로 두고 계절 가중치만으로 다시 줄 세운다. 앞의 pin개는 자리 고정 */
export function seasonSort<T>(items: T[], keyOf: (x: T) => string, season: Season, pin = 0): T[] {
  const head = items.slice(0, pin);
  const rest = items
    .slice(pin)
    .map((x, i) => ({ x, i, w: seasonWeight(season, keyOf(x)) }))
    .sort((a, b) => a.w - b.w || a.i - b.i)
    .map((r) => r.x);
  return [...head, ...rest];
}
