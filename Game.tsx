import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Home, Volume2, VolumeX, OctagonX, Check, Wand2, Star, Timer, Hourglass, Wifi, Lightbulb, Clock3, Coins } from "lucide-react";
import { CATS, judge, suggest, type CatKey, type Verdict } from "../data/lexicon";
import { normalizeArabic } from "../lib/arabic";
import Avatar from "./Avatar";
import { useProfile } from "../lib/profile";
import { useWallet, consumeHint, consumeTime } from "../lib/wallet";
import { sfx } from "../lib/sound";
import { fx, PALETTES } from "../lib/fx";
import type { NetPlayer } from "../net/online";
import type { BotSim, BotResult } from "../lib/bots";

const ROUND_MS = 75_000;

export interface NetUI {
  remMs: number;
  roundMs?: number;
  waiting: boolean;
  players: NetPlayer[];
  myId: string;
  onLock(cat: CatKey, text: string): void;
  onStop(): void;
}

export interface RoundAnswer {
  cat: CatKey;
  label: string;
  color: string;
  text: string;
  verdict: Verdict | null;
  unique?: boolean; // تميّز الفئة ضد البوتات
}

interface Locked { t: "exact" | "fixed" | "ok"; pts: number; display: string }

export default function Game({
  letter, baseScore, muted, onToggleMute, onFinish, onQuit, net, bots,
  activeCategory, durationMs = ROUND_MS,
}: {
  letter: string;
  baseScore: number;
  muted: boolean;
  onToggleMute: () => void;
  onFinish: (a: RoundAnswer[], roundScore: number, bonus: number, stopped: boolean, bots?: BotResult[]) => void;
  onQuit: () => void;
  net?: NetUI;
  bots?: BotSim[];
  activeCategory?: CatKey;
  durationMs?: number;
}) {
  const cats = useMemo(() => (activeCategory ? CATS.filter((c) => c.key === activeCategory) : CATS), [activeCategory]);
  const [texts, setTexts] = useState<Record<CatKey, string>>(() => Object.fromEntries(CATS.map((c) => [c.key, ""])) as never);
  const [locked, setLocked] = useState<Partial<Record<CatKey, Locked>>>({});
  const [badMsg, setBadMsg] = useState<Partial<Record<CatKey, string>>>({});
  const [remaining, setRemaining] = useState(durationMs);
  const [paused, setPaused] = useState(false);
  const [armed, setArmed] = useState(false);
  const [shake, setShake] = useState(false);
  const wallet = useWallet();
  const profile = useProfile();

  const inputRefs = useRef<Partial<Record<CatKey, HTMLInputElement | null>>>({});
  const cardRefs = useRef<Partial<Record<CatKey, HTMLFormElement | null>>>({});
  const finishedRef = useRef(false);
  const lastTickRef = useRef(-1);
  const armedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lockedRef = useRef<Partial<Record<CatKey, Locked>>>({});
  const flushedRef = useRef(false);
  const autoTimers = useRef<Partial<Record<CatKey, ReturnType<typeof setTimeout>>>>({});
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  // بوتات المنافسة في الوضع الفردي
  const botsRef = useRef<BotSim[]>([]);
  if (botsRef.current.length === 0 && bots && bots.length > 0) botsRef.current = bots;
  const hasBots = botsRef.current.length > 0;
  const [, setBotTick] = useState(0);
  // مراجع حية — القراءة دايمًا لأحدث قيمة (ضد أي stale closure)
  const textsRef = useRef(texts);
  textsRef.current = texts;
  const remainingRef = useRef(remaining);
  remainingRef.current = remaining;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const answeredCount = useMemo(() => Object.keys(locked).length, [locked]);
  const liveScore = useMemo(() => Object.values(locked).reduce((s, l) => s + (l?.pts ?? 0), 0), [locked]);
  const secs = Math.ceil(remaining / 1000);
  const displaySecs = net ? Math.ceil(net.remMs / 1000) : secs;
  const pct = net ? net.remMs / (net.roundMs ?? ROUND_MS) : remaining / durationMs;
  const allAnswered = answeredCount === cats.length;
  const frozen = !!net?.waiting;

  const doShake = useCallback(() => { setShake(true); setTimeout(() => setShake(false), 450); }, []);

  const focusNext = useCallback((currentLocked: Partial<Record<CatKey, Locked>>) => {
    const next = cats.find((c) => !currentLocked[c.key]);
    if (next) setTimeout(() => inputRefs.current[next.key]?.focus(), 60);
  }, [activeCategory]);

  const finish = useCallback((stopped: boolean, lockedSnap?: Partial<Record<CatKey, Locked>>) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    // زي اللعبة الورقية: أي كلمة مكتوبة لما الأتوبيس يقف بتحسب وتتحكم
    const textsNow = textsRef.current;
    const lk: Partial<Record<CatKey, Locked>> = { ...(lockedSnap ?? lockedRef.current) };
    for (const c of cats) {
      if (!lk[c.key]) {
        const w = (textsNow[c.key] ?? "").trim();
        if (!w) continue;
        const v = judge(c.key, w, letter);
        if (v.t !== "bad") lk[c.key] = { t: v.t, pts: v.pts, display: v.display };
      }
    }
    const filled = cats.reduce((n, c) => n + (lk[c.key] ? 1 : 0), 0);
    const answers: RoundAnswer[] = cats.map((c) => {
      const v = lk[c.key];
      return {
        cat: c.key, label: c.label, color: c.color,
        text: textsNow[c.key],
        verdict: v ? { t: v.t, pts: v.pts, display: v.display } as Verdict : null,
      };
    });
    let score = Object.values(lk).reduce((s, l) => s + (l?.pts ?? 0), 0);
    const bonus = stopped && filled === cats.length ? Math.ceil(remainingRef.current / 1000) : 0;
    let botResults: BotResult[] | undefined;
    try {
      botResults = botsRef.current.length ? botsRef.current.map((b) => b.result()) : undefined;
    } catch { botResults = undefined; }
    // تميّز الفئة ضد البوتات: +٣ لكل إجابة فريدة ما جابهاش أي بوت
    if (botResults && botResults.length > 0) {
      const botWords = new Set<string>();
      for (const b of botResults) {
        for (const c of CATS) {
          const a = b.answers[c.key];
          if (a?.verdict && a.verdict.t !== "bad") botWords.add(normalizeArabic(a.verdict.display));
        }
      }
      for (const a of answers) {
        if (a.verdict && a.verdict.t !== "bad" && !botWords.has(normalizeArabic(a.verdict.display))) {
          a.unique = true;
          score += 3;
        }
      }
    }
    try { sfx.horn(); } catch { /* اتجاهل */ }
    onFinishRef.current(answers, score, bonus, stopped, botResults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter, activeCategory]);

  // المؤقّت (وضع فردي فقط — الأونلاين بيتبع المضيف)
  useEffect(() => {
    if (net) return;
    if (paused || finishedRef.current) return;
    const iv = setInterval(() => {
      setRemaining((r) => {
        const next = r - 100;
        const s = Math.ceil(next / 1000);
        if (s <= 5 && s !== lastTickRef.current && s > 0) { lastTickRef.current = s; sfx.warn(); }
        if (next <= 0) { clearInterval(iv); doShake(); sfx.bad(); setTimeout(() => finish(false), 60); return 0; }
        return next;
      });
    }, 100);
    return () => clearInterval(iv);
  }, [net, paused, finish, doShake]);

  // اختصارات لوحة المفاتيح
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (net) return; // مفيش إيقاف مؤقت أونلاين
      if (e.key === "Escape") setPaused((p) => !p);
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleStop();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAnswered, armed, locked, net]);

  // إيقاف تلقائي عند الخروج من التبويب (فردي فقط — الأونلاين مفيهوش إيقاف عشان ما يتجمدش اللاعب)
  useEffect(() => {
    const h = () => { if (document.hidden && !net && !finishedRef.current) setPaused(true); };
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, [net]);

  // تركيز أول خانة
  useEffect(() => {
    const t = setTimeout(() => inputRefs.current[cats[0].key]?.focus(), 350);
    return () => clearTimeout(t);
  }, [activeCategory]);

  const lockIn = (cat: CatKey, word: string): boolean => {
    if (lockedRef.current[cat]) return true;
    const rawText = word.trim();
    if (!rawText) return false;

    // فردي: الحكم زي ما هو بالتأثيرات والألوان
    if (!net) {
      const verdict = judge(cat, word, letter);
      if (verdict.t === "bad") return false;
      const newLocked = { ...lockedRef.current, [cat]: { t: verdict.t, pts: verdict.pts, display: verdict.display } as Locked };
      lockedRef.current = newLocked;
      if (autoTimers.current[cat]) { clearTimeout(autoTimers.current[cat]); delete autoTimers.current[cat]; }
      setLocked(newLocked as never);
      setBadMsg((m) => ({ ...m, [cat]: undefined }));
      try {
        if (verdict.t === "exact") { sfx.correct(); fx.burstAtEl(cardRefs.current[cat] ?? null, PALETTES.exact, 30, 8); }
        else if (verdict.t === "fixed") { sfx.fixed(); fx.burstAtEl(cardRefs.current[cat] ?? null, PALETTES.fixed, 26, 7); }
        else { sfx.ok(); fx.burstAtEl(cardRefs.current[cat] ?? null, PALETTES.ok, 22, 6); }
      } catch { /* اتجاهل */ }
      focusNext(newLocked);
      if (Object.keys(newLocked).length === cats.length) {
        setTimeout(() => finish(true, newLocked), 800);
      }
      return true;
    }

    // أونلاين: بنسجل النص الخام من غير حكم فوري (الحكم بعد نهاية الجولة للكل)
    {
      const netApi = net;
      const newLocked = { ...lockedRef.current, [cat]: { t: "ok", pts: 0, display: rawText } as Locked };
      lockedRef.current = newLocked;
      if (autoTimers.current[cat]) { clearTimeout(autoTimers.current[cat]); delete autoTimers.current[cat]; }
      setLocked(newLocked as never);
      setBadMsg((m) => ({ ...m, [cat]: undefined }));
      try { sfx.tick(); } catch { /* اتجاهل */ }
      netApi.onLock(cat, rawText);
      focusNext(newLocked);
      if (Object.keys(newLocked).length === cats.length) {
        setTimeout(() => netApi.onStop(), 800);
      }
      return true;
    }
  };

  /** أونلاين: إرسال الكلمات المكتوبة غير المؤكدة للمضيف قبل الوقف/نهاية الوقت */
  const flushPending = useCallback(() => {
    if (!net) return;
    const textsNow = textsRef.current;
    for (const c of cats) {
      if (lockedRef.current[c.key]) continue;
      const w = (textsNow[c.key] ?? "").trim();
      if (w) lockIn(c.key, w);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net, letter, activeCategory]);

  // فلش أوتوماتيك قبل نهاية الوقت في الأونلاين
  useEffect(() => {
    if (!net) return;
    if (!flushedRef.current && net.remMs > 0 && net.remMs <= 1500) {
      flushedRef.current = true;
      flushPending();
    }
  }, [net, flushPending]);

  const submitCat = (cat: CatKey, auto = false) => {
    if (finishedRef.current || pausedRef.current || frozen) return;
    if (lockedRef.current[cat] !== undefined) return;
    const current = textsRef.current[cat] ?? "";

    // القفل التلقائي أثناء التوقف عن الكتابة — مفيش Enter خالص
    if (auto) {
      const n = current.trim();
      if (!n) return;
      const v = judge(cat, n, letter);
      if (v.t === "bad") {
        setBadMsg((m) => ({ ...m, [cat]: "القاموس مش مقتنع بيها — كمّل كتابة أو عدّلها" }));
        return;
      }
      if (v.t === "ok") {
        // مقبولة: ندي ثانية تأكد إضافية ثم تقفل لوحدة
        setBadMsg((m) => ({ ...m, [cat]: "مقبولة (٠ نقطة) — بتتقفل لوحدة…" }));
        autoTimers.current[cat] = setTimeout(() => {
          if (!finishedRef.current && !pausedRef.current && !frozen && !lockedRef.current[cat]) {
            lockIn(cat, textsRef.current[cat].trim());
          }
        }, 1300);
        return;
      }
      lockIn(cat, n);
      return;
    }

    if (lockIn(cat, current)) return;
    try { sfx.bad(); } catch { /* اتجاهل */ }
    const n = current.trim();
    const msg = !n ? "اكتب حاجة الأول" : "لازم تبدأ بحرف «" + letter + "» وبكلمة عربية مفهومة";
    setBadMsg((m) => ({ ...m, [cat]: msg }));
    const el = cardRefs.current[cat];
    if (el) {
      el.classList.remove("micro-shake");
      void el.offsetWidth;
      el.classList.add("micro-shake");
      setTimeout(() => el.classList.remove("micro-shake"), 430);
    }
    doShake();
  };

  /** جدولة قفل تلقائي للكارت بعد التوقف عن الكتابة (الموبايل مش محتاج Enter) */
  const scheduleAuto = (cat: CatKey) => {
    const old = autoTimers.current[cat];
    if (old) clearTimeout(old);
    autoTimers.current[cat] = setTimeout(() => {
      if (!finishedRef.current && !pausedRef.current && !frozen && !lockedRef.current[cat]) {
        submitCat(cat, true);
      }
    }, 850);
  };

  /** فك القفل للتعديل (فردي بس) */
  const reEdit = (cat: CatKey) => {
    if (net || finishedRef.current || pausedRef.current || frozen) return;
    delete (lockedRef.current as Record<string, unknown>)[cat];
    setLocked((lk) => {
      const n = { ...lk };
      delete n[cat];
      return n;
    });
    setBadMsg((m) => ({ ...m, [cat]: undefined }));
    setTimeout(() => inputRefs.current[cat]?.focus(), 60);
  };

  // تنظيف مؤقتات القفل التلقائي عند فك التركيب
  useEffect(() => {
    const timers = autoTimers.current;
    return () => { for (const k of Object.keys(timers)) clearTimeout(timers[k as CatKey]); };
  }, []);

  // محرك البوتات: بيملوا فئاتهم مع مرور وقت الجولة
  useEffect(() => {
    if (net || paused || finishedRef.current || !hasBots) return;
    const iv = setInterval(() => {
      const elapsed = durationMs - remainingRef.current;
      for (const b of botsRef.current) b.advance(elapsed, durationMs);
      setBotTick((t) => t + 1);
    }, 300);
    return () => clearInterval(iv);
  }, [net, paused, hasBots, durationMs]);

  /** تلميح القاموس (استهلاك من المخزون) — وضع فردي فقط */
  const applyHint = () => {
    if (net || finishedRef.current || pausedRef.current || frozen) return;
    const target = cats.find((c) => lockedRef.current[c.key] === undefined);
    if (!target) return;
    const s = suggest(target.key, letter);
    if (!s) { sfx.bad(); doShake(); return; }
    if (!consumeHint()) { sfx.bad(); doShake(); return; }
    sfx.fixed();
    setTexts((t) => ({ ...t, [target.key]: s }));
    lockIn(target.key, s);
  };

  /** وقود زيادة: +١٠ ثواني (استهلاك من المخزون) */
  const applyTime = () => {
    if (net || finishedRef.current || pausedRef.current) return;
    if (!consumeTime()) { sfx.bad(); doShake(); return; }
    setRemaining((r) => r + 10_000);
    sfx.tick();
    fx.burst(window.innerWidth / 2, 80, PALETTES.exact, 24, 5);
  };

  const handleStop = () => {
    if (finishedRef.current || frozen) return;
    if (allAnswered) {
      if (net) { net.onStop(); return; }
      finish(true);
      return;
    }
    if (!armed) {
      setArmed(true);
      sfx.warn();
      clearTimeout(armedTimerRef.current);
      armedTimerRef.current = setTimeout(() => setArmed(false), 2600);
      return;
    }
    clearTimeout(armedTimerRef.current);
    if (net) { flushPending(); net.onStop(); setArmed(false); return; }
    finish(true);
  };

  const stateClass = (cat: CatKey) => {
    const l = locked[cat];
    if (!l) return "";
    return l.t === "exact" ? "state-exact" : l.t === "fixed" ? "state-fixed" : "state-ok";
  };

  return (
    <div className={`min-h-dvh flex flex-col max-w-5xl mx-auto px-3 sm:px-4 pb-2 ${shake ? "shake" : ""}`}>
      {/* شريط العداد */}
      <div className="pt-2 flex items-center gap-2.5">
        <div className="w-11 h-11 rounded-xl letter-disc flex items-center justify-center shrink-0 pop-in">
          <span className="font-display font-extrabold text-3xl leading-none text-[#33240f]">{letter}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-end justify-between mb-1">
            <span className={`flex items-center gap-1 font-display font-bold text-base ${displaySecs <= 5 ? "warn-pulse" : "text-white/75"}`}>
              <Timer className="w-4 h-4" /> {displaySecs.toLocaleString("ar-EG")}
            </span>
            <span className="flex flex-col items-end leading-none">
              <span key={liveScore} className="font-display text-amber-200 font-bold text-base tabular-nums pop-in">
                {liveScore.toLocaleString("ar-EG")}
              </span>
              <span className="text-[9px] font-bold text-white/30 mt-0.5">المجموع {(baseScore + liveScore).toLocaleString("ar-EG")}</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
            <div
              className="ribbon h-full rounded-full"
              style={{
                width: `${Math.min(1, pct) * 100}%`,
                background: displaySecs <= 10 ? "linear-gradient(90deg,#dd8f8f,#e0899b)" : "linear-gradient(90deg,#6bc9a0,#e8b563,#d99a45)",
              }}
            />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
          {!net && (
            <button onClick={() => setPaused(true)} className="btn-ghost w-9 h-9 flex items-center justify-center" aria-label="إيقاف مؤقت">
              <Pause className="w-4 h-4" />
            </button>
          )}
          <button onClick={onToggleMute} className="btn-ghost w-9 h-9 flex items-center justify-center" aria-label="الصوت">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* شريط تقدم اللاعبين (أونلاين) أو البوتات (فردي) */}
      {(net || hasBots) && (
        <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 whitespace-nowrap">
          {net ? <Wifi className="w-4 h-4 text-emerald-300 shrink-0" /> : <span className="text-[11px] font-extrabold text-white/40">المنافسة:</span>}
          {net
            ? net.players.map((p) => (
                <span
                  key={p.id}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border transition-colors shrink-0 ${
                    p.id === net.myId
                      ? "bg-amber-400/15 border-amber-300/40 text-amber-200"
                      : p.connected
                        ? "bg-white/5 border-white/10 text-white/70"
                        : "bg-white/[.02] border-white/5 text-white/30 line-through"
                  }`}
                >
                  <Avatar src={p.avatar} name={p.name} size={16} />
                  {p.name}
                  <span className="font-display text-white/45">{p.count.toLocaleString("ar-EG")}/{cats.length.toLocaleString("ar-EG")}</span>
                </span>
              ))
            : (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border bg-amber-400/10 border-amber-300/25 text-amber-100 shrink-0">
                    <Avatar src={profile.avatar} name={profile.name || "أنت"} size={16} />
                    أنت
                    <span className="font-display text-white/45">{answeredCount.toLocaleString("ar-EG")}/{cats.length.toLocaleString("ar-EG")}</span>
                  </span>
                  {botsRef.current.map((b) => (
                    <span
                      key={b.id}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border transition-colors shrink-0 ${
                        b.stopped ? "bg-violet-400/15 border-violet-300/40 text-violet-200" : "bg-white/5 border-white/10 text-white/70"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${b.stopped ? "bg-violet-300" : "bg-emerald-400"}`} />
                      {b.name}
                      <span className="font-display text-white/45">{b.count().toLocaleString("ar-EG")}/{cats.length.toLocaleString("ar-EG")}</span>
                    </span>
                  ))}
                </>
              )}
        </div>
      )}

      {activeCategory && (
        <div className="text-center mt-5 rise-in">
          <h2 className="font-display text-2xl sm:text-3xl font-bold">
            اكتب «{cats[0].label}» بحرف <span className="text-amber-300">«{letter}»</span>
          </h2>
          <p className="text-white/35 text-[10px] font-bold mt-1">{Math.ceil(durationMs / 1000).toLocaleString("ar-EG")} ثانية</p>
        </div>
      )}

      {/* شبكة الفئات */}
      <div className={activeCategory
        ? "flex-1 flex items-center justify-center py-6 [&>form]:w-full [&>form]:max-w-xl"
        : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2.5 flex-1"}
      >
        {cats.map((c, i) => {
          const l = locked[c.key];
          const bad = badMsg[c.key];
          return (
            <form
              key={c.key}
              ref={(el) => { cardRefs.current[c.key] = el; }}
              className={`cat-card rise-in ${activeCategory ? "p-4 sm:p-5" : "p-2"} ${stateClass(c.key)}`}
              style={{ animationDelay: `${i * 45}ms` }}
              // مفيش سابميت: Enter مالوش دور — القفل تلقائي
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-display font-bold" style={{ background: `${c.color}16`, color: c.color }}>
                    {c.label.charAt(0)}
                  </span>
                  <div>
                    <div className={`font-bold leading-4 ${activeCategory ? "text-base" : "text-xs"}`}>{c.label}</div>
                    {activeCategory && <div className="text-[10px] mt-0.5 font-bold text-white/35">{c.hint}</div>}
                  </div>
                </div>
                {l && !net && (
                  <span className="stamp-in flex items-center gap-1 text-xs font-display font-bold px-2 py-1 rounded-lg"
                    style={{
                      color: l.t === "exact" ? "#6bc9a0" : l.t === "fixed" ? "#7fb3d5" : "#e8b563",
                      background: l.t === "exact" ? "#6bc9a01a" : l.t === "fixed" ? "#7fb3d51a" : "#e8b5631a",
                    }}
                  >
                    {l.t === "exact" ? <Check className="w-3.5 h-3.5" /> : l.t === "fixed" ? <Wand2 className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
                    {l.t === "exact" ? "صح" : l.t === "fixed" ? "تصحيح" : "مقبولة"} +{l.pts.toLocaleString("ar-EG")}
                  </span>
                )}
                {/* أونلاين بدون حكم فوري — بنقول سجلت بس */}
                {l && net && (
                  <span className="stamp-in text-[10px] font-extrabold text-white/45 bg-white/8 border border-white/15 px-2 py-1 rounded-lg">
                    ✓ سجلت
                  </span>
                )}
              </div>
              {l ? (
                <div className="py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="font-display font-bold text-lg leading-6 pop-in flex-1">{l.display}</div>
                    {!net && (
                      <button
                        type="button"
                        onClick={() => reEdit(c.key)}
                        className="text-[10px] font-extrabold text-white/40 hover:text-amber-300 bg-white/6 hover:bg-white/12 rounded-lg px-2 py-1 transition-colors shrink-0"
                      >
                        عدّل
                      </button>
                    )}
                  </div>
                  {l.t === "fixed" && (
                    <div className="text-[11px] font-bold text-sky-300/90">
                      القاموس صحّح «{texts[c.key]}»
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <input
                    ref={(el) => { inputRefs.current[c.key] = el; }}
                    type="text"
                    value={texts[c.key]}
                    onChange={(e) => {
                      setTexts((t) => ({ ...t, [c.key]: e.target.value }));
                      if (badMsg[c.key]) setBadMsg((m) => ({ ...m, [c.key]: undefined }));
                      scheduleAuto(c.key);
                    }}
                    placeholder={`حاجة بحرف «${letter}»…`}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    enterKeyHint="go"
                    disabled={frozen}
                  />
                  <div className="h-4 mt-1 text-[11px] font-bold text-rose-300/90">
                    {bad ?? ""}
                  </div>
                </>
              )}
            </form>
          );
        })}
      </div>

      {/* زرار وقف الأتوبيس */}
      <div className="sticky bottom-0 pt-1.5 pb-1 bg-gradient-to-t from-[#141b2e] via-[#141b2ef0] to-transparent">
        {/* رصيفّة المساعدات (فردي فقط) */}
        {!net && !activeCategory && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <button
              onClick={applyHint}
              className={`btn-ghost flex-1 h-9 flex items-center justify-center gap-1.5 text-xs font-bold ${wallet.inv.hint <= 0 ? "opacity-45" : ""}`}
            >
              <Lightbulb className="w-4.5 h-4.5 text-amber-300" />
              تلميح
              <span className="text-white/40 font-display">×{wallet.inv.hint.toLocaleString("ar-EG")}</span>
            </button>
            <button
              onClick={applyTime}
              className={`btn-ghost flex-1 h-9 flex items-center justify-center gap-1.5 text-xs font-bold ${wallet.inv.time <= 0 ? "opacity-45" : ""}`}
            >
              <Clock3 className="w-4.5 h-4.5 text-emerald-300" />
              +١٠ ثواني
              <span className="text-white/40 font-display">×{wallet.inv.time.toLocaleString("ar-EG")}</span>
            </button>
            <span className="glass-soft rounded-xl px-2 h-9 flex items-center gap-1 shrink-0">
              <Coins className="w-4 h-4 text-amber-300" />
              <span key={wallet.coins} className="font-display font-extrabold text-amber-300 tabular-nums pop-in">
                {wallet.coins.toLocaleString("ar-EG")}
              </span>
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button onClick={onQuit} className="btn-ghost w-10 h-10 flex items-center justify-center shrink-0" aria-label="القائمة">
            <Home className="w-4 h-4" />
          </button>
          <div className="glass-soft rounded-xl px-3 h-10 flex items-center justify-center font-bold text-xs text-white/55 shrink-0">
            {activeCategory
              ? answeredCount > 0 ? "اتجاوبت" : "إجابة واحدة"
              : `فاضل ${(cats.length - answeredCount).toLocaleString("ar-EG")}`}
          </div>
          {frozen ? (
            <div className="glass flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-white/60">
              <Hourglass className="w-4 h-4 text-amber-300 animate-spin" style={{ animationDuration: "2.4s" }} />
              مستنيين الباقيين
            </div>
          ) : (
            <button
              onClick={handleStop}
              className={`${armed ? "btn-danger" : "btn-primary"} flex-1 h-11 text-sm flex items-center justify-center gap-1.5 rounded-xl ${allAnswered && !armed ? "pulse-glow" : ""}`}
            >
              <OctagonX className="w-4.5 h-4.5" />
              {armed ? "متأكد؟ اضغط تاني" : allAnswered ? "وقّف الأتوبيس" : "خلصت"}
            </button>
          )}
        </div>
      </div>

      {/* شاشة الإيقاف */}
      {paused && !net && (
        <div className="fixed inset-0 z-50 backdrop flex items-center justify-center p-4">
          <div className="glass rounded-3xl p-6 w-full max-w-xs text-center pop-in">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-400/15 text-amber-300 flex items-center justify-center mb-3">
              <Pause className="w-7 h-7" />
            </div>
            <h3 className="font-display text-2xl font-bold mb-1">الأتوبيس واقف</h3>
            <p className="text-white/50 font-bold text-sm mb-5">خد نفس… العداد متجمّد</p>
            <div className="space-y-2">
              <button onClick={() => setPaused(false)} className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-lg">
                <Play className="w-5 h-5 fill-current" /> كمّل اللعب
              </button>
              <button
                onClick={() => {
                  finishedRef.current = false;
                  flushedRef.current = false;
                  lockedRef.current = {};
                  for (const b of botsRef.current) b.reset();
                  setTexts(Object.fromEntries(CATS.map((c) => [c.key, ""])) as never);
                  setLocked({});
                  setBadMsg({});
                  setRemaining(durationMs);
                  setPaused(false);
                  lastTickRef.current = -1;
                }}
                className="btn-ghost w-full py-3 flex items-center justify-center gap-2 font-bold"
              >
                <RotateCcw className="w-4.5 h-4.5" /> الجولة من الأول
              </button>
              <button onClick={onQuit} className="btn-ghost w-full py-3 flex items-center justify-center gap-2 font-bold text-white/60">
                <Home className="w-4.5 h-4.5" /> انزل من الأتوبيس
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
