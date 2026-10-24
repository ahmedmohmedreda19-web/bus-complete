/* ===== التخزين المحلي: الأسماء والأرقام القياسية ===== */

export interface ScoreRow { n: string; s: number; r: number; d: number }

const KEY = "busComplete.highScores";
const NAME_KEY = "busComplete.name";
const MUTE_KEY = "busComplete.muted";

export function loadScores(): ScoreRow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ScoreRow[];
    return Array.isArray(arr) ? arr.slice(0, 8) : [];
  } catch { return []; }
}

export function saveScore(name: string, score: number, rounds: number, sessionId?: number): { list: ScoreRow[]; rank: number } {
  const id = sessionId ?? Date.now();
  const list = loadScores().filter((r) => r.d !== id);
  const row: ScoreRow = { n: name, s: score, r: rounds, d: id };
  list.push(row);
  list.sort((a, b) => b.s - a.s || a.d - b.d);
  const trimmed = list.slice(0, 8);
  try { localStorage.setItem(KEY, JSON.stringify(trimmed)); } catch { /* ignore */ }
  return { list: trimmed, rank: trimmed.indexOf(row) };
}

export function loadName(): string {
  try { return localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; }
}

/* ---------- سجل الجولات الأخيرة ---------- */

export interface HistoryRow { d: number; letter: string; score: number; mode: "solo" | "daily" | "online" }

const HIST_KEY = "busComplete.history.v1";

export function loadHistory(): HistoryRow[] {
  try {
    const raw = localStorage.getItem(HIST_KEY);
    const arr = raw ? (JSON.parse(raw) as HistoryRow[]) : [];
    return Array.isArray(arr) ? arr.slice(0, 12) : [];
  } catch { return []; }
}

export function pushHistory(row: HistoryRow) {
  const list = loadHistory();
  list.unshift(row);
  try { localStorage.setItem(HIST_KEY, JSON.stringify(list.slice(0, 12))); } catch { /* اتجاهل */ }
}

/* ---------- إحصائيات اللاعب (لكارت البروفايل العام) ---------- */

export interface PlayerStatsLocal { games: number; best: number; wins: number; words: number }

const STATS_KEY = "busComplete.stats.v1";
const EMPTY_STATS: PlayerStatsLocal = { games: 0, best: 0, wins: 0, words: 0 };

export function loadStats(): PlayerStatsLocal {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? { ...EMPTY_STATS, ...(JSON.parse(raw) as PlayerStatsLocal) } : { ...EMPTY_STATS };
  } catch { return { ...EMPTY_STATS }; }
}

/** تحديث الإحصائيات بعد أي جولة */
export function bumpStats(p: { score: number; words: number; won?: boolean }) {
  const s = loadStats();
  const next: PlayerStatsLocal = {
    games: s.games + 1,
    best: Math.max(s.best, p.score),
    wins: s.wins + (p.won ? 1 : 0),
    words: s.words + Math.max(0, p.words),
  };
  try { localStorage.setItem(STATS_KEY, JSON.stringify(next)); } catch { /* اتجاهل */ }
  return next;
}

export function saveName(name: string) {
  try { localStorage.setItem(NAME_KEY, name); } catch { /* ignore */ }
}

export function loadMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
}

export function saveMuted(m: boolean) {
  try { localStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch { /* ignore */ }
}
