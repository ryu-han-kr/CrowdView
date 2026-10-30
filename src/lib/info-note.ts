// 관광공사 운영 시간·휴무 글을 '본문'과 '※ 안내'로 나눈다 (지인 QA 10/30: '연중무휴※ 기상상황에 따라 변동'이 한 단어처럼 붙어 보였다)
// 번역된 글에도 그대로 쓴다 (※ 기호와 숫자는 번역기를 지나도 남는다)

const hourOf = (h: string, m: string) => Number(h) + Number(m) / 60;

/**
 * 본문 + ※ 안내 목록. 본문이 '- 10:00~18:00'처럼 위에 이미 보이는 오늘 운영 시간과 같기만 하면 비운다
 * hours: 화면 위 줄에 보이는 [여는 시각, 닫는 시각] (시 단위, 9.5 = 9:30)
 */
export function splitInfoNote(text: string, hours?: [number, number]): { main: string; notes: string[] } {
  const [head, ...rest] = text.split("※");
  let main = head.trim();
  const m = main.replace(/^[-·•]\s*/, "").match(/^(\d{1,2}):(\d{2})\s*[~∼-]\s*(\d{1,2}):(\d{2})$/);
  if (m && hours && hourOf(m[1], m[2]) === hours[0] && hourOf(m[3], m[4]) === hours[1]) main = "";
  const notes = rest.map((x) => x.trim()).filter(Boolean).map((x) => `※ ${x}`);
  return { main, notes };
}
