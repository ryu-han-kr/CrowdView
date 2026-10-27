// 쿠팡 파트너스 링크 (10/27, 회원 AF2411021). 파트너스 '간편 링크 만들기'로 쿠팡 검색 결과(장소 이름 + 입장권)를 줄인 주소.
// Open API 키는 최종 승인 뒤에만 나와서(실적 필요) 그 전엔 이렇게 장소별로 손으로 만든 링크를 쓴다. 키가 나오면 lib/coupang 으로 자동 생성
// 키는 places.ts 의 장소 이름(한국어)
export const COUPANG_LINKS: Record<string, string> = {
  에버랜드: "https://link.coupang.com/a/ibzgBkkFgG",
  "롯데월드 어드벤처": "https://link.coupang.com/a/ibzjYie3fo",
  서울랜드: "https://link.coupang.com/a/ibzlbEONk4",
  한국민속촌: "https://link.coupang.com/a/ibzlsRrz7Q",
  서울대공원: "https://link.coupang.com/a/ibzuA1L24W",
  "롯데월드 아쿠아리움": "https://link.coupang.com/a/ibzlJ8Zj9o",
  "아쿠아플라넷 일산": "https://link.coupang.com/a/ibznBzMKJ2",
  "아쿠아플라넷 광교": "https://link.coupang.com/a/ibznSMrM7g",
  "아쿠아플라넷 제주": "https://link.coupang.com/a/ibzn9WV1gq",
  "아쿠아플라넷 여수": "https://link.coupang.com/a/ibzoq3vbe8",
  "씨라이프 부산아쿠아리움": "https://link.coupang.com/a/ibzoHzx8we",
  경주월드: "https://link.coupang.com/a/ibzoYNo5QW",
  "레고랜드 코리아": "https://link.coupang.com/a/ibzqoC8wmG",
  이월드: "https://link.coupang.com/a/ibzqFFDwuO",
  "롯데월드 어드벤처 부산": "https://link.coupang.com/a/ibzqWKYvVA",
  대전오월드: "https://link.coupang.com/a/ibzrdPGME0",
  광주패밀리랜드: "https://link.coupang.com/a/ibzruLIxeS",
  "캐리비안 베이": "https://link.coupang.com/a/ibzrLGymRg",
  "비발디파크 오션월드": "https://link.coupang.com/a/ibztewp4b6",
  롯데워터파크: "https://link.coupang.com/a/ibztvpgHT2",
  "설악 워터피아": "https://link.coupang.com/a/ibztMfT40G",
  "경주월드 캘리포니아비치": "https://link.coupang.com/a/ibzt23Utrx",
  "스플라스 리솜": "https://link.coupang.com/a/ibzuj83DLU",
};

/** 쿠팡 파트너스 필수 고지 문구 (파트너스 이용약관: 링크 근처에 그대로) */
export const COUPANG_NOTICE = "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";
