/* ===== طبقة الغرف الأونلاين (PeerJS P2P — المضيف هو المرجع) ===== */

import Peer, { type DataConnection } from "peerjs";
import { CATS, judge, randomLetter, type CatKey, type Verdict } from "../data/lexicon";
import { normalizeArabic } from "../lib/arabic";
import { makeQuestion, blitzPoints, BLITZ_MS, BLITZ_GAP_MS, type BlitzQuestion, type BlitzRow } from "../lib/blitz";
import { mergeBoard, boardForShare, type BoardRecord } from "../lib/globalBoard";
import { judgeChain, lastLetterOf, anyWordStartingWith, countAnyStartingWith, ELIGIBLE_LETTERS } from "../data/lexicon";
import { CHAIN_TURN_MS, CHAIN_MIN_MS, CHAIN_STEP_MS, CHAIN_LIVES, type ChainPlayer, type ChainState } from "../lib/chainTypes";

export const ONLINE_ROUND_MS = 75_000;
export const MAX_PLAYERS = 8;
export const QUICK_MATCH_CODE = "OPEN1";
/**
 * خانات المباريات العامة. كل اللاعيبة بيجربوا نفس الترتيب،
 * فأول واحد بيمسك الخانة ويبقى مضيف، واللي بعده بيلاقيه فيها فورًا.
 * لو الخانة مليانة أو الجولة شغالة → ينتقل للخانة اللي بعدها.
 */
export const QUICK_SLOTS = ["OPEN1", "OPEN2", "OPEN3", "OPEN4", "OPEN5", "OPEN6"];
// مهم: الـid لازم يكون أرقام وحروف وشرطة بس (من غير : أو رموز) وإلا سيرفر PeerJS ممكن يرفضه
const ROOM_PREFIX = "buscomplete-room-";
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export interface NetPlayer {
  id: string;
  name: string;
  title?: string;
  avatar?: string; // صورة اللاعب (dataURL مضغوط)
  connected: boolean;
  count: number; // عدد الإجابات المقفلة في الجولة الحالية
  stats?: PlayerStats; // إحصائيات كارت اللاعب
}

/** إحصائيات اللاعب اللي بتظهر في كارت البروفايل العام */
export interface PlayerStats {
  games: number;   // عدد الجولات اللي لعبها
  best: number;    // أعلى نتيجة جولة
  wins: number;    // مرات الفوز
  words: number;   // إجمالي الكلمات الصح
}

/** مفتاح الإعجاب: صاحب الإجابة + الفئة */
export type LikeKey = `${string}|${CatKey}`;

export interface NetAnswer {
  text: string;
  verdict: Verdict | null;
  manual?: boolean; // المضيف عدّل الحكم ده بايده
  unique?: boolean; // تميّز الفئة: إجابة ما حدش جاب زيها (+٣)
}

export type ManualMode = "auto" | "yes" | "no";

export interface ReviewEntry {
  text: string;
  auto: Verdict | null; // حكم القاموس الآلي
  manual: ManualMode;   // رأي المضيف
}

export interface ReviewRow {
  id: string;
  name: string;
  title: string;
  avatar?: string;
  connected: boolean;
  stopped: boolean;
  stopBonus: number; // بونص السرعة المحتمل
  answers: Record<CatKey, ReviewEntry | null>;
}

export interface ReviewData {
  letter: string;
  round: number;
  rows: ReviewRow[];
}

export interface NetResultRow {
  id: string;
  name: string;
  avatar?: string;
  connected: boolean;
  stopped: boolean;
  roundPts: number;
  bonus: number;
  total: number;
  answers: Record<CatKey, NetAnswer | null>;
}

export interface NetResults {
  letter: string;
  round: number;
  rows: NetResultRow[];
}

/** خريطة الإعجابات: "معرّف اللاعب|الفئة" → عدد القلوب */
export type LikeMap = Record<string, number>;

export interface RoomHandlers {
  onCode?: (code: string) => void;
  onPlayers?: (players: NetPlayer[]) => void;
  onStart?: (letter: string, round: number, dur?: number, of?: number) => void;
  onTick?: (remMs: number) => void;
  onProgress?: (id: string, count: number) => void;
  onReviewing?: () => void;
  onReviewData?: (data: ReviewData) => void;
  onResults?: (results: NetResults) => void;
  onReconnecting?: (active: boolean) => void;
  onChat?: (id: string, e: string) => void;
  onLikes?: (likes: LikeMap) => void;
  onLikeAccepted?: (target: string, cat: CatKey) => void;
  onBlitzQuestion?: (q: BlitzQuestion, deadline: number, rows: BlitzRow[]) => void;
  onBlitzRows?: (rows: BlitzRow[]) => void;
  onBlitzEnd?: (rows: BlitzRow[]) => void;
  onBoard?: (records: BoardRecord[]) => void;
  onChainState?: (state: ChainState) => void;
  onChainMsg?: (id: string, ok: boolean, text: string) => void;
  onClosed?: (reason: string) => void;
  onError?: (msg: string) => void;
  /** الغرفة مليانة/مشغولة — الماتشينج بيستخدمها للانتقال للخانة اللي بعدها */
  onBusy?: () => void;
}

/* رسائل الضيف → المضيف */
type GuestMsg =
  | { t: "join"; name: string; title?: string; avatar?: string }
  | { t: "lock"; cat: CatKey; text: string }
  | { t: "stop" }
  | { t: "chat"; e: string }
  | { t: "like"; target: string; cat: CatKey }
  | { t: "stats"; stats: PlayerStats }
  | { t: "blitzAns"; word: string }
  | { t: "chainWord"; word: string }
  | { t: "board"; records: BoardRecord[] }
  | { t: "leave" };

/* رسائل المضيف → الضيوف */
type HostMsg =
  | { t: "hello"; id: string; players: NetPlayer[]; phase: "lobby" | "play" | "review" | "results" | "blitz" | "chain"; letter?: string; round?: number; endsAt?: number }
  | { t: "lobby"; players: NetPlayer[] }
  | { t: "start"; letter: string; round: number; dur?: number; of?: number }
  | { t: "tick"; rem: number }
  | { t: "prog"; id: string; count: number }
  | { t: "chat"; id: string; e: string }
  | { t: "likes"; likes: LikeMap }
  | { t: "blitzQ"; q: BlitzQuestion; deadline: number; rows: BlitzRow[] }
  | { t: "blitzRows"; rows: BlitzRow[] }
  | { t: "blitzEnd"; rows: BlitzRow[] }
  | { t: "chainState"; state: ChainState }
  | { t: "chainMsg"; id: string; ok: boolean; text: string }
  | { t: "board"; records: BoardRecord[] }
  | { t: "likeOk"; target: string; cat: CatKey }
  | { t: "reviewing"; data?: ReviewData } // مراجعة شاملة — بيانات إجابات الجميع
  | { t: "results"; results: NetResults }
  | { t: "busy" }
  | { t: "closed"; reason: string };

