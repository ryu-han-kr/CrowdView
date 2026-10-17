// 지하철 노선망 만들기 (sync.mjs 가 부른다) → src/data/seoul/subway.json
// - 1~8호선: 서울시 '역간 거리 및 소요시간'(StationDstncReqreTimeHm)의 실제 역간 시간
// - 그 밖의 노선(9호선·신분당선·공항철도·경의중앙선 등): 역 좌표(subwayStationMaster)만 있어서
//   같은 노선에서 가장 가까운 역 2곳과 잇고, 거리로 시간을 어림한다 (평균 시속 38km, 공항철도 60km + 정차 30초)
// 결과: { l: 노선 이름[], s: [역 이름, 위도, 경도][], e: [역 a, 역 b, 분, km, 노선][] }

// 역간 시간표에 옛 이름으로 남은 역
const RENAMED = { 당고개: "불암산" };
const norm = (s) => {
  const n = String(s).replace(/\(.*?\)/g, "").replace(/\s/g, "").replace(/(.)역$/, "$1");
  return RENAMED[n] ?? n;
};

/** 운영 노선 이름으로 묶는다 (경부선·경인선 = 1호선 등). 같은 이름끼리는 갈아타지 않는다 */
export function lineLabel(route) {
  const r = String(route).replace(/\(.*?\)/g, "").trim();
  if (/^[1-9]호선$/.test(r)) return r;
  const map = {
    경부선: "1호선", 경원선: "1호선", 경인선: "1호선", 장항선: "1호선",
    과천선: "4호선", 안산선: "4호선", 진접선: "4호선", 일산선: "3호선", 별내선: "8호선",
    중앙선: "경의중앙선", 경의중앙선: "경의중앙선", 분당선: "수인분당선", 수인선: "수인분당선",
    공항철도1호선: "공항철도", 의정부선: "의정부경전철", 에버라인선: "에버라인",
  };
  return map[r] ?? r;
}

const MEASURED = new Set(["1호선", "2호선", "3호선", "4호선", "5호선", "6호선", "7호선", "8호선"]);
// 1~8호선 지선: 표에서 앞 줄이 아니라 이 역에서 갈라진다
const BRANCH_FROM = { "2:용답": "성수", "2:도림천": "신도림", "5:둔촌동": "강동" };

function km(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(toRad(b[0] - a[0]) / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(toRad(b[1] - a[1]) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const hm = (s) => {
  const [m, sec] = String(s).split(":").map(Number);
  return m + (sec || 0) / 60;
};

export function buildSubway(masterRows, distRows) {
  const lines = [];
  const lineIdx = (l) => (lines.includes(l) ? lines.indexOf(l) : lines.push(l) - 1);
  const stations = []; // [name, lat, lng]
  // 이름이 같아도 1.5km 넘게 떨어지면 다른 역 (예: 5호선 양평 ↔ 경의중앙선 양평)
  const stationIdx = (name, lat, lng) => {
    const i = stations.findIndex((s) => s[0] === name && km([s[1], s[2]], [lat, lng]) < 1.5);
    return i >= 0 ? i : stations.push([name, Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5]) - 1;
  };
  const master = masterRows
    .map((r) => ({ name: norm(r.BLDN_NM), route: String(r.ROUTE), lat: Number(r.LAT), lng: Number(r.LOT) }))
    .filter((r) => r.name && r.lat > 33 && r.lng > 124);
  const edges = new Map();
  const addEdge = (a, b, min, dist, line) => {
    if (a === b) return;
    const key = a < b ? `${a}-${b}-${line}` : `${b}-${a}-${line}`;
    if (!edges.has(key)) edges.set(key, [Math.min(a, b), Math.max(a, b), Math.round(min * 10) / 10, Math.round(dist * 10) / 10, line]);
  };

  // 1) 1~8호선: 실제 역간 시간
  const missing = new Set();
  const byLine = new Map();
  for (const r of distRows) {
    const l = `${r.SBWY_ROUT_LN}호선`;
    if (!byLine.has(l)) byLine.set(l, []);
    byLine.get(l).push(r);
  }
  for (const [l, rows] of byLine) {
    const li = lineIdx(l);
    const find = (name) => {
      const m = master.find((x) => x.name === name && x.route === l) ?? master.find((x) => x.name === name);
      if (!m) missing.add(`${l} ${name}`);
      return m && stationIdx(name, m.lat, m.lng);
    };
    let prev;
    for (const r of rows) {
      const name = norm(r.SBWY_STNS_NM);
      const cur = find(name);
      const from = BRANCH_FROM[`${r.SBWY_ROUT_LN}:${name}`];
      const p = from ? find(from) : prev;
      if (cur !== undefined && p !== undefined && hm(r.HM) > 0) addEdge(p, cur, hm(r.HM) + 0.5, Number(r.DIST_KM) || 0, li);
      prev = cur;
    }
  }

  // 2) 나머지 노선: 같은 노선에서 가장 가까운 역 2곳과 잇는다
  const groups = new Map();
  for (const m of master) {
    // GTX-A는 서울역~삼성 구간이 아직 다니지 않고 요금도 달라 관광 코스에서는 뺀다
    if (MEASURED.has(m.route) || m.route === "수도권 광역급행철도") continue;
    const key = m.route.replace(/\(.*?\)/g, "").trim(); // 9호선 + 9호선(연장)은 한 노선
    if (!groups.has(key)) groups.set(key, []);
    if (!groups.get(key).some((x) => x.name === m.name)) groups.get(key).push(m);
  }
  for (const [route, list] of groups) {
    const label = lineLabel(route);
    const li = lineIdx(label);
    // 공항철도는 역 사이가 멀고(영종도 구간) 빨리 달린다
    const maxKm = label === "공항철도" ? 12 : 4.5;
    const kmh = label === "공항철도" ? 60 : 38;
    const d = (a, b) => km([a.lat, a.lng], [b.lat, b.lng]);
    // 끊긴 조각 찾기용 (같은 노선 안에서 서로 이어졌는지)
    const root = list.map((_, i) => i);
    const find = (i) => (root[i] === i ? i : (root[i] = find(root[i])));
    const link = (i, j) => {
      const dist = d(list[i], list[j]) * 1.15;
      addEdge(stationIdx(list[i].name, list[i].lat, list[i].lng), stationIdx(list[j].name, list[j].lat, list[j].lng), (dist / kmh) * 60 + 0.5, dist, li);
      root[find(i)] = find(j);
    };
    list.forEach((a, i) => {
      list
        .map((b, j) => ({ j, d: d(a, b) }))
        .filter((x) => x.j !== i && x.d <= maxKm)
        .sort((x, y) => x.d - y.d)
        .slice(0, 2)
        .forEach((x) => link(i, x.j));
    });
    // 역 사이가 먼 구간(예: 청라국제도시~영종)은 가장 가까운 2곳에 안 들어 노선이 끊긴다 → 조각끼리 가장 가까운 역을 잇는다
    for (;;) {
      let best;
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++)
          if (find(i) !== find(j) && d(list[i], list[j]) <= maxKm && (!best || d(list[i], list[j]) < best.d)) best = { i, j, d: d(list[i], list[j]) };
      if (!best) break;
      link(best.i, best.j);
    }
  }
  return { data: { l: lines, s: stations, e: [...edges.values()] }, missing: [...missing] };
}
