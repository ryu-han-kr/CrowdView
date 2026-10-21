// 보관 자료(lib/archive) 하루 요약 — 순수 계산. scripts/archive/read.ts 가 R2에서 받은 NDJSON 줄을 넣으면
// 장소별·서울 지역별 평균·최대 점수(최대가 난 시각)와 사람 수를 돌려준다. 분석의 시작점이라 Redis·네트워크 의존 없음.
// 장소 평균은 문 연 스냅샷만으로 낸다 (문 닫은 시간의 0점이 평균을 끌어내리지 않게). 사람 수는 값이 있는 줄만 센다

export interface ArchivePlaceLine {
  kind: "place";
  at: string;
  placeId: string;
  score: number;
  open?: boolean;
  headcount?: number;
  avgWaitMin?: number;
  source?: string;
}
export interface ArchiveSeoulLine {
  kind: "seoul";
  at: string;
  code: string;
  area: string;
  score: number;
  min: number;
  max: number;
  level?: string;
  time?: string;
}
export type ArchiveLine = ArchivePlaceLine | ArchiveSeoulLine;

export interface ArchiveRow {
  id: string;
  label: string;
  /** 스냅샷 수 (장소는 문 연 것만 센 값도) */
  n: number;
  openN?: number;
  avg: number;
  max: number;
  /** 최대가 난 시각 (KST HH:mm) */
  maxAt: string;
  /** 사람 수: 장소는 headcount, 서울은 서울시 범위의 가운데 값 */
  people?: { avg: number; max: number };
}

export interface ArchiveSummary {
  /** 스냅샷(객체) 수 */
  snapshots: number;
  from?: string;
  to?: string;
  places: ArchiveRow[];
  seoul: ArchiveRow[];
}

/** NDJSON 본문 → 줄 객체. 빈 줄·깨진 줄은 버린다 */
export function parseArchiveLines(text: string): ArchiveLine[] {
  const out: ArchiveLine[] = [];
  for (const raw of text.split("\n")) {
    const s = raw.trim();
    if (!s) continue;
    try {
      const j = JSON.parse(s) as Partial<ArchiveLine>;
      if ((j.kind === "place" || j.kind === "seoul") && typeof j.at === "string" && typeof j.score === "number") out.push(j as ArchiveLine);
    } catch {
      // 깨진 줄은 건너뛴다
    }
  }
  return out;
}

const kstHm = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(11, 16);
const round1 = (x: number) => Math.round(x * 10) / 10;

interface Acc {
  id: string;
  label: string;
  n: number;
  openN: number;
  sum: number;
  sumOpen: number;
  max: number;
  maxAt: string;
  peopleN: number;
  peopleSum: number;
  peopleMax: number;
}
const acc = (id: string, label: string): Acc => ({
  id,
  label,
  n: 0,
  openN: 0,
  sum: 0,
  sumOpen: 0,
  max: -1,
  maxAt: "",
  peopleN: 0,
  peopleSum: 0,
  peopleMax: 0,
});

function add(a: Acc, score: number, at: string, open: boolean, people?: number) {
  a.n++;
  a.sum += score;
  if (open) {
    a.openN++;
    a.sumOpen += score;
  }
  if (score > a.max) {
    a.max = score;
    a.maxAt = kstHm(at);
  }
  if (typeof people === "number" && Number.isFinite(people)) {
    a.peopleN++;
    a.peopleSum += people;
    if (people > a.peopleMax) a.peopleMax = people;
  }
}

function row(a: Acc, withOpen: boolean): ArchiveRow {
  const avg = withOpen && a.openN ? a.sumOpen / a.openN : a.sum / a.n;
  return {
    id: a.id,
    label: a.label,
    n: a.n,
    ...(withOpen ? { openN: a.openN } : {}),
    avg: round1(avg),
    max: a.max,
    maxAt: a.maxAt,
    ...(a.peopleN ? { people: { avg: Math.round(a.peopleSum / a.peopleN), max: a.peopleMax } } : {}),
  };
}

/** 하루치 줄 → 요약. 정렬은 최대 점수 내림차순 */
export function summarizeArchive(lines: ArchiveLine[]): ArchiveSummary {
  const places = new Map<string, Acc>();
  const seoul = new Map<string, Acc>();
  const ats = new Set<string>();
  for (const l of lines) {
    ats.add(l.at);
    if (l.kind === "place") {
      const a = places.get(l.placeId) ?? acc(l.placeId, l.placeId);
      add(a, l.score, l.at, l.open !== false, l.headcount);
      places.set(l.placeId, a);
    } else {
      const a = seoul.get(l.code) ?? acc(l.code, l.area);
      const mid = typeof l.min === "number" && typeof l.max === "number" ? (l.min + l.max) / 2 : undefined;
      add(a, l.score, l.at, true, mid);
      seoul.set(l.code, a);
    }
  }
  const sorted = [...ats].sort();
  const byMax = (x: ArchiveRow, y: ArchiveRow) => y.max - x.max || x.id.localeCompare(y.id);
  return {
    snapshots: sorted.length,
    ...(sorted.length ? { from: sorted[0], to: sorted[sorted.length - 1] } : {}),
    places: [...places.values()].map((a) => row(a, true)).sort(byMax),
    seoul: [...seoul.values()].map((a) => row(a, false)).sort(byMax),
  };
}

/** 터미널용 표 (고정폭). 윗줄 n개만 */
export function formatSummaryTable(rows: ArchiveRow[], limit = 20): string {
  const head = ["이름", "스냅샷", "평균", "최대", "최대 시각", "사람 평균", "사람 최대"];
  const body = rows
    .slice(0, limit)
    .map((r) => [
      r.label === r.id ? r.id : `${r.label} (${r.id})`,
      r.openN !== undefined ? `${r.openN}/${r.n}` : String(r.n),
      String(r.avg),
      String(r.max),
      r.maxAt,
      r.people ? r.people.avg.toLocaleString("en-US") : "-",
      r.people ? r.people.max.toLocaleString("en-US") : "-",
    ]);
  const widths = head.map((h, i) => Math.max(width(h), ...body.map((b) => width(b[i]))));
  const line = (cells: string[]) => cells.map((c, i) => pad(c, widths[i], i > 0)).join("  ");
  return [line(head), ...body.map(line)].join("\n");
}

// 한글은 터미널에서 두 칸을 차지한다
const width = (s: string) => [...s].reduce((w, ch) => w + (/[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(ch) ? 2 : 1), 0);
const pad = (s: string, w: number, right: boolean) => {
  const gap = " ".repeat(Math.max(0, w - width(s)));
  return right ? gap + s : s + gap;
};