function genCode(): string {
  let c = "";
  for (let i = 0; i < 5; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}

/** ترجمة نوع خطأ PeerJS لرسالة مفيدة */
function hostErrorMessage(type: string): string {
  switch (type) {
    case "browser-incompatible":
      return "متصفحك مش بيدعم الاتصال المباشر (WebRTC) — حدّث المتصفح وجرب تاني";
    case "ssl-unavailable":
      return "لازم تفتح اللعبة من رابط https عشان الأونلاين يشتغل";
    case "network":
    case "socket-error":
    case "socket-closed":
      return "سيرفر الغرف مش واصل دلوقتي — اتأكد من النت وجرب تاني بعد ثواني";
    case "server-error":
      return "سيرفر الغرف مضغوط — جرب تاني بعد شوية";
    case "unavailable-id":
      return "تعذر حجز كود الغرفة — اضغط إنشاء مرة تانية";
    case "invalid-id":
      return "صيغة كود الغرفة مرفوضة من السيرفر — جرب تاني";
    default:
      return `مشكلة في الاتصال${type ? ` [${type}]` : ""} — جرب تاني ولو تكررت جرب شبكة تانية`;
  }
}

function emptyAnswers(): Record<CatKey, string | null> {
  return Object.fromEntries(CATS.map((c) => [c.key, null])) as Record<CatKey, string | null>;
}

/* ================== المضيف ================== */

class HostRoom {
  peer!: Peer;
  code = "";
  private conns = new Map<string, DataConnection>();
  private names = new Map<string, string>();       // id → اسم
  private titles = new Map<string, string>();      // id → لقب
  private avatars = new Map<string, string>();     // id → صورة
  private statsMap = new Map<string, PlayerStats>(); // id → إحصائيات
  private likes: LikeMap = {};                     // "id|cat" → عدد القلوب
  private likedBy = new Set<string>();             // "من|لمين|فئة" لمنع التكرار
  private connected = new Map<string, boolean>();
  private counts = new Map<string, number>();
  private totals = new Map<string, number>();
  private roundAnswers = new Map<string, Record<CatKey, string | null>>(); // id → إجابات خام
  private stopped = new Set<string>();
  private stopRem = new Map<string, number>();
  private review: ReviewData | null = null;
  private lastResults: NetResults | null = null;
  private phase: "lobby" | "play" | "review" | "results" | "blitz" | "chain" = "lobby";
  private blitzRows = new Map<string, BlitzRow>();
  private blitzQ: BlitzQuestion | null = null;
  private blitzDeadline = 0;
  private blitzTimer: ReturnType<typeof setTimeout> | undefined;
  private chain: ChainState | null = null;
  private chainUsed = new Set<string>();
  private chainTimer: ReturnType<typeof setTimeout> | undefined;
  private chainOrder: string[] = [];
  private letter = "";
  private prevLetter = "";
  private round = 0;
  private endsAt = 0;
  private roundMs = ONLINE_ROUND_MS;
  private maxRounds = 0; // 0 = مفتوح
  private tickTimer: ReturnType<typeof setInterval> | undefined;
  private openTimer: ReturnType<typeof setTimeout> | undefined;
  private destroyed = false;

  constructor(
    private hostName: string,
    private hostTitle: string,
    private h: RoomHandlers,
    private fixedCode?: string,
    private onCodeTaken?: () => void,
    private autoReview = false,
    private hostAvatar = "",
  ) {
    this.tryHost();
  }

  private tryHost(attempt = 0) {
    if (this.destroyed) return;
    this.code = this.fixedCode ?? genCode();
    try { this.peer?.destroy?.(); } catch { /* اتجاهل */ }
    this.peer = new Peer(ROOM_PREFIX + this.code, { debug: 0 });
    clearTimeout(this.openTimer);
    this.openTimer = setTimeout(() => {
      if (!this.destroyed && !this.peer.open) {
        this.h.onError?.("السيرفر مأخر في الرد… اضغط إنشاء مرة تانية");
      }
    }, 12_000);
    this.peer.on("open", () => {
      clearTimeout(this.openTimer);
      this.names.set(this.peer.id, this.hostName);
      this.titles.set(this.peer.id, this.hostTitle);
      this.avatars.set(this.peer.id, this.hostAvatar);
      this.connected.set(this.peer.id, true);
      this.totals.set(this.peer.id, 0);
      this.counts.set(this.peer.id, 0);
      this.h.onCode?.(this.code);
      this.emitLobby();
    });
    this.peer.on("connection", (conn) => this.onConnection(conn));
    this.peer.on("error", (err: { type?: string }) => {
      if (this.destroyed) return;
      const type = err?.type ?? "";
      if (type === "unavailable-id" && this.fixedCode && this.onCodeTaken) {
        // فيه مضيف للمباراة العامة بالفعل: اتحول لضيف عنده بدل إظهار خطأ.
        clearTimeout(this.openTimer);
        this.destroyed = true;
        try { this.peer.destroy(); } catch { /* اتجاهل */ }
        this.onCodeTaken();
        return;
      }
      if (type === "unavailable-id" && attempt < 4) {
        this.tryHost(attempt + 1);
        return;
      }
      clearTimeout(this.openTimer);
      this.h.onError?.(hostErrorMessage(type));
    });
  }

  get myId() { return this.peer.id; }

  private onConnection(conn: DataConnection) {
    conn.on("close", () => {
      this.conns.delete(conn.peer);
      if (this.names.has(conn.peer)) this.onLeave(conn.peer);
    });
    conn.on("error", () => {
      this.conns.delete(conn.peer);
      if (this.names.has(conn.peer)) this.onLeave(conn.peer);
    });
    conn.on("data", (raw) => {
      try {
        this.onMessage(conn, raw as GuestMsg);
      } catch (e) {
        console.warn("رسالة ضيف مهملة:", e);
      }
    });
  }

  private onMessage(conn: DataConnection, msg: GuestMsg) {
    if (!msg || typeof msg !== "object") return;
      if (msg.t === "join") {
        const id = conn.peer;
        const joinName = (msg.name || "لاعب").slice(0, 16);

        // رجوع لاعب اتفصل: نرجّعله كرسيه ونقطه وإجاباته
        const seatId = [...this.names.keys()].find(
          (k) => k !== id && this.names.get(k) === joinName && !this.connected.get(k)
        );
        if (seatId !== undefined) {
          this.migrateSeat(seatId, id, conn);
          const hello: HostMsg = { t: "hello", id, players: this.playerList(), phase: this.phase };
          if (this.phase === "play") { hello.letter = this.letter; hello.round = this.round; hello.endsAt = this.endsAt; }
          conn.send(hello);
          if (this.phase === "results" && this.lastResults) {
            conn.send({ t: "results", results: this.lastResults } satisfies HostMsg);
          } else if (this.phase === "review") {
            conn.send({ t: "reviewing" } satisfies HostMsg);
          }
          this.emitLobby();
          return;
        }

        // الرجوع ممكن في أي وقت — الحرمان بس للاعيبة جداد وقت اللعب
        if ((this.phase === "play" || this.phase === "review") && this.conns.size >= MAX_PLAYERS - 1) {
          conn.send({ t: "busy" } satisfies HostMsg);
          setTimeout(() => conn.close(), 300);
          return;
        }
        // اسم مميز
        let nm = joinName;
        const existing = new Set([...this.names.values()]);
        let i = 2;
        while (existing.has(nm)) nm = `${msg.name.slice(0, 12)} ${i++}`;
        this.conns.set(id, conn);
        this.names.set(id, nm);
        this.titles.set(id, (msg.title ?? "").slice(0, 24));
        this.avatars.set(id, typeof msg.avatar === "string" ? msg.avatar.slice(0, 40_000) : "");
        this.connected.set(id, true);
        this.totals.set(id, 0);
        this.counts.set(id, 0);
        this.roundAnswers.set(id, emptyAnswers());
        const hello2: HostMsg = { t: "hello", id, players: this.playerList(), phase: this.phase };
        if (this.phase === "play") { hello2.letter = this.letter; hello2.round = this.round; hello2.endsAt = this.endsAt; }
        conn.send(hello2);
        try { conn.send({ t: "board", records: boardForShare() } satisfies HostMsg); } catch { /* اتجاهل */ }
        if (this.phase === "results" && this.lastResults) conn.send({ t: "results", results: this.lastResults } satisfies HostMsg);
        else if (this.phase === "review") conn.send({ t: "reviewing" } satisfies HostMsg);
        this.emitLobby();
      } else if (msg.t === "lock") {
        if (this.phase !== "play") return;
        const id = conn.peer;
        const rec = this.roundAnswers.get(id);
        if (!rec || this.stopped.has(id)) return;
        rec[msg.cat] = msg.text.slice(0, 40);
        const cnt = Object.values(rec).filter(Boolean).length;
        this.counts.set(id, cnt);
        this.broadcast({ t: "prog", id, count: cnt });
        this.h.onProgress?.(id, cnt);
      } else if (msg.t === "chat") {
        const id = conn.peer;
        if (!this.names.has(id) || typeof msg.e !== "string" || msg.e.length > 8) return;
        this.broadcast({ t: "chat", id, e: msg.e });
        this.h.onChat?.(id, msg.e);
      } else if (msg.t === "like") {
        this.applyLike(conn.peer, msg.target, msg.cat);
      } else if (msg.t === "stats") {
        const id = conn.peer;
        if (!this.names.has(id) || !msg.stats) return;
        this.statsMap.set(id, {
          games: Math.max(0, Math.min(99_999, msg.stats.games | 0)),
          best: Math.max(0, Math.min(99_999, msg.stats.best | 0)),
          wins: Math.max(0, Math.min(99_999, msg.stats.wins | 0)),
          words: Math.max(0, Math.min(999_999, msg.stats.words | 0)),
        });
        this.emitLobby();
      } else if (msg.t === "board") {
        // ضيف بعت أرقامه: ندمجها ونوزّع النسخة المحدّثة على الكل
        const merged = mergeBoard(Array.isArray(msg.records) ? msg.records.slice(0, 30) : []);
        this.broadcast({ t: "board", records: merged.map((r) => ({ ...r, avatar: undefined })) });
        this.h.onBoard?.(merged);
      } else if (msg.t === "chainWord") {
        this.chainSubmit(conn.peer, msg.word);
      } else if (msg.t === "blitzAns") {
        this.blitzAnswer(conn.peer, msg.word);
      } else if (msg.t === "stop") {
        if (this.phase !== "play") return;
        this.markStopped(conn.peer);
      } else if (msg.t === "leave") {
        conn.close();
        this.onLeave(conn.peer);
      }
  }

  private onLeave(id: string) {
    if (this.destroyed || !this.names.has(id)) return;
    this.connected.set(id, false);
    if (this.phase === "lobby" || this.phase === "results") {
      this.names.delete(id);
      this.titles.delete(id);
      this.totals.delete(id);
      this.counts.delete(id);
    } else if (this.phase === "play" && !this.stopped.has(id)) {
      this.markStopped(id); // اعتبره خلص باللي عنده
    }
    this.conns.get(id)?.close();
    this.conns.delete(id);
    this.emitLobby();
    this.checkAllStopped();
  }

  private markStopped(id: string) {
    if (this.stopped.has(id)) return;
    this.stopped.add(id);
    this.stopRem.set(id, Math.max(0, this.endsAt - Date.now()));
    this.checkAllStopped();
  }

  /** المضيف نفسه بلعب — تسجيل إجاباته محليًا */
  hostLock(cat: CatKey, text: string) {
    if (this.phase !== "play" || this.stopped.has(this.peer.id)) return;
    if (!this.roundAnswers.has(this.peer.id)) this.roundAnswers.set(this.peer.id, emptyAnswers());
    const rec = this.roundAnswers.get(this.peer.id)!;
    rec[cat] = text.slice(0, 40);
    const cnt = Object.values(rec).filter(Boolean).length;
    this.counts.set(this.peer.id, cnt);
    this.broadcast({ t: "prog", id: this.peer.id, count: cnt });
    this.h.onProgress?.(this.peer.id, cnt);
  }

  hostStop() {
    if (this.phase !== "play") return;
    this.markStopped(this.peer.id);
  }

  /* ============ تحدي الخمس ثواني ============ */

  /** بدء التحدي السريع */
  startBlitz() {
    if (this.destroyed || this.phase === "play" || this.phase === "blitz") return;
    const active = [...this.names.keys()].filter((id) => this.connected.get(id));
    if (active.length === 0) return;
    this.phase = "blitz";
    this.blitzRows.clear();
    for (const id of active) {
      this.blitzRows.set(id, {
        id, name: this.names.get(id)!, avatar: this.avatars.get(id) ?? "",
        alive: true, score: 0, streak: 0, answered: false,
      });
    }
    this.blitzQ = null;
    this.nextBlitzQuestion();
  }

  private blitzList(): BlitzRow[] {
    return [...this.blitzRows.values()];
  }

  private nextBlitzQuestion() {
    if (this.destroyed || this.phase !== "blitz") return;
    const alive = this.blitzList().filter((r) => r.alive);
    // انتهى التحدي: مفيش صامدين أو فضل واحد في لعبة جماعية
    if (alive.length === 0 || (this.blitzRows.size > 1 && alive.length <= 1)) {
      this.endBlitz();
      return;
    }
    const q = makeQuestion((this.blitzQ?.round ?? 0) + 1, this.blitzQ ?? undefined);
    this.blitzQ = q;
    this.blitzDeadline = Date.now() + BLITZ_MS;
    for (const r of this.blitzRows.values()) { r.answered = false; r.lastWord = undefined; r.lastOk = undefined; }
    const rows = this.blitzList();
    this.broadcast({ t: "blitzQ", q, deadline: this.blitzDeadline, rows });
    this.h.onBlitzQuestion?.(q, this.blitzDeadline, rows);
    clearTimeout(this.blitzTimer);
    clearTimeout(this.chainTimer);
    this.blitzTimer = setTimeout(() => this.resolveBlitz(), BLITZ_MS + 120);
  }

  /** تسجيل إجابة لاعب */
  private blitzAnswer(id: string, word: string) {
    if (this.phase !== "blitz" || !this.blitzQ) return;
    const row = this.blitzRows.get(id);
    if (!row || !row.alive || row.answered) return;
    const msLeft = Math.max(0, this.blitzDeadline - Date.now());
    if (msLeft <= 0) return;
    const v = judge(this.blitzQ.cat, String(word).slice(0, 40), this.blitzQ.letter);
    const ok = v.t === "exact" || v.t === "fixed";
    row.answered = true;
    row.lastWord = String(word).slice(0, 40);
    row.lastOk = ok;
    if (ok) {
      row.score += blitzPoints(msLeft) + (v.t === "exact" ? 0 : -2);
      row.streak += 1;
    }
    const rows = this.blitzList();
    this.broadcast({ t: "blitzRows", rows });
    this.h.onBlitzRows?.(rows);
    // كل الصامدين جاوبوا؟ اقفل السؤال بدري
    if (this.blitzList().filter((r) => r.alive).every((r) => r.answered)) {
      clearTimeout(this.blitzTimer);
      this.blitzTimer = setTimeout(() => this.resolveBlitz(), 400);
    }
  }

  /** المضيف نفسه بيجاوب */
  hostBlitzAnswer(word: string) {
    this.blitzAnswer(this.peer.id, word);
  }

  /** تقييم السؤال: اللي مجاوبش صح يخرج */
  private resolveBlitz() {
    if (this.phase !== "blitz") return;
    for (const r of this.blitzRows.values()) {
      if (!r.alive) continue;
      if (!r.answered || !r.lastOk) { r.alive = false; r.streak = 0; }
    }
    const rows = this.blitzList();
    this.broadcast({ t: "blitzRows", rows });
    this.h.onBlitzRows?.(rows);
    clearTimeout(this.blitzTimer);
    this.blitzTimer = setTimeout(() => this.nextBlitzQuestion(), BLITZ_GAP_MS);
  }

  private endBlitz() {
    if (this.phase !== "blitz") return;
    this.phase = "results";
    clearTimeout(this.blitzTimer);
    const rows = this.blitzList().sort((a, b) => b.score - a.score);
    this.broadcast({ t: "blitzEnd", rows });
    this.h.onBlitzEnd?.(rows);
  }

  /* ============ وصلة الحروف (أدوار) ============ */

  /** بدء لعبة السلسلة */
  startChain() {
    if (this.destroyed || this.phase === "play" || this.phase === "blitz" || this.phase === "chain") return;
    const active = [...this.names.keys()].filter((id) => this.connected.get(id));
    if (active.length === 0) return;
    this.phase = "chain";
    this.chainUsed.clear();
    this.chainOrder = [...active].sort(() => Math.random() - 0.5);
    const players: ChainPlayer[] = this.chainOrder.map((id) => ({
      id, name: this.names.get(id)!, avatar: this.avatars.get(id) ?? "",
      alive: true, lives: CHAIN_LIVES, score: 0, words: 0,
    }));
    // حرف بداية غني بالكلمات
    const rich = ELIGIBLE_LETTERS.filter((l) => countAnyStartingWith(l) >= 30);
    const letter = (rich.length ? rich : ELIGIBLE_LETTERS)[Math.floor(Math.random() * (rich.length || ELIGIBLE_LETTERS.length))];
    this.chain = {
      letter, lastWord: "", lastBy: "",
      turnId: this.chainOrder[0], deadline: Date.now() + CHAIN_TURN_MS,
      turnMs: CHAIN_TURN_MS, players, history: [], round: 1, over: false,
    };
    this.pushChain();
    this.armChainTimer();
  }

  private pushChain() {
    if (!this.chain) return;
    const st: ChainState = JSON.parse(JSON.stringify(this.chain));
    this.broadcast({ t: "chainState", state: st });
    this.h.onChainState?.(st);
  }

  private armChainTimer() {
    clearTimeout(this.chainTimer);
    if (!this.chain || this.chain.over) return;
    const ms = Math.max(0, this.chain.deadline - Date.now()) + 150;
    this.chainTimer = setTimeout(() => this.chainTimeout(), ms);
  }

  /** اللاعب اللي دوره خلص وقته */
  private chainTimeout() {
    const c = this.chain;
    if (!c || c.over || this.phase !== "chain") return;
    const p = c.players.find((x) => x.id === c.turnId);
    if (p) {
      p.lives -= 1;
      if (p.lives <= 0) p.alive = false;
      const hint = anyWordStartingWith(c.letter, this.chainUsed);
      this.broadcast({ t: "chainMsg", id: p.id, ok: false, text: hint ? `خلص وقته! كان ينفع «${hint}»` : "خلص وقته!" });
      this.h.onChainMsg?.(p.id, false, hint ? `خلص وقته! كان ينفع «${hint}»` : "خلص وقته!");
    }
    this.advanceChainTurn(false);
  }

  /** اللاعب بعت كلمة */
  private chainSubmit(id: string, word: string) {
    const c = this.chain;
    if (!c || c.over || this.phase !== "chain") return;
    if (c.turnId !== id) return; // مش دورك
    const p = c.players.find((x) => x.id === id);
    if (!p || !p.alive) return;
    const raw = String(word).slice(0, 40);
    const key = normalizeArabic(raw);

    // مكررة؟
    if (this.chainUsed.has(key)) {
      p.lives -= 1;
      if (p.lives <= 0) p.alive = false;
      this.broadcast({ t: "chainMsg", id, ok: false, text: "الكلمة دي اتقالت قبل كده! 🔁" });
      this.h.onChainMsg?.(id, false, "الكلمة دي اتقالت قبل كده! 🔁");
      this.advanceChainTurn(false);
      return;
    }

    const v = judgeChain(raw, c.letter);
    if (v.t === "bad") {
      p.lives -= 1;
      if (p.lives <= 0) p.alive = false;
      const text = v.reason === "letter" ? `لازم تبدأ بحرف «${c.letter}»` : "مش في القاموس";
      this.broadcast({ t: "chainMsg", id, ok: false, text });
      this.h.onChainMsg?.(id, false, text);
      this.advanceChainTurn(false);
      return;
    }

    // ✅ صح
    const msLeft = Math.max(0, c.deadline - Date.now());
    const speed = Math.round((msLeft / c.turnMs) * 5);
    const pts = v.pts + speed;
    p.score += pts;
    p.words += 1;
    this.chainUsed.add(key);
    c.lastWord = v.display;
    c.lastBy = id;
    c.history.unshift({ word: v.display, by: id });
    if (c.history.length > 30) c.history.pop();
    this.broadcast({ t: "chainMsg", id, ok: true, text: `+${pts}` });
    this.h.onChainMsg?.(id, true, `+${pts}`);

    // الحرف الجاي
    let next = lastLetterOf(v.display);
    if (!ELIGIBLE_LETTERS.includes(next) || countAnyStartingWith(next, this.chainUsed) < 2) {
      const rich = ELIGIBLE_LETTERS.filter((l) => countAnyStartingWith(l, this.chainUsed) >= 10);
      next = (rich.length ? rich : ELIGIBLE_LETTERS)[Math.floor(Math.random() * (rich.length || ELIGIBLE_LETTERS.length))];
    }
    c.letter = next;
    this.advanceChainTurn(true);
  }

  /** الدور اللي بعده */
  private advanceChainTurn(ok: boolean) {
    const c = this.chain;
    if (!c) return;
    const alive = c.players.filter((x) => x.alive);
    // انتهت اللعبة؟
    if (alive.length === 0 || (c.players.length > 1 && alive.length <= 1)) {
      this.endChain();
      return;
    }
    // الدور اللي بعده من الصامدين
    const order = this.chainOrder.filter((id) => c.players.find((p) => p.id === id)?.alive);
    const curIdx = order.indexOf(c.turnId);
    const nextId = order[(curIdx + 1) % order.length];
    // دورة كاملة؟ نقلل الوقت
    if (ok && order.indexOf(nextId) <= curIdx) {
      c.round += 1;
      c.turnMs = Math.max(CHAIN_MIN_MS, c.turnMs - CHAIN_STEP_MS);
    }
    c.turnId = nextId;
    c.deadline = Date.now() + c.turnMs;
    this.pushChain();
    this.armChainTimer();
  }

  private endChain() {
    const c = this.chain;
    if (!c) return;
    c.over = true;
    this.phase = "results";
    clearTimeout(this.chainTimer);
    c.players.sort((a, b) => b.score - a.score);
    this.pushChain();
  }

  /** المضيف بيبعت كلمته */
  hostChainWord(word: string) {
    this.chainSubmit(this.peer.id, word);
  }

  /** نشر لوحة الشرف على كل اللاعيبة */
  shareBoard() {
    this.broadcast({ t: "board", records: boardForShare() });
  }

  /** إعدادات المضيف: مدة الجولة وعدد الجولات (قبل البدء أو بين الجولات) */
  setRoundMs(ms: number) { this.roundMs = ms; }
  setMaxRounds(n: number) { this.maxRounds = n; }

  /** المضيف بيبعت رد فعل سريع */
  hostChat(e: string) {
    this.broadcast({ t: "chat", id: this.peer.id, e: e.slice(0, 8) });
  }

  /** تسجيل إعجاب — كل لاعب مرة واحدة على كل إجابة، ومفيش إعجاب لنفسك */
  private applyLike(from: string, target: string, cat: CatKey) {
    if (!this.names.has(from) || !this.names.has(target)) return;
    if (from === target) return;
    if (!CATS.some((c) => c.key === cat)) return;
    const guard = `${from}|${target}|${cat}`;
    if (this.likedBy.has(guard)) return;
    this.likedBy.add(guard);
    const key = `${target}|${cat}`;
    this.likes[key] = (this.likes[key] ?? 0) + 1;
    this.broadcast({ t: "likes", likes: this.likes });
    this.h.onLikes?.({ ...this.likes });
    if (from === this.peer.id) this.h.onLikeAccepted?.(target, cat);
    else {
      try { this.conns.get(from)?.send({ t: "likeOk", target, cat } satisfies HostMsg); } catch { /* اتجاهل */ }
    }
  }

  /** المضيف بيعمل لايك */
  hostLike(target: string, cat: CatKey) {
    this.applyLike(this.peer.id, target, cat);
  }

  /** إحصائيات المضيف نفسه */
  setHostStats(s: PlayerStats) {
    this.statsMap.set(this.peer.id, s);
    this.emitLobby();
  }

  startRound() {
    if (this.phase === "play" || this.phase === "review" || this.destroyed) return;
    if (this.maxRounds > 0 && this.round >= this.maxRounds) return;
    const active = [...this.names.keys()].filter((id) => this.connected.get(id));
    if (active.length === 0) return;
    this.round += 1;
    this.prevLetter = this.letter;
    this.letter = randomLetter(this.prevLetter);
    this.phase = "play";
    this.stopped.clear();
    this.stopRem.clear();
    this.roundAnswers.clear();
    this.likes = {};
    this.likedBy.clear();
    for (const id of active) {
      this.roundAnswers.set(id, emptyAnswers());
      this.counts.set(id, 0);
    }
    this.endsAt = Date.now() + this.roundMs;
    this.broadcast({ t: "start", letter: this.letter, round: this.round, dur: this.roundMs, of: this.maxRounds });
    this.h.onStart?.(this.letter, this.round, this.roundMs, this.maxRounds);
    this.h.onPlayers?.(this.playerList());
    clearInterval(this.tickTimer);
    this.tickTimer = setInterval(() => {
      const rem = Math.max(0, this.endsAt - Date.now());
      this.broadcast({ t: "tick", rem });
      this.h.onTick?.(rem);
      if (rem <= 0) { clearInterval(this.tickTimer); this.endRound(); }
    }, 300);
  }

  private checkAllStopped() {
    if (this.phase !== "play") return;
    const active = [...this.names.keys()].filter((id) => this.connected.get(id));
    if (active.length > 0 && active.every((id) => this.stopped.has(id))) {
      clearInterval(this.tickTimer);
      setTimeout(() => this.endRound(), 600);
    }
  }

  private endRound() {
    if (this.phase !== "play") return;
    this.phase = "review";
    clearInterval(this.tickTimer);
    const ids = [...this.names.keys()];
    const rows: ReviewRow[] = ids.map((id) => {
      const rec = this.roundAnswers.get(id) ?? emptyAnswers();
      const answers = {} as Record<CatKey, ReviewEntry | null>;
      for (const c of CATS) {
        const text = rec[c.key];
        if (text) {
          answers[c.key] = { text, auto: judge(c.key, text, this.letter), manual: "auto" };
        } else answers[c.key] = null;
      }
      const filled = Object.values(rec).filter(Boolean).length;
      const stopBonus = this.stopped.has(id) && filled === CATS.length
        ? Math.ceil(this.stopRem.get(id)! / 1000) : 0;
      return {
        id, name: this.names.get(id)!, title: this.titles.get(id) ?? "",
        avatar: this.avatars.get(id) ?? "",
        connected: this.connected.get(id) ?? false,
        stopped: this.stopped.has(id), stopBonus, answers,
      };
    });
    this.review = { letter: this.letter, round: this.round, rows };
    this.broadcast({ t: "reviewing", data: this.review ? (JSON.parse(JSON.stringify(this.review)) as ReviewData) : undefined });
    this.h.onReviewing?.();
    // المباراة العامة تعتمد القاموس آليًا حتى لا يتحكم لاعب غريب في نقاط الباقيين.
    if (this.autoReview) setTimeout(() => this.finalizeReview({}), 900);
  }

  /** نسخة من بيانات المراجعة لواجهة المضيف */
  getReview(): ReviewData | null {
    return this.review ? (JSON.parse(JSON.stringify(this.review)) as ReviewData) : null;
  }

  /** المضيف خلص التصحيح — تطبيق التعديلات وإعلان النتايج */
  finalizeReview(overrides: Record<string, Partial<Record<CatKey, ManualMode>>>) {
    if (this.phase !== "review" || !this.review) return;
    this.phase = "results";
    const rows: NetResultRow[] = this.review.rows.map((rr) => {
      let pts = 0;
      const answers = {} as Record<CatKey, NetAnswer | null>;
      for (const c of CATS) {
        const entry = rr.answers[c.key];
        if (!entry) { answers[c.key] = null; continue; }
        const mode = overrides[rr.id]?.[c.key] ?? "auto";
        let verdict: Verdict | null;
        let manual = false;
        if (mode === "yes") {
          verdict = { t: "exact", pts: 10, display: entry.text };
          manual = true;
        } else if (mode === "no") {
          verdict = { t: "bad", reason: "invalid" };
          manual = true;
        } else {
          verdict = entry.auto;
        }
        answers[c.key] = { text: entry.text, verdict, manual };
        if (verdict && verdict.t !== "bad") pts += verdict.pts;
      }
      const bonus = rr.stopBonus;
      const total = (this.totals.get(rr.id) ?? 0) + pts + bonus;
      return {
        id: rr.id, name: rr.name, avatar: rr.avatar, connected: rr.connected,
        stopped: rr.stopped, roundPts: pts, bonus, total, answers,
      };
    });
    // تميّز الفئة: إجابة فريدة ما حدش جاب زيها (+٣)
    for (const c of CATS) {
      const seen = new Map<string, number>();
      for (const r of rows) {
        const a = r.answers[c.key];
        if (a?.verdict && a.verdict.t !== "bad") {
          const k = normalizeArabic(a.verdict.display);
          seen.set(k, (seen.get(k) ?? 0) + 1);
        }
      }
      for (const r of rows) {
        const a = r.answers[c.key];
        if (a?.verdict && a.verdict.t !== "bad") {
          const occ = seen.get(normalizeArabic(a.verdict.display)) ?? 0;
          if (occ === 1 && rows.length > 1) { a.unique = true; r.roundPts += 3; }
        }
      }
    }
    for (const r of rows) {
      const total = (this.totals.get(r.id) ?? 0) + r.roundPts + r.bonus;
      this.totals.set(r.id, total);
      r.total = total;
    }
    rows.sort((a, b) => b.total - a.total);
    const results: NetResults = { letter: this.review.letter, round: this.review.round, rows };
    this.review = null;
    this.lastResults = results; // مهم: اللي بيرجع بعد الفصل يلاقي نتايج الجولة
    this.broadcast({ t: "results", results });
    this.h.onResults?.(results);
  }

  /** نقل كرسي لاعب من معرّف قديم لمعرّف جديد بعد إعادة الاتصال */
  private migrateSeat(oldId: string, newId: string, conn: DataConnection) {
    const move = (m: Map<string, unknown>) => {
      const v = m.get(oldId);
      if (v !== undefined) { m.delete(oldId); m.set(newId, v); }
    };
    move(this.names); move(this.titles); move(this.avatars); move(this.statsMap); move(this.totals);
    move(this.counts); move(this.stopRem);
    const ra = this.roundAnswers.get(oldId);
    if (ra) { this.roundAnswers.delete(oldId); this.roundAnswers.set(newId, ra); }
    if (this.stopped.has(oldId)) { this.stopped.delete(oldId); this.stopped.add(newId); }
    this.conns.get(oldId)?.close();
    this.conns.delete(oldId);
    this.connected.delete(oldId);
    this.conns.set(newId, conn);
    this.connected.set(newId, true);
  }

  private playerList(): NetPlayer[] {
    return [...this.names.keys()].map((id) => ({
      id, name: this.names.get(id)!, title: this.titles.get(id) ?? "",
      avatar: this.avatars.get(id) ?? "",
      stats: this.statsMap.get(id),
      connected: this.connected.get(id) ?? false, count: this.counts.get(id) ?? 0,
    }));
  }

  private emitLobby() {
    const p = this.playerList();
    this.broadcast({ t: "lobby", players: p });
    this.h.onPlayers?.(p);
  }

  private broadcast(msg: HostMsg) {
    for (const conn of this.conns.values()) {
      try { conn.send(msg); } catch { /* اتجاهل */ }
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    clearInterval(this.tickTimer);
    clearTimeout(this.openTimer);
    clearTimeout(this.blitzTimer);
    try { this.broadcast({ t: "closed", reason: "المضيف قفل الغرفة" }); } catch { /* اتجاهل */ }
    setTimeout(() => { try { this.peer.destroy(); } catch { /* اتجاهل */ } }, 400);
  }
}

/* ================== الضيف ================== */

class GuestRoom {
  peer: Peer;
  conn: DataConnection | null = null;
  myId = "";
  readonly hostId: string;
  private joinTimeout: ReturnType<typeof setTimeout> | undefined;
  private destroyed = false;

  private joinName: string;
  private joinTitle: string;
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  private joinAvatar: string;

  constructor(code: string, name: string, title: string, private h: RoomHandlers, avatar = "", joinTimeoutMs = 9000) {
    this.hostId = ROOM_PREFIX + code.trim().toUpperCase();
    this.joinName = name;
    this.joinTitle = title;
    this.joinAvatar = avatar;
    this.peer = new Peer();
    this.peer.on("open", () => {
      if (this.destroyed) return;
      this.connect();
      this.joinTimeout = setTimeout(() => {
        if (this.myId || this.destroyed) return;
        // خانة معلّقة (المضيف قفل من غير ما يسيبها) — الماتشينج بينتقل للي بعدها
        if (this.h.onBusy) this.h.onBusy();
        else this.h.onError?.("مش لاقيين الغرفة… اتأكد من الكود والنت");
      }, joinTimeoutMs);
    });
    this.peer.on("error", (err: { type?: string }) => {
      clearTimeout(this.joinTimeout);
      if (this.destroyed) return;
      const type = err?.type ?? "";
      if (type === "peer-unavailable") {
        if (this.h.onBusy) this.h.onBusy();
        else this.h.onError?.("الكود غلط أو الغرفة اتقفلت — اتأكد من الكود مع صاحبك");
        setTimeout(() => this.destroy(), 100);
      } else if (type === "browser-incompatible") {
        this.h.onError?.("متصفحك مش بيدعم الاتصال المباشر (WebRTC) — حدّث المتصفح وجرب تاني");
        setTimeout(() => this.destroy(), 100);
      } else if (type === "network" || type === "socket-error" || type === "socket-closed" || type === "server-error") {
        this.h.onError?.("سيرفر الغرف مش واصل دلوقتي — جرب تاني بعد ثواني");
      } else {
        this.h.onError?.(`مشكلة في الاتصال${type ? ` [${type}]` : ""} — جرب تاني`);
      }
    });
  }

  /** فتح اتصال بيانات بالمضيف */
  private connect() {
    if (this.destroyed) return;
    const conn = this.peer.connect(this.hostId, { reliable: true });
    this.conn = conn;
    conn.on("open", () => conn.send({ t: "join", name: this.joinName, title: this.joinTitle, avatar: this.joinAvatar } satisfies GuestMsg));
    conn.on("data", (raw) => this.onData(raw as HostMsg));
    conn.on("error", () => { /* الاتصال لسه ممكن يرجع */ });
    conn.on("close", () => {
      if (this.destroyed) return;
      // مش بنطرد فورًا: بنجرب نرجع (الموبايل بيفصل لما الشاشة تتقفل)
      this.scheduleReconnect();
    });
  }

  /** محاولات إعادة الاتصال قبل الاستسلام */
  private scheduleReconnect() {
    if (this.destroyed) return;
    if (this.attempts >= 4) {
      this.h.onReconnecting?.(false);
      this.h.onClosed?.("الاتصال بالغرفة اتقطع — اخرج وادخل تاني بنفس الكود");
      return;
    }
    this.attempts += 1;
    this.h.onReconnecting?.(true);
    this.reconnectTimer = setTimeout(() => {
      if (this.destroyed) return;
      if (!this.peer.open) {
        try { this.peer.reconnect(); } catch { /* اتجاهل */ }
        this.scheduleReconnect();
        return;
      }
      this.connect();
    }, 2200);
  }

  private onData(msg: HostMsg) {
    // رسالة غير متوقعة/تالفة ماينفعش توقف اللعبة
    if (!msg || typeof msg !== "object" || typeof (msg as { t?: unknown }).t !== "string") return;
    try {
      this.handleData(msg);
    } catch (e) {
      console.warn("رسالة مهملة:", e);
    }
  }

  private handleData(msg: HostMsg) {
    switch (msg.t) {
      case "hello":
        clearTimeout(this.joinTimeout);
        this.myId = msg.id;
        this.attempts = 0;
        this.h.onReconnecting?.(false);
        this.h.onPlayers?.(msg.players ?? []);
        if (msg.phase === "review") this.h.onReviewing?.();
        else if (msg.phase === "play" && msg.letter) {
          this.h.onStart?.(msg.letter, msg.round ?? 1);
          if (msg.endsAt) this.h.onTick?.(Math.max(0, msg.endsAt - Date.now()));
        }
        break;
      case "lobby": this.h.onPlayers?.(msg.players); break;
      case "start": this.h.onStart?.(msg.letter, msg.round, msg.dur, msg.of); break;
      case "tick": this.h.onTick?.(msg.rem); break;
      case "prog": this.h.onProgress?.(msg.id, msg.count); break;
      case "chat": this.h.onChat?.(msg.id, msg.e); break;
      case "likes": this.h.onLikes?.(msg.likes ?? {}); break;
      case "likeOk": this.h.onLikeAccepted?.(msg.target, msg.cat); break;
      case "blitzQ": this.h.onBlitzQuestion?.(msg.q, msg.deadline, msg.rows ?? []); break;
      case "blitzRows": this.h.onBlitzRows?.(msg.rows ?? []); break;
      case "blitzEnd": this.h.onBlitzEnd?.(msg.rows ?? []); break;
      case "board": this.h.onBoard?.(mergeBoard(msg.records ?? [])); break;
      case "chainState": this.h.onChainState?.(msg.state); break;
      case "chainMsg": this.h.onChainMsg?.(msg.id, msg.ok, msg.text); break;
      case "reviewing":
        if (msg.data != null) this.h.onReviewData?.(msg.data);
        this.h.onReviewing?.();
        break;
      case "results": this.h.onResults?.(msg.results); break;
      case "busy":
        if (this.h.onBusy) this.h.onBusy();
        else this.h.onError?.("الجولة شغالة أو الغرفة مليانة… جرب بعدين");
        setTimeout(() => this.destroy(), 100);
        break;
      case "closed":
        this.h.onClosed?.(msg.reason);
        setTimeout(() => this.destroy(), 100);
        break;
    }
  }

  sendLock(cat: CatKey, text: string) { try { this.conn?.send({ t: "lock", cat, text } satisfies GuestMsg); } catch { /* اتجاهل */ } }
  sendStop() { try { this.conn?.send({ t: "stop" } satisfies GuestMsg); } catch { /* اتجاهل */ } }
  sendChat(e: string) { try { this.conn?.send({ t: "chat", e: e.slice(0, 8) } satisfies GuestMsg); } catch { /* اتجاهل */ } }
  sendLike(target: string, cat: CatKey) { try { this.conn?.send({ t: "like", target, cat } satisfies GuestMsg); } catch { /* اتجاهل */ } }
  sendBoard() { try { this.conn?.send({ t: "board", records: boardForShare() } satisfies GuestMsg); } catch { /* اتجاهل */ } }
  sendChainWord(word: string) { try { this.conn?.send({ t: "chainWord", word } satisfies GuestMsg); } catch { /* اتجاهل */ } }
  sendBlitzAnswer(word: string) { try { this.conn?.send({ t: "blitzAns", word } satisfies GuestMsg); } catch { /* اتجاهل */ } }
  sendStats(stats: PlayerStats) { try { this.conn?.send({ t: "stats", stats } satisfies GuestMsg); } catch { /* اتجاهل */ } }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    clearTimeout(this.joinTimeout);
    clearTimeout(this.reconnectTimer);
    try { this.conn?.send({ t: "leave" } satisfies GuestMsg); } catch { /* اتجاهل */ }
    setTimeout(() => { try { this.peer.destroy(); } catch { /* اتجاهل */ } }, 250);
  }
}

/* واجهة موحّدة */
export type Room = HostRoom | GuestRoom;

export function createRoom(name: string, handlers: RoomHandlers, title = "", avatar = ""): HostRoom {
  return new HostRoom(name, title, handlers, undefined, undefined, false, avatar);
}

/**
 * دخول مباراة عامة بدون كود. أول لاعب يصبح المضيف تلقائيًا، والباقي
 * يتحولون لضيوف عنده عبر onTaken من غير ما يشوفوا أي كود.
 */
export function createQuickRoom(
  name: string,
  handlers: RoomHandlers,
  title: string,
  onTaken: () => void,
  avatar = "",
): HostRoom {
  return new HostRoom(name, title, handlers, QUICK_MATCH_CODE, onTaken, true, avatar);
}

export function joinRoom(code: string, name: string, handlers: RoomHandlers, title = "", avatar = "", joinTimeoutMs = 9000): GuestRoom {
  return new GuestRoom(code, name, title, handlers, avatar, joinTimeoutMs);
}

export function isHost(r: Room): r is HostRoom {
  return r instanceof HostRoom;
}

/* ================== الماتشينج العام (بدون كود) ================== */

export interface QuickMatchHandle {
  /** الغرفة الحالية (مضيف أو ضيف) — بتتغير أثناء البحث */
  room(): Room | null;
  isHost(): boolean;
  destroy(): void;
}

/**
 * ماتشينج حقيقي: كل اللاعيبة بيجربوا نفس ترتيب الخانات،
 * فأول واحد بيمسك الخانة ويستنى، واللي بعده بيلاقيه فيها على طول.
 * لو الخانة مليانة/شغالة/معلّقة → بينتقل للخانة اللي بعدها تلقائيًا.
 */
export function startQuickMatch(opts: {
  name: string;
  title: string;
  avatar: string;
  handlers: RoomHandlers;
  onRoom: (room: Room, isHost: boolean) => void;
  onStatus?: (slot: number, total: number) => void;
}): QuickMatchHandle {
  const { name, title, avatar, handlers, onRoom, onStatus } = opts;
  let current: Room | null = null;
  let host = false;
  let idx = 0;
  let killed = false;

  const cleanup = () => { try { current?.destroy(); } catch { /* اتجاهل */ } current = null; };

  const attempt = () => {
    if (killed) return;
    if (idx >= QUICK_SLOTS.length) {
      // كل الخانات مشغولة — نرجع لأول خانة ونستنى مكان يفضى
      idx = 0;
      setTimeout(() => { if (!killed) attempt(); }, 2500);
      handlers.onError?.("كل الغرف العامة مليانة دلوقتي… بنعيد المحاولة");
      return;
    }
    const slot = QUICK_SLOTS[idx];
    onStatus?.(idx + 1, QUICK_SLOTS.length);

    // نجرب نمسك الخانة كمضيف؛ لو متاخدة يبقى فيه حد مستني → ندخل عنده
    const hostRoom = new HostRoom(
      name, title,
      { ...handlers, onBusy: undefined },
      slot,
      () => {
        // الخانة متاخدة: ندخل كضيف على نفس الخانة
        if (killed) return;
        const guest = new GuestRoom(
          slot, name, title,
          {
            ...handlers,
            onBusy: () => {
              // مليانة أو الجولة شغالة أو معلّقة → الخانة اللي بعدها
              if (killed) return;
              cleanup();
              idx += 1;
              setTimeout(attempt, 250);
            },
          },
          avatar,
          6500,
        );
        current = guest;
        host = false;
        onRoom(guest, false);
      },
      true,
      avatar,
    );
    current = hostRoom;
    host = true;
    onRoom(hostRoom, true);
  };

  attempt();

  return {
    room: () => current,
    isHost: () => host,
    destroy: () => { killed = true; cleanup(); },
  };
}

/** حساب جنيه اللاعب من نتيجة الجولة */
export function coinsFromResults(results: NetResults, myId: string): number {
  const me = results.rows.find((x) => x.id === myId);
  if (!me) return 0;
  const win = results.rows.length >= 2 && results.rows[0].id === myId;
  return me.roundPts + me.bonus + (win ? 25 : 0);
}
