// 역별 혼잡 모양 (sync.mjs 가 부른다) → src/data/seoul/station-profile.json
// 코스 추천의 내일·주말 예측에 쓴다 (서울시 12시간 예측이 없는 시간대).
// - 시간대: 지난달 역·시간대별 승하차 (CardSubwayTime, 월 단위)
// - 요일: 최근 4주 역별 일별 승하차 (CardSubwayStatsNew, 3~4일 늦게 올라온다)
// 결과: { month, days, s: { 역 이름(노선 합산): { h: 시간대 비중 24개(‰), d: 요일 배수 7개(%, 일~토) } } }

const ymd = (d) => d.toISOString().slice(0, 10).replaceAll("-", "");

export async function buildStationProfile(fetchAll, normStation) {
  const now = new Date(Date.now() + 9 * 3600_000);
  const hourly = new Map();
  let month;
  for (let back = 1; back <= 3 && !month; back++) {
    const ym = ymd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1))).slice(0, 6);
    const rows = await fetchAll("CardSubwayTime", ym).catch(() => []);
    if (!rows.length) continue;
    month = ym;
    for (const r of rows) {
      const name = normStation(r.STTN);
      const h = hourly.get(name) ?? new Array(24).fill(0);
      for (let i = 0; i < 24; i++) h[i] += Number(r[`HR_${i}_GET_ON_NOPE`] ?? 0) + Number(r[`HR_${i}_GET_OFF_NOPE`] ?? 0);
      hourly.set(name, h);
    }
  }

  const daily = new Map();
  const dayCount = new Array(7).fill(0); // 요일별로 모은 날 수
  let days = 0;
  for (let back = 3; back <= 40 && days < 28; back++) {
    const d = new Date(now.getTime() - back * 86400_000);
    const rows = await fetchAll("CardSubwayStatsNew", ymd(d)).catch(() => []);
    if (!rows.length) continue;
    days++;
    const dow = d.getUTCDay();
    dayCount[dow]++;
    for (const r of rows) {
      const name = normStation(r.SBWY_STNS_NM);
      // 같은 역의 여러 노선은 합산
      const sum = daily.get(name) ?? new Array(7).fill(0);
      sum[dow] += Number(r.GTON_TNOPE) + Number(r.GTOFF_TNOPE);
      daily.set(name, sum);
    }
  }

  const s = {};
  for (const [name, h] of hourly) {
    const total = h.reduce((a, b) => a + b, 0);
    const sum = daily.get(name);
    if (total < 1000 || !sum) continue;
    const avg = sum.map((v, i) => (dayCount[i] ? v / dayCount[i] : 0));
    const seen = avg.filter(Boolean);
    const mean = seen.reduce((a, b) => a + b, 0) / seen.length;
    if (!mean) continue;
    s[name] = { h: h.map((v) => Math.round((v / total) * 1000)), d: avg.map((v) => Math.round((v ? v / mean : 1) * 100)) };
  }
  return { month, days, s };
}
