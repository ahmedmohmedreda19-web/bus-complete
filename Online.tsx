import { useEffect, useMemo, useRef, useState } from "react";
import { Users, Play, Copy, Check, Crown, LogOut, Globe, LoaderCircle, UserRound, KeyRound, Bus, Coins, BadgeCheck, ShoppingBag, ClipboardCheck, Radio, Zap, TimerReset, Repeat2, Link2, ChevronLeft, UserPlus } from "lucide-react";
import Game, { type RoundAnswer, type NetUI } from "./Game";
import OnlineResults from "./OnlineResults";
import OnlineReview from "./OnlineReview";
import Shop from "./Shop";
import BlitzGame, { type BlitzNet } from "./BlitzGame";
import ChainOnline, { type ChainNet } from "./ChainOnline";
import AccountFriends from "./AccountFriends";
import type { ChainState } from "../lib/chainTypes";
import type { BlitzQuestion, BlitzRow } from "../lib/blitz";
import { submitRecord } from "../lib/globalBoard";
import Avatar from "./Avatar";
import PlayerCard, { type CardPlayer } from "./PlayerCard";
import { useProfile } from "../lib/profile";
import { createRoom, joinRoom, isHost, startQuickMatch, MAX_PLAYERS, QUICK_SLOTS, coinsFromResults, type Room, type QuickMatchHandle, type NetPlayer, type NetResults, type LikeMap, type ReviewData } from "../net/online";
import { getTitleLabel, earn, earnGems, useWallet } from "../lib/wallet";
import { pushHistory, loadStats, bumpStats } from "../lib/storage";
import { checkAchievements, isFlawlessRound, isPerfectRound, noteRound, noteLike } from "../lib/achievements";
import { consumeInviteFromUrl, getInviteLinks } from "../lib/friends";
import { sfx } from "../lib/sound";
import { fx, PALETTES } from "../lib/fx";

/** تفاعلات سريعة: إيموجي + عبارة تظهر لكل اللاعيبة */
const REACTIONS = [
  { e: "😂", label: "ضحكتني!" },
  { e: "🔥", label: "حريقة!" },
  { e: "🍿", label: "شايفك بتغش!" },
  { e: "👏", label: "عاش يا بطل" },
  { e: "😱", label: "إزاي عرفتها؟!" },
  { e: "🐢", label: "يلا بسرعة" },
];
const REACTION_LABEL: Record<string, string> = Object.fromEntries(REACTIONS.map((r) => [r.e, r.label]));
const NET_RND_MS = 75_000;

type OPhase = "hub" | "lobby" | "play" | "review" | "results" | "blitz" | "chain";

export default function Online({
  initialName, muted, onToggleMute, onNameUsed, onExit,
}: {
  initialName: string;
  muted: boolean;
  onToggleMute: () => void;
  onNameUsed: (n: string) => void;
  onExit: () => void;
}) {
  const [phase, setPhase] = useState<OPhase>("hub");
  const [name, setName] = useState(initialName);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [players, setPlayers] = useState<NetPlayer[]>([]);
  const [myId, setMyId] = useState("");
  const [hostPeerId, setHostPeerId] = useState("");
  const [amHost, setAmHost] = useState(false);
  const [letter, setLetter] = useState("");
  const [remMs, setRemMs] = useState(75_000);
  const [waiting, setWaiting] = useState(false);
  const [results, setResults] = useState<NetResults | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [shopOpen, setShopOpen] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [quickMode, setQuickMode] = useState(false);
  const [quickCountdown, setQuickCountdown] = useState(0);
  const [searchSlot, setSearchSlot] = useState(0);
  const [likes, setLikes] = useState<LikeMap>({});
  const [likedByMe, setLikedByMe] = useState<Set<string>>(() => new Set());
  const [cardPlayer, setCardPlayer] = useState<CardPlayer | null>(null);
  const [roundMs, setRoundMs] = useState(NET_RND_MS);
  const [roundsOf, setRoundsOf] = useState(0);
  const [roundNo, setRoundNo] = useState(0);
  const [chatToasts, setChatToasts] = useState<{ id: string; e: string; k: number }[]>([]);
  const [reactOpen, setReactOpen] = useState(false);
  const [blitzQ, setBlitzQ] = useState<BlitzQuestion | null>(null);
  const [blitzDeadline, setBlitzDeadline] = useState(0);
  const [blitzRows, setBlitzRows] = useState<BlitzRow[]>([]);
  const [blitzOver, setBlitzOver] = useState(false);
  const [chainState, setChainState] = useState<ChainState | null>(null);
  const [chainMsg, setChainMsg] = useState<{ id: string; ok: boolean; text: string; k: number } | null>(null);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const invites = useMemo(() => getInviteLinks({ roomCode: code }), [code]);

  const shareText = async () => {
    try { await navigator.clipboard.writeText(invites.text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* اتجاهل */ }
  };
  const wallet = useWallet();
  const profile = useProfile();

  const roomRef = useRef<Room | null>(null);
  const matcherRef = useRef<QuickMatchHandle | null>(null);
  const myIdRef = useRef("");
  const statsSentRef = useRef(false);
  const processedResultsRef = useRef<Set<string>>(new Set());
  const likedByMeRef = useRef<Set<string>>(new Set());
  myIdRef.current = myId;

  useEffect(() => () => { matcherRef.current?.destroy(); roomRef.current?.destroy(); }, []);

  useEffect(() => {
    const invite = consumeInviteFromUrl();
    if (invite.roomCode) {
      setJoinCode(invite.roomCode);
      setNotice(`تم التقاط كود الغرفة ${invite.roomCode}`);
    }
  }, []);

  const makeHandlers = () => ({
    onCode: (c: string) => {
      setCode(c);
      setBusy(false);
      setErr("");
      setPhase("lobby");
      if (roomRef.current) { setMyId(roomRef.current.myId); setHostPeerId(roomRef.current.myId); }
    },
    onPlayers: (ps: NetPlayer[]) => {
      setPlayers(ps);
      setBusy(false);
      setErr("");
      // شارك إحصائياتك مع الغرفة (مرة واحدة)
      const r0 = roomRef.current;
      if (r0 && !statsSentRef.current) {
        statsSentRef.current = true;
        const st = loadStats();
        try { if (isHost(r0)) r0.setHostStats(st); else r0.sendStats(st); } catch { /* اتجاهل */ }
        try { if (isHost(r0)) r0.shareBoard(); else r0.sendBoard(); } catch { /* اتجاهل */ }
      }
      setPhase((p) => (p === "hub" ? "lobby" : p));
      if (roomRef.current?.myId) setMyId((cur) => cur || roomRef.current!.myId);
    },
    onProgress: (id: string, count: number) =>
      setPlayers((ps) => ps.map((p) => (p.id === id ? { ...p, count } : p))),
    onStart: (l: string, rnd?: number, dur?: number, of?: number) => {
      setLetter(l);
      setResults(null);
      setLikes({});
      likedByMeRef.current = new Set();
      setLikedByMe(new Set());
      setWaiting(false);
      setReviewData(null);
      setPlayers((ps) => ps.map((p) => ({ ...p, count: 0 })));
      const d = dur && dur > 0 ? dur : NET_RND_MS;
      setRoundMs(d);
      setRoundNo(rnd ?? 0);
      setRoundsOf(of ?? 0);
      setRemMs(d);
      setGameKey((k) => k + 1);
      setReactOpen(false);
      sfx.ensure();
      setPhase("play");
    },
    onTick: (rem: number) => setRemMs(rem),
    onReconnecting: (active: boolean) => setReconnecting(active),
    onLikes: (l: LikeMap) => setLikes(l ?? {}),
    onLikeAccepted: () => {
      // الإنجاز يتحرك بعد إقرار المضيف فقط، مش بمجرد الضغط على القلب.
      noteLike();
      checkAchievements();
    },
    onChat: (id: string, e: string) => {
      setChatToasts((t) => [...t.slice(-3), { id, e, k: Date.now() + Math.random() }]);
      setTimeout(() => setChatToasts((t) => t.slice(1)), 2600);
      try { sfx.tick(); } catch { /* اتجاهل */ }
    },
    onBlitzQuestion: (q: BlitzQuestion, dl: number, rows: BlitzRow[]) => {
      setBlitzQ(q);
      setBlitzDeadline(dl);
      setBlitzRows(rows);
      setBlitzOver(false);
      setPhase("blitz");
      sfx.ensure();
    },
    onBoard: () => { /* اتدمجت جوه الطبقة */ },
    onChainState: (st: ChainState) => {
      setChainState(st);
      setPhase("chain");
      if (st.over) {
        try {
          const me = st.players.find((p) => p.id === myIdRef.current);
          if (me) {
            earn(Math.round(me.score * 0.7));
            const won = st.players.length > 1 && [...st.players].sort((a, b) => b.score - a.score)[0]?.id === me.id;
            bumpStats({ score: me.score, words: me.words, won });
            submitRecord({ name: profile.name || me.name, avatar: profile.avatar, score: me.score, mode: "chain" });
            if (won) noteRound({ flawless: false, perfect: false, onlineWin: true });
            checkAchievements();
            const rc = roomRef.current;
            try { if (rc && isHost(rc)) rc.shareBoard(); else if (rc) rc.sendBoard(); } catch { /* اتجاهل */ }
          }
          sfx.fanfare();
          fx.rain(PALETTES.win, 110);
        } catch { /* اتجاهل */ }
      }
      sfx.ensure();
    },
    onChainMsg: (id: string, ok: boolean, text: string) => {
      setChainMsg({ id, ok, text, k: Date.now() });
      try { ok ? sfx.correct() : sfx.bad(); } catch { /* اتجاهل */ }
      setTimeout(() => setChainMsg((m) => (m && Date.now() - m.k > 1400 ? null : m)), 1600);
    },
    onBlitzRows: (rows: BlitzRow[]) => setBlitzRows(rows),
    onBlitzEnd: (rows: BlitzRow[]) => {
      setBlitzRows(rows);
      setBlitzOver(true);
      setPhase("blitz");
      try {
        const me = rows.find((r) => r.id === myIdRef.current);
        if (me) {
          earn(Math.round(me.score * 0.8));
          const won = rows.length > 1 && rows[0]?.id === me.id;
          bumpStats({ score: me.score, words: 0, won });
          if (won) noteRound({ flawless: false, perfect: false, onlineWin: true });
          submitRecord({ name: profile.name || me.name, avatar: profile.avatar, score: me.score, mode: "blitz" });
          const rb = roomRef.current;
          try { if (rb && isHost(rb)) rb.shareBoard(); else if (rb) rb.sendBoard(); } catch { /* اتجاهل */ }
          checkAchievements();
        }
        sfx.fanfare();
        fx.rain(PALETTES.win, 110);
      } catch { /* اتجاهل */ }
    },
    onReviewing: () => setPhase("review"),
    onReviewData: (data: ReviewData) => setReviewData(data),
    onResults: (r: NetResults) => {
      // توحيد شكل النتايج: أي رسالة ناقصة ما توقفش الشاشة
      if (!r || !Array.isArray(r.rows)) return;
      const safe: NetResults = {
        letter: r.letter ?? "",
        round: r.round ?? 0,
        rows: r.rows.filter((row) => row && row.id && typeof row.name === "string"),
      };
      setResults(safe);
      setWaiting(false);
      const resultKey = `${safe.round}|${safe.letter}`;
      if (processedResultsRef.current.has(resultKey)) {
        setPhase("results");
        return;
      }
      processedResultsRef.current.add(resultKey);
      try {
        earn(coinsFromResults(safe, myIdRef.current));
        const me = safe.rows.find((r) => r.id === myIdRef.current);
        if (me) {
          pushHistory({ d: Date.now(), letter: safe.letter, score: me.roundPts + me.bonus, mode: "online" });
          const wordCount = Object.values(me.answers).filter((a) => a?.verdict && a.verdict.t !== "bad").length;
          const won = safe.rows.length > 1 && safe.rows[0].id === me.id;
          const fresh = bumpStats({ score: me.roundPts + me.bonus, words: wordCount, won });
          const r2 = roomRef.current;
          try { if (r2 && isHost(r2)) r2.setHostStats(fresh); else if (r2) r2.sendStats(fresh); } catch { /* اتجاهل */ }
          submitRecord({ name: profile.name || me.name, avatar: profile.avatar, score: me.roundPts + me.bonus, mode: "online" });
          const rr = roomRef.current;
          try { if (rr && isHost(rr)) rr.shareBoard(); else if (rr) rr.sendBoard(); } catch { /* اتجاهل */ }
          const attempted = Object.values(me.answers).filter(Boolean).length;
          noteRound({
            flawless: isFlawlessRound(attempted, wordCount),
            perfect: isPerfectRound(Object.keys(me.answers).length, wordCount),
            onlineWin: won,
          });
          checkAchievements();
          // جوهرة الفوز التنافسي: الفوز على ٣ لاعيبة أو أكتر — من أصعب الطرق
          if (won && safe.rows.length >= 3) earnGems(1);
        }
      } catch { /* اتجاهل */ }
      try { sfx.correct(); } catch { /* اتجاهل */ }
      try { fx.burst(window.innerWidth / 2, window.innerHeight / 3, PALETTES.win, 50, 8); } catch { /* اتجاهل */ }
      setPhase("results");
    },
    onClosed: (reason: string) => {
      roomRef.current = null;
      setNotice(reason);
      setPlayers([]);
      setBusy(false);
      setPhase("hub");
    },
    onError: (m: string) => { setErr(m); setBusy(false); },
  });

  const doCreate = () => {
    const nm = name.trim() || "النجم";
    onNameUsed(nm);
    setName(nm);
    setErr(""); setNotice(""); setBusy(true);
    setAmHost(true);
    setQuickMode(false);
    statsSentRef.current = false;
    processedResultsRef.current.clear();
    roomRef.current?.destroy();
    sfx.ensure();
    roomRef.current = createRoom(nm, makeHandlers(), getTitleLabel(), profile.avatar);
  };

  const doJoin = () => {
    const nm = name.trim() || "النجم";
    const c = joinCode.trim().toUpperCase();
    if (c.length < 5) { setErr("اكتب كود الغرفة (٥ حروف)"); return; }
    onNameUsed(nm);
    setName(nm);
    setErr(""); setNotice(""); setBusy(true);
    setAmHost(false);
    setQuickMode(false);
    statsSentRef.current = false;
    processedResultsRef.current.clear();
    roomRef.current?.destroy();
    sfx.ensure();
    const room = joinRoom(c, nm, makeHandlers(), getTitleLabel(), profile.avatar);
    roomRef.current = room;
    setHostPeerId(room.hostId);
  };

  /** لعب سريع: ماتشينج حقيقي على خانات عامة — بدون كود. */
  const doQuickMatch = () => {
    const nm = name.trim() || "النجم";
    onNameUsed(nm);
    setName(nm);
    setErr(""); setNotice(""); setBusy(true);
    setQuickMode(true);
    statsSentRef.current = false;
    processedResultsRef.current.clear();
    setAmHost(true);
    setSearchSlot(1);
    matcherRef.current?.destroy();
    roomRef.current?.destroy();
    sfx.ensure();

    const handlers = makeHandlers();
    matcherRef.current = startQuickMatch({
      name: nm,
      title: getTitleLabel(),
      avatar: profile.avatar,
      handlers,
      onStatus: (slot) => setSearchSlot(slot),
      onRoom: (room, asHost) => {
        roomRef.current = room;
        setAmHost(asHost);
        if (!asHost && !isHost(room)) setHostPeerId(room.hostId);
      },
    });
  };

  const leave = () => {
    matcherRef.current?.destroy();
    matcherRef.current = null;
    roomRef.current?.destroy();
    roomRef.current = null;
    onExit();
  };

  const startRound = () => {
    if (roomRef.current && isHost(roomRef.current)) roomRef.current.startRound();
  };

  const startBlitz = () => {
    const r = roomRef.current;
    if (r && isHost(r)) { setBlitzOver(false); r.startBlitz(); }
  };

  const startChain = () => {
    const r = roomRef.current;
    if (r && isHost(r)) { setChainState(null); r.startChain(); }
  };

  const chainNet: ChainNet = {
    state: chainState,
    myId,
    onWord: (word: string) => {
      const r = roomRef.current;
      if (!r) return;
      try { if (isHost(r)) r.hostChainWord(word); else r.sendChainWord(word); } catch { /* اتجاهل */ }
    },
  };

  const blitzNet: BlitzNet = {
    question: blitzQ,
    deadline: blitzDeadline,
    rows: blitzRows,
    myId,
    over: blitzOver,
    onAnswer: (word: string) => {
      const r = roomRef.current;
      if (!r) return;
      try { if (isHost(r)) r.hostBlitzAnswer(word); else r.sendBlitzAnswer(word); } catch { /* اتجاهل */ }
    },
  };

  // في المباراة العامة تبدأ الجولة تلقائيًا بعد تجمع لاعبين.
  useEffect(() => {
    const connected = players.filter((p) => p.connected).length;
    if (!quickMode || !amHost || phase !== "lobby" || connected < 2) {
      setQuickCountdown(0);
      return;
    }
    setQuickCountdown(5);
    const ticker = setInterval(() => setQuickCountdown((n) => Math.max(0, n - 1)), 1000);
    const starter = setTimeout(startRound, 5000);
    return () => { clearInterval(ticker); clearTimeout(starter); };
  }, [quickMode, amHost, phase, players.filter((p) => p.connected).length]);

  const net: NetUI = {
    remMs,
    roundMs,
    waiting,
    players,
    myId,
    onLock: (cat, text) => {
      const r = roomRef.current;
      if (!r) return;
      if (isHost(r)) r.hostLock(cat, text); else r.sendLock(cat, text);
    },
    onStop: () => {
      const r = roomRef.current;
      if (!r) return;
      sfx.horn();
      setWaiting(true);
      if (isHost(r)) r.hostStop(); else r.sendStop();
    },
  };

  const noopFinish = (_a: RoundAnswer[], _s: number, _b: number, _st: boolean) => { /* أونلاين بس */ };

  /** إعجاب على إجابة لاعب */
  const sendLike = (target: string, cat: string) => {
    const r = roomRef.current;
    if (!r || target === myId) return;
    const key = `${target}|${cat}`;
    if (likedByMeRef.current.has(key)) return;
    likedByMeRef.current.add(key);
    setLikedByMe(new Set(likedByMeRef.current));
    try {
      if (isHost(r)) r.hostLike(target, cat as never);
      else r.sendLike(target, cat as never);
      sfx.ok();
    } catch {
      likedByMeRef.current.delete(key);
      setLikedByMe(new Set(likedByMeRef.current));
    }
  };

  /** فتح كارت لاعب */
  const openCard = (id: string) => {
    const p = players.find((x) => x.id === id);
    if (!p) return;
    setCardPlayer({
      id: p.id, name: p.name, avatar: p.avatar, title: p.title,
      stats: p.stats, isHost: p.id === hostPeerId, isMe: p.id === myId,
    });
  };

  /** إرسال رد فعل سريع */
  const sendChat = (e: string) => {
    const r = roomRef.current;
    if (!r) return;
    const k = Date.now() + Math.random();
    setChatToasts((t) => [...t.slice(-3), { id: myId, e, k }]);
    setTimeout(() => setChatToasts((t) => t.filter((x) => x.k !== k)), 2600);
    try {
      if (isHost(r)) r.hostChat(e);
      else r.sendChat(e);
      sfx.tick();
    } catch { /* اتجاهل */ }
  };

  /** شريط التفاعلات السريعة (اللوبي والنتايج) */
  const ChatBar = ({ className = "" }: { className?: string }) => (
    <div className={`flex items-center justify-center gap-1.5 flex-wrap ${className}`} dir="rtl">
      {REACTIONS.map((r) => (
        <button
          key={r.e}
          onClick={() => sendChat(r.e)}
          className="btn-ghost px-2.5 py-1.5 flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-transform"
          aria-label={r.label}
        >
          <span className="text-base leading-none">{r.e}</span>
          <span className="text-[10px] font-extrabold text-white/60">{r.label}</span>
        </button>
      ))}
    </div>
  );

  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? "لاعب";

  /** لوحة تفاعلات عائمة أثناء اللعب — ما تزنقش الكيبورد */
  const ReactionDock = (
    <div className="fixed bottom-24 left-3 z-[72] flex flex-col items-start gap-2" dir="rtl">
      {reactOpen && (
        <div className="rounded-3xl bg-[#1c2438]/97 border border-amber-300/40 p-2 shadow-2xl pop-in flex flex-col gap-1 max-h-64 overflow-y-auto">
          {REACTIONS.map((r) => (
            <button
              key={r.e}
              onClick={() => { sendChat(r.e); setReactOpen(false); }}
              className="flex items-center gap-2 rounded-2xl px-2.5 py-2 hover:bg-white/10 active:scale-95 transition-all text-right"
            >
              <span className="text-xl leading-none">{r.e}</span>
              <span className="text-[11px] font-extrabold text-white/75 whitespace-nowrap">{r.label}</span>
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setReactOpen((o) => !o)}
        className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-xl transition-all active:scale-95 ${
          reactOpen
            ? "bg-rose-500 text-white rotate-45"
            : "bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950 hover:scale-105"
        }`}
        aria-label={reactOpen ? "اقفل التفاعلات" : "ابعت تفاعل"}
      >
        {reactOpen ? "✕" : "😂"}
      </button>
    </div>
  );

  /** ردود الفعل العائمة */
  const ChatToasts = (
    <div className="fixed inset-x-0 top-14 z-[75] flex flex-col items-center gap-1.5 pointer-events-none px-3" dir="rtl">
      {chatToasts.map((t) => (
        <div key={t.k} className="pop-in rounded-2xl bg-[#232c45]/95 border border-amber-300/45 pr-2 pl-3.5 py-1.5 flex items-center gap-2 font-bold text-sm shadow-2xl">
          <Avatar src={players.find((p) => p.id === t.id)?.avatar} name={playerName(t.id)} size={26} />
          <span className="text-2xl leading-none reaction-pop">{t.e}</span>
          <span className="min-w-0">
            <span className="block text-[10px] font-extrabold text-white/45 leading-3 truncate max-w-28">{playerName(t.id)}</span>
            <span className="block text-amber-100 leading-4">{REACTION_LABEL[t.e] ?? ""}</span>
          </span>
        </div>
      ))}
    </div>
  );

  /* ============ الهب ============ */
  if (phase === "hub") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-5 max-w-md mx-auto w-full">
        <div className="text-center rise-in">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-400/10 border border-emerald-300/20 flex items-center justify-center mb-2">
            <Globe className="w-6 h-6 text-emerald-200" />
          </div>
          <h1 className="font-display text-3xl font-extrabold">العب أونلاين</h1>
          <p className="text-white/40 font-bold text-xs mt-1">مباراة عامة أو غرفة خاصة</p>
          <button
            onClick={() => setShopOpen(true)}
            className="inline-flex items-center gap-1.5 mt-2 rounded-full bg-white/[.04] border border-white/10 px-2.5 py-1 text-[11px] font-bold text-white/50 hover:text-amber-200 transition-colors"
          >
            <Coins className="w-3.5 h-3.5 text-amber-300" />
            {wallet.coins.toLocaleString("ar-EG")}
            <ShoppingBag className="w-3 h-3" />
          </button>
        </div>

        <div className="w-full mt-4 space-y-2.5">
          <div className="glass rounded-2xl p-3 rise-in" style={{ animationDelay: ".05s" }}>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-white/45 mb-1.5">
              <UserRound className="w-3.5 h-3.5 text-amber-300" /> اسم اللاعب
            </label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={16}
              placeholder="اسمك"
              className="w-full h-10 bg-[#141b2e]/55 border border-white/10 rounded-xl px-3 text-sm font-bold outline-none focus:border-amber-300/40 placeholder:text-white/25"
            />
          </div>

          <button
            onClick={doQuickMatch}
            disabled={busy}
            className="w-full rounded-2xl border border-emerald-300/25 bg-emerald-400/[.07] px-3 py-3 text-right hover:bg-emerald-400/10 transition-colors rise-in"
            style={{ animationDelay: ".08s" }}
          >
            <span className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-emerald-400/15 text-emerald-200 flex items-center justify-center shrink-0">
                {busy && quickMode ? <LoaderCircle className="w-4.5 h-4.5 animate-spin" /> : <Radio className="w-4.5 h-4.5" />}
              </span>
              <span className="flex-1">
                <span className="block font-display text-base font-bold text-emerald-100">مباراة عامة</span>
                <span className="block text-[10px] font-bold text-white/35">بدون كود</span>
              </span>
              <ChevronLeft className="w-4 h-4 text-white/25" />
            </span>
          </button>

          <div className="flex items-center gap-2 text-[10px] font-bold text-white/25 px-2">
            <span className="h-px bg-white/10 flex-1" />
            غرفة خاصة
            <span className="h-px bg-white/10 flex-1" />
          </div>

          {notice && (
            <div className="rounded-2xl bg-sky-400/10 border border-sky-300/25 text-sky-200 text-sm font-bold px-4 py-3 pop-in">{notice}</div>
          )}
          {err && (
            <div className="rounded-2xl bg-rose-400/10 border border-rose-300/25 text-rose-200 text-sm font-bold px-4 py-3 pop-in">{err}</div>
          )}

          <button onClick={doCreate} disabled={busy} className="btn-primary w-full h-11 text-sm flex items-center justify-center gap-2 rise-in" style={{ animationDelay: ".1s" }}>
            {busy && amHost ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            اعمل غرفة
          </button>

          <div className="glass rounded-2xl p-3 rise-in" style={{ animationDelay: ".15s" }}>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-white/45 mb-1.5">
              <KeyRound className="w-3.5 h-3.5 text-sky-300" /> كود الغرفة
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                dir="ltr"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 5))}
                placeholder="ABCDE"
                autoComplete="off"
                className="flex-1 min-w-0 h-10 bg-[#141b2e]/55 border border-white/10 rounded-xl px-3 text-center font-display text-base tracking-[.38em] font-bold outline-none focus:border-sky-300/40 placeholder:text-white/15"
              />
              <button onClick={doJoin} disabled={busy} className="btn-primary h-10 px-4 font-display text-sm flex items-center gap-1.5">
                {busy && !amHost ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                ادخل
              </button>
            </div>
          </div>

          <button onClick={() => setFriendsOpen(true)} className="w-full h-9 flex items-center justify-center gap-1.5 text-xs font-bold text-sky-200/80 hover:text-sky-100 rise-in" style={{ animationDelay: ".18s" }}>
            <UserPlus className="w-3.5 h-3.5" /> أصدقاء ودعوات
          </button>
          <button onClick={onExit} className="w-full h-9 flex items-center justify-center gap-1.5 text-xs font-bold text-white/35 hover:text-white/60 rise-in" style={{ animationDelay: ".2s" }}>
            <LogOut className="w-3.5 h-3.5" /> رجوع
          </button>
        </div>
        {shopOpen && <Shop onClose={() => setShopOpen(false)} />}
        {friendsOpen && <AccountFriends onClose={() => setFriendsOpen(false)} />}
      </div>
    );
  }

  /* ============ اللوبي ============ */
  if (phase === "lobby") {
    const connected = players.filter((p) => p.connected);
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-5 max-w-md mx-auto w-full">
        <div className="w-full text-center rise-in">
          <div className="inline-flex items-center gap-2 text-white/60 font-bold text-sm">
            {quickMode ? <Radio className="w-4 h-4 text-emerald-300" /> : <Bus className="w-4 h-4 text-amber-300" />}
            {quickMode ? "مباراة عامة — بنجمع لاعيبة" : "الأتوبيس في المحطة — وزّع الكود"}
          </div>
          {quickMode ? (
            <div className="mt-3 flex flex-col items-center">
              <span className="relative w-12 h-12 rounded-full border border-emerald-300/25 bg-emerald-400/[.06] flex items-center justify-center">
                <LoaderCircle className="w-6 h-6 text-emerald-300 animate-spin" />
                <span className="absolute inset-0 rounded-full border border-emerald-300/20 animate-ping" />
              </span>
              <p className="font-display font-bold text-base text-emerald-100 mt-2">
                {connected.length < 2
                  ? "بندوّر على لاعيبة…"
                  : `الماتش هيبدأ خلال ${quickCountdown.toLocaleString("ar-EG")}`}
              </p>
              {connected.length < 2 ? (
                <>
                  <p className="text-[10px] font-bold text-white/35 mt-1">بحث {searchSlot.toLocaleString("ar-EG")}/{QUICK_SLOTS.length.toLocaleString("ar-EG")}</p>
                  <div className="flex items-center justify-center gap-1 mt-2">
                    {QUICK_SLOTS.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 rounded-full transition-all ${
                          i + 1 === searchSlot ? "w-5 bg-emerald-400" : i + 1 < searchSlot ? "w-2 bg-emerald-400/35" : "w-2 bg-white/12"
                        }`}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-[10px] font-bold text-white/35 mt-1">البداية تلقائية</p>
              )}
            </div>
          ) : (
            <div className="mt-3">
              <button
                onClick={() => {
                  try { navigator.clipboard.writeText(code); } catch { /* اتجاهل */ }
                  setCopied(true); setTimeout(() => setCopied(false), 1500);
                }}
                className="block mx-auto group"
              >
                <div dir="ltr" className="font-display text-4xl font-bold tracking-[.3em] pr-[.3em] text-amber-200">
                  {code}
                </div>
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-white/50 mt-2 group-hover:text-white/75 transition-colors">
                  {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  {copied ? "اتنسخ!" : "اضغط للنسخ"}
                </div>
              </button>
              {/* شارك الكود على أي منصة */}
              <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
                <span className="text-[9px] font-bold text-white/30">أو شارك:</span>
                <a href={invites.whatsapp} target="_blank" rel="noreferrer" className="h-8 px-2.5 rounded-lg bg-emerald-400/15 border border-emerald-300/30 text-emerald-200 text-[10px] font-bold flex items-center gap-1">
                  واتساب
                </a>
                <a href={invites.messenger} target="_blank" rel="noreferrer" className="h-8 px-2.5 rounded-lg bg-sky-400/15 border border-sky-300/30 text-sky-200 text-[10px] font-bold flex items-center gap-1">
                  ماسنجر
                </a>
                <a href={invites.telegram} target="_blank" rel="noreferrer" className="h-8 px-2.5 rounded-lg bg-cyan-400/15 border border-cyan-300/30 text-cyan-200 text-[10px] font-bold flex items-center gap-1">
                  تلجرام
                </a>
                <a href={invites.mail} target="_blank" rel="noreferrer" className="h-8 px-2.5 rounded-lg bg-amber-400/15 border border-amber-300/30 text-amber-200 text-[10px] font-bold flex items-center gap-1">
                  ميل
                </a>
                <a href={invites.instagram.url} target="_blank" rel="noreferrer" onClick={shareText} className="h-8 px-2.5 rounded-lg bg-fuchsia-400/15 border border-fuchsia-300/30 text-fuchsia-200 text-[10px] font-bold flex items-center gap-1">
                  إنستا
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-3 w-full mt-4 rise-in" style={{ animationDelay: ".08s" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-display font-bold text-sm">اللاعبون ({connected.length.toLocaleString("ar-EG")}/{MAX_PLAYERS.toLocaleString("ar-EG")})</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <div className="space-y-1">
            {players.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center gap-2 rounded-xl px-2.5 py-2 border font-bold pop-in ${
                  p.id === myId ? "bg-amber-400/12 border-amber-300/35" : "bg-white/[.04] border-white/8"
                }`}
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <button onClick={() => openCard(p.id)} className="shrink-0 hover:scale-105 transition-transform" aria-label={`بروفايل ${p.name}`}>
                  <Avatar src={p.avatar} name={p.name} size={28} ring={p.id === myId} />
                </button>
                <span className={`w-2 h-2 rounded-full shrink-0 ${p.connected ? "bg-emerald-400" : "bg-white/25"}`} />
                <span className="flex-1 truncate">
                  <span className="text-xs">{p.name}</span> {p.id === myId && <span className="text-[9px] text-white/35">أنت</span>}
                  {p.title && (
                    <span className="hidden sm:inline-flex items-center gap-1 mr-2 text-[9px] font-extrabold text-amber-300/70">
                      <BadgeCheck className="w-3 h-3" />{p.title}
                    </span>
                  )}
                </span>
                {p.id === hostPeerId && (
                  <span className="flex items-center text-amber-300/70">
                    <Crown className="w-3.5 h-3.5" />
                  </span>
                )}
                {!p.connected && <span className="text-[11px] font-bold text-rose-300/80">فصل</span>}
              </div>
            ))}
          </div>
        </div>

        {/* إعدادات المضيف: مدة الجولة وعدد الجولات */}
        {amHost && !quickMode && roomRef.current && isHost(roomRef.current) && (
          <div className="glass rounded-2xl p-3 w-full mt-3 rise-in" style={{ animationDelay: ".12s" }}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-white/60 mb-1.5">
                  <TimerReset className="w-4 h-4 text-sky-300" /> مدة الجولة
                </div>
                <div className="flex gap-1.5">
                  {[75_000, 45_000, 25_000].map((ms) => (
                    <button
                      key={ms}
                      onClick={() => { const r = roomRef.current; if (r && isHost(r)) { r.setRoundMs(ms); setRoundMs(ms); } }}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-extrabold border transition-colors ${roundMs === ms ? "bg-sky-400/20 border-sky-300/60 text-sky-100" : "bg-white/6 border-white/12 text-white/55 hover:bg-white/10"}`}
                    >
                      {(ms / 1000).toLocaleString("ar-EG")}ث
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-white/60 mb-1.5">
                  <Repeat2 className="w-4 h-4 text-violet-300" /> عدد الجولات
                </div>
                <div className="flex gap-1.5">
                  {[[1, "واحدة"], [3, "٣"], [5, "٥"], [0, "∞"]].map(([n, label]) => (
                    <button
                      key={String(n)}
                      onClick={() => { const r = roomRef.current; if (r && isHost(r)) { r.setMaxRounds(n as number); setRoundsOf(n as number); } }}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-extrabold border transition-colors ${roundsOf === n ? "bg-violet-400/20 border-violet-300/60 text-violet-100" : "bg-white/6 border-white/12 text-white/55 hover:bg-white/10"}`}
                    >
                      {label as string}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="w-full mt-3 rise-in" style={{ animationDelay: ".14s" }}>
          {quickMode ? (
            <div className="glass rounded-2xl py-4 flex items-center justify-center gap-2 font-bold text-white/70">
              <LoaderCircle className="w-5 h-5 text-emerald-300 animate-spin" />
              {connected.length < 2 ? "جاري البحث عن منافسين…" : "استعد، الجولة هتبدأ تلقائيًا"}
            </div>
          ) : amHost ? (
            <>
              <button onClick={startRound} disabled={connected.length < 2} className="btn-primary w-full h-11 text-sm flex items-center justify-center gap-2">
                <Play className="w-4 h-4 fill-current" /> ابدأ اللعبة
              </button>
              <button
                onClick={startChain}
                disabled={connected.length < 2}
                className="w-full h-10 mt-1.5 rounded-xl flex items-center justify-center gap-2 font-display text-sm font-bold text-cyan-100 border border-cyan-300/25 bg-cyan-400/[.06] disabled:opacity-50"
              >
                <Link2 className="w-5 h-5 text-cyan-300" /> وصلة الحروف
              </button>
              <button
                onClick={startBlitz}
                disabled={connected.length < 2}
                className="w-full h-10 mt-1.5 rounded-xl flex items-center justify-center gap-2 font-display text-sm font-bold text-rose-100 border border-rose-300/25 bg-rose-400/[.06] disabled:opacity-50"
              >
                <Zap className="w-5 h-5 text-rose-300" /> تحدي الخمس ثواني
              </button>
              {connected.length < 2 && (
                <p className="text-center text-xs font-bold text-white/40 mt-2">استنى لاعب واحد على الأقل يدخل عشان تبدأ</p>
              )}
            </>
          ) : (
            <div className="glass rounded-2xl py-4 flex items-center justify-center gap-2 font-bold text-white/70">
              <LoaderCircle className="w-5 h-5 text-amber-300 animate-spin" />
              مستني المضيف يضغط «ابدأ»…
            </div>
          )}
        </div>

        <ChatBar className="w-full mt-2" />
        {ChatToasts}
        {cardPlayer && <PlayerCard player={cardPlayer} onClose={() => setCardPlayer(null)} />}

        <button onClick={() => setFriendsOpen(true)} className="w-full h-9 mt-1.5 flex items-center justify-center gap-1.5 text-xs font-bold text-sky-200/80 rise-in">
          <UserPlus className="w-3.5 h-3.5" /> ادعُ أصحابك
        </button>
        <button onClick={leave} className="w-full h-9 mt-1 flex items-center justify-center gap-1.5 text-xs font-bold text-white/35 rise-in" style={{ animationDelay: ".2s" }}>
          <LogOut className="w-3.5 h-3.5" /> خروج
        </button>
        {friendsOpen && <AccountFriends roomCode={code} onClose={() => setFriendsOpen(false)} />}
      </div>
    );
  }

  /* ============ اللعب ============ */
  if (phase === "play") {
    return (
      <>
        {ChatToasts}
        {ReactionDock}
        {roundsOf > 0 && (
          <div className="fixed top-2 right-3 z-[60] rounded-full bg-white/8 border border-white/15 px-3 py-1 text-[11px] font-extrabold text-white/70">
            جولة {roundNo.toLocaleString("ar-EG")}/{roundsOf.toLocaleString("ar-EG")}
          </div>
        )}
        {reconnecting && (
          <div className="fixed top-0 inset-x-0 z-[70] flex justify-center p-2 pointer-events-none">
            <div className="rounded-2xl bg-rose-500/90 border border-rose-300/50 px-4 py-2 flex items-center gap-2 font-bold text-sm text-white shadow-2xl pop-in">
              <LoaderCircle className="w-4.5 h-4.5 animate-spin" />
              النت وقع… بنرجّعك للغرفة، ما تسكّرش الصفحة!
            </div>
          </div>
        )}
        <Game
          key={`onl-${gameKey}`}
          letter={letter}
          baseScore={0}
          muted={muted}
          onToggleMute={onToggleMute}
          onFinish={noopFinish}
          onQuit={leave}
          net={net}
        />
      </>
    );
  }

  /* ============ وصلة الحروف ============ */
  if (phase === "chain") {
    return (
      <>
        {ChatToasts}
        <ChainOnline net={chainNet} msg={chainMsg} onExit={leave} />
      </>
    );
  }

  /* ============ تحدي الخمس ثواني ============ */
  if (phase === "blitz") {
    return (
      <>
        {ChatToasts}
        <BlitzGame net={blitzNet} onExit={leave} />
      </>
    );
  }

  /* ============ مرحلة التصحيح بل الشهرة — للجميع ============ */
  if (phase === "review") {
    const room = roomRef.current;
    // المضيف: لديه بيانات التصحيح محليًا
    if (!quickMode && amHost && room && isHost(room)) {
      const data = room.getReview();
      if (data) {
        return (
          <OnlineReview
            data={data}
            onFinalize={(overrides) => room.finalizeReview(overrides)}
            myId={myId}
          />
        );
      }
    }
    // الضيوف: نفس الشاشة لكن للعرض فقط (المحكم عليها بالقرار الأخير للمضيف)
    if (reviewData) {
      return (
        <OnlineReview
          data={reviewData}
          onFinalize={() => { /* الضيوف لا يعدلون */ }}
          myId={myId}
          readOnly
        />
      );
    }
    return (
      <div className="min-h-dvh flex items-center justify-center px-4">
        <div className="glass rounded-3xl p-8 max-w-sm w-full text-center pop-in">
          <div className="mx-auto w-16 h-16 rounded-3xl bg-amber-400/15 border border-amber-300/35 flex items-center justify-center mb-4">
            <ClipboardCheck className="w-8 h-8 text-amber-300" />
          </div>
          <h2 className="font-display text-2xl font-extrabold mb-1">الجولة خلصت!</h2>
          <p className="text-white/55 font-bold text-sm leading-6 mb-4">
            مستنيين بيانات الإجابات من المضيف…
          </p>
          <div className="flex items-center justify-center gap-1.5 mb-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-amber-300 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ============ النتائج ============ */
  if (phase === "results" && results) {
    const seriesDone = roundsOf > 0 && results.round >= roundsOf;
    return (
      <>
        {ChatToasts}
        <div className="fixed bottom-0 inset-x-0 z-[60] p-2 pt-6 bg-gradient-to-t from-[#141b2e] to-transparent">
          <ChatBar className="max-w-sm mx-auto pb-1" />
        </div>
        <OnlineResults
          results={results}
          myId={myId}
          amHost={amHost}
          seriesDone={seriesDone}
          likes={likes}
          likedByMe={likedByMe}
          onLike={sendLike}
          onOpenCard={openCard}
          onNext={startRound}
          onLeave={leave}
        />
        {cardPlayer && <PlayerCard player={cardPlayer} onClose={() => setCardPlayer(null)} />}
      </>
    );
  }

  return null;
}
