import { useCallback, useEffect, useRef, useState } from "react";
import { Zap, Heart, Home, Trophy, Coins, Crown, Skull, Flame, Users } from "lucide-react";
import { judge, suggest } from "../data/lexicon";
import { makeQuestion, blitzPoints, BLITZ_MS, BLITZ_LIVES, BLITZ_GAP_MS, type BlitzQuestion, type BlitzRow } from "../lib/blitz";
import { earn, useWallet } from "../lib/wallet";
import { bumpStats, pushHistory } from "../lib/storage";
import { checkAchievements } from "../lib/achievements";
import { submitRecord } from "../lib/globalBoard";
import Avatar from "./Avatar";
import { useProfile } from "../lib/profile";
import { sfx } from "../lib/sound";
import { fx, PALETTES } from "../lib/fx";

export interface BlitzNet {
  question: BlitzQuestion | null;
  deadline: number;          // وقت انتهاء السؤال (ms)
  rows: BlitzRow[];
  myId: string;
  over: boolean;
  onAnswer(word: string): void;
}

/** تحدي الخمس ثواني — فردي أو أونلاين */
export default function BlitzGame({ net, onExit }: { net?: BlitzNet; onExit: () => void }) {
  const online = !!net;
  const profile = useProfile();
  const wallet = useWallet();

  // ===== حالة الفردي =====
  const [q, setQ] = useState<BlitzQuestion | null>(() => (online ? null : makeQuestion(1)));
  const [deadline, setDeadline] = useState(() => (online ? 0 : Date.now() + BLITZ_MS));
  const [lives, setLives] = useState(BLITZ_LIVES);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [over, setOver] = useState(false);
  const [reward, setReward] = useState(0);

  const [text, setText] = useState("");
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [paused, setPaused] = useState(false); // فترة الراحة بين الأسئلة

  const inputRef = useRef<HTMLInputElement>(null);
  const answeredRef = useRef(false);
  const liveRef = useRef({ lives: BLITZ_LIVES, score: 0, streak: 0, round: 1 });
  const doneRef = useRef(false);
  const warnedRef = useRef(false);

  const activeQ = online ? net!.question : q;
  const activeDeadline = online ? net!.deadline : deadline;
  const isOver = online ? net!.over : over;
  const msLeft = Math.max(0, activeDeadline - now);
  const secLeft = Math.ceil(msLeft / 1000);
  const pct = Math.max(0, Math.min(1, msLeft / BLITZ_MS));

  // مؤقّت العرض
  useEffect(() => {
    if (isOver) return;
    const iv = setInterval(() => setNow(Date.now()), 60);
    return () => clearInterval(iv);
  }, [isOver]);

  // صوت التحذير في آخر ثانيتين
  useEffect(() => {
    if (isOver || paused || !activeQ) return;
    if (msLeft > 0 && msLeft < 2000 && !warnedRef.current) {
      warnedRef.current = true;
      try { sfx.warn(); } catch { /* اتجاهل */ }
    }
  }, [msLeft, isOver, paused, activeQ]);

  const finishSolo = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const s = liveRef.current;
    const coins = Math.round(s.score * 0.8);
    setReward(coins);
    try {
      earn(coins);
      bumpStats({ score: s.score, words: s.round - 1, won: s.score >= 60 });
      pushHistory({ d: Date.now(), letter: "⚡", score: s.score, mode: "solo" });
      checkAchievements();
      submitRecord({ name: profile.name || "النجم", avatar: profile.avatar, score: s.score, mode: "blitz" });
    } catch { /* اتجاهل */ }
    try { sfx.horn(); } catch { /* اتجاهل */ }
    setOver(true);
  }, []);

  /** سؤال جديد (فردي) */
  const nextQuestion = useCallback(() => {
    if (doneRef.current) return;
    setQ((prev) => {
      const nq = makeQuestion(liveRef.current.round, prev ?? undefined);
      return nq;
    });
    setDeadline(Date.now() + BLITZ_MS);
    setText("");
    answeredRef.current = false;
    warnedRef.current = false;
    setPaused(false);
    setTimeout(() => inputRef.current?.focus(), 40);
  }, []);

  /** انتهى وقت السؤال من غير إجابة (فردي) */
  const timeUp = useCallback(() => {
    if (answeredRef.current || doneRef.current) return;
    answeredRef.current = true;
    const hint = activeQ ? suggest(activeQ.cat, activeQ.letter) : null;
    liveRef.current.lives -= 1;
    liveRef.current.streak = 0;
    setLives(liveRef.current.lives);
    setStreak(0);
    setFlash({ ok: false, msg: hint ? `خلص الوقت! كان ينفع «${hint}»` : "خلص الوقت!" });
    try { sfx.bad(); } catch { /* اتجاهل */ }
    setPaused(true);
    if (liveRef.current.lives <= 0) {
      setTimeout(finishSolo, 900);
    } else {
      liveRef.current.round += 1;
      setTimeout(() => { setFlash(null); nextQuestion(); }, BLITZ_GAP_MS);
    }
  }, [activeQ, finishSolo, nextQuestion]);

  // مراقبة انتهاء الوقت (فردي)
  useEffect(() => {
    if (online || isOver || paused || !activeQ) return;
    if (msLeft <= 0) timeUp();
  }, [msLeft, online, isOver, paused, activeQ, timeUp]);

  // أونلاين: سؤال جديد يصفّر الإدخال
  useEffect(() => {
    if (!online || !net!.question) return;
    setText("");
    answeredRef.current = false;
    warnedRef.current = false;
    setFlash(null);
    setTimeout(() => inputRef.current?.focus(), 40);
  }, [online, net?.question?.round]);

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 350); return () => clearTimeout(t); }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = text.trim();
    if (!w || !activeQ || answeredRef.current || isOver) return;

    if (online) {
      answeredRef.current = true;
      net!.onAnswer(w);
      setText("");
      setFlash({ ok: true, msg: "اتبعتت! مستنيين الباقيين…" });
      try { sfx.ok(); } catch { /* اتجاهل */ }
      return;
    }

    // ===== الفردي =====
    const v = judge(activeQ.cat, w, activeQ.letter);
    const ok = v.t === "exact" || v.t === "fixed";
    answeredRef.current = true;
    if (ok) {
      const pts = blitzPoints(msLeft) + (v.t === "exact" ? 0 : -2);
      liveRef.current.score += pts;
      liveRef.current.streak += 1;
      liveRef.current.round += 1;
      setScore(liveRef.current.score);
      setStreak(liveRef.current.streak);
      setFlash({ ok: true, msg: `صح! +${pts.toLocaleString("ar-EG")}` });
      try { sfx.correct(); fx.burst(window.innerWidth / 2, window.innerHeight / 2.4, PALETTES.exact, 26, 7); } catch { /* اتجاهل */ }
      setPaused(true);
      setTimeout(() => { setFlash(null); nextQuestion(); }, BLITZ_GAP_MS - 500);
    } else {
      const hint = suggest(activeQ.cat, activeQ.letter);
      liveRef.current.lives -= 1;
      liveRef.current.streak = 0;
      setLives(liveRef.current.lives);
      setStreak(0);
      setFlash({ ok: false, msg: hint ? `غلط! كان ينفع «${hint}»` : "غلط!" });
      try { sfx.bad(); } catch { /* اتجاهل */ }
      setPaused(true);
      if (liveRef.current.lives <= 0) setTimeout(finishSolo, 900);
      else {
        liveRef.current.round += 1;
        setTimeout(() => { setFlash(null); nextQuestion(); }, BLITZ_GAP_MS);
      }
    }
  };

  /* ============ شاشة النهاية ============ */
  if (isOver) {
    const rows = online ? [...net!.rows].sort((a, b) => b.score - a.score) : [];
    const meRow = online ? rows.find((r) => r.id === net!.myId) : null;
    const iWon = online && rows.length > 1 && rows[0]?.id === net!.myId;
    return (
      <div className="min-h-dvh flex items-start sm:items-center justify-center px-3 py-6">
        <div className="w-full max-w-md">
          <div className="text-center rise-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-400/15 border border-rose-300/40 text-rose-200 font-bold text-sm stamp-in">
              <Zap className="w-4 h-4" /> تحدي الخمس ثواني
            </div>
            <h2 className="font-display title-gradient text-4xl font-extrabold mt-2">
              {online ? (iWon ? "كسبت! 👑" : "خلص التحدي") : "خلصت أرواحك!"}
            </h2>
          </div>

          {online ? (
            <div className="glass rounded-3xl p-4 mt-4 rise-in" style={{ animationDelay: ".08s" }}>
              <div className="space-y-1.5">
                {rows.map((r, i) => (
                  <div
                    key={r.id}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 border font-bold ${
                      i === 0 ? "bg-amber-400/15 border-amber-300/45" : "bg-white/[.04] border-white/10"
                    } ${r.id === net!.myId ? "ring-1 ring-sky-300/50" : ""}`}
                  >
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-display shrink-0 ${
                      i === 0 ? "bg-amber-400 text-amber-950" : "bg-white/10 text-white/60"
                    }`}>
                      {i === 0 ? <Crown className="w-4 h-4" /> : (i + 1).toLocaleString("ar-EG")}
                    </span>
                    <Avatar src={r.avatar} name={r.name} size={30} />
                    <span className="flex-1 truncate">
                      {r.name} {r.id === net!.myId && <span className="text-[10px] text-white/45">(أنت)</span>}
                    </span>
                    {!r.alive && <Skull className="w-4 h-4 text-white/25" />}
                    <span className="font-display text-lg text-amber-300 tabular-nums">{r.score.toLocaleString("ar-EG")}</span>
                  </div>
                ))}
              </div>
              {meRow && (
                <div className="mt-3 rounded-2xl bg-amber-400/12 border border-amber-300/30 px-4 py-2.5 text-center">
                  <span className="font-bold text-sm text-amber-200">
                    نقاطك <span className="font-display text-lg">{meRow.score.toLocaleString("ar-EG")}</span>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="glass rounded-3xl p-5 mt-4 text-center rise-in" style={{ animationDelay: ".08s" }}>
              <div className="text-white/50 font-bold text-xs">نقاطك</div>
              <div className="font-display text-6xl font-extrabold text-amber-300 leading-none pop-in">
                {score.toLocaleString("ar-EG")}
              </div>
              <div className="text-sm font-bold text-white/55 mt-1">
                جاوبت على {(liveRef.current.round - 1).toLocaleString("ar-EG")} سؤال
              </div>
              <div className="mt-4 rounded-2xl bg-gradient-to-l from-amber-400/11 to-emerald-400/6 border border-amber-300/40 px-4 py-3 pop-in">
                <div className="flex items-center justify-center gap-2 font-bold text-sm text-amber-100">
                  <Coins className="w-4.5 h-4.5 text-amber-300" />
                  كسبت <span className="font-display text-lg text-amber-300">{reward.toLocaleString("ar-EG")}</span> جنيه
                </div>
                <div className="text-[11px] font-bold text-white/40 mt-1">رصيدك {wallet.coins.toLocaleString("ar-EG")}</div>
              </div>
            </div>
          )}

          <button onClick={onExit} className="btn-primary w-full py-3.5 text-xl flex items-center justify-center gap-2 mt-4 rise-in" style={{ animationDelay: ".2s" }}>
            <Home className="w-5.5 h-5.5" /> رجوع
          </button>
        </div>
      </div>
    );
  }

  /* ============ شاشة اللعب ============ */
  const aliveRows = online ? net!.rows.filter((r) => r.alive) : [];
  const meAlive = online ? net!.rows.find((r) => r.id === net!.myId)?.alive !== false : true;

  return (
    <div className="min-h-dvh flex flex-col max-w-lg mx-auto px-4 py-5">
      {/* الترويسة */}
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-2xl bg-rose-400/20 border border-rose-300/40 flex items-center justify-center shrink-0">
          <Zap className="w-6 h-6 text-rose-300" />
        </span>
        <div className="flex-1">
          <div className="text-[11px] font-extrabold text-rose-300/90">تحدي الخمس ثواني</div>
          <div className="font-display text-lg font-extrabold">
            سؤال {(activeQ?.round ?? 1).toLocaleString("ar-EG")}
          </div>
        </div>
        {online ? (
          <span className="flex items-center gap-1.5 rounded-full bg-white/8 border border-white/15 px-3 py-1.5 text-xs font-extrabold">
            <Users className="w-3.5 h-3.5 text-emerald-300" />
            {aliveRows.length.toLocaleString("ar-EG")} صامد
          </span>
        ) : (
          <div className="flex items-center gap-1">
            {Array.from({ length: BLITZ_LIVES }).map((_, i) => (
              <Heart
                key={i}
                className={`w-5 h-5 transition-all ${i < lives ? "text-rose-400 fill-rose-400" : "text-white/15"}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* النقاط والسلسلة (فردي) */}
      {!online && (
        <div className="flex items-center justify-center gap-3 mt-2">
          <span key={score} className="font-display text-2xl font-extrabold text-amber-300 pop-in">
            {score.toLocaleString("ar-EG")}
          </span>
          {streak >= 2 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-400/15 border border-rose-300/35 px-2.5 py-0.5 text-[11px] font-extrabold text-rose-200">
              <Flame className="w-3.5 h-3.5" /> {streak.toLocaleString("ar-EG")} ورا بعض
            </span>
          )}
        </div>
      )}

      {/* السؤال */}
      <div className="flex-1 flex flex-col items-center justify-center py-6">
        {activeQ && (
          <>
            <div
              key={`${activeQ.round}-${activeQ.letter}`}
              className="text-center pop-in"
            >
              <p className="text-white/50 font-bold text-sm">هات</p>
              <h2 className="font-display text-4xl sm:text-5xl font-extrabold mt-1" style={{ color: activeQ.color }}>
                {activeQ.label}
              </h2>
              <p className="text-white/50 font-bold text-sm mt-2">بحرف</p>
              <span className="inline-flex w-20 h-20 rounded-3xl letter-disc items-center justify-center mt-1">
                <span className="font-display font-extrabold text-5xl leading-none text-[#33240f]">{activeQ.letter}</span>
              </span>
            </div>

            {/* عدّاد ٥ ثواني */}
            <div className="w-full max-w-xs mt-6">
              <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-none"
                  style={{
                    width: `${pct * 100}%`,
                    background: pct > 0.5
                      ? "linear-gradient(90deg,#6bc9a0,#e8b563)"
                      : "linear-gradient(90deg,#dd8f8f,#e0899b)",
                  }}
                />
              </div>
              <div className={`text-center font-display text-3xl font-extrabold mt-1.5 ${secLeft <= 2 ? "warn-pulse" : "text-white/80"}`}>
                {secLeft.toLocaleString("ar-EG")}
              </div>
            </div>
          </>
        )}

        {!activeQ && (
          <p className="text-white/50 font-bold text-center animate-pulse">مستنيين السؤال الجاي…</p>
        )}

        {/* رسالة النتيجة */}
        {flash && (
          <div
            className={`mt-4 rounded-2xl px-5 py-2.5 font-bold pop-in border ${
              flash.ok
                ? "bg-emerald-400/15 border-emerald-300/40 text-emerald-100"
                : "bg-rose-400/15 border-rose-300/40 text-rose-100"
            }`}
          >
            {flash.msg}
          </div>
        )}
      </div>

      {/* الإدخال */}
      {meAlive ? (
        <form onSubmit={submit}>
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={activeQ ? `${activeQ.label} بحرف «${activeQ.letter}»…` : "استنى…"}
            disabled={!activeQ || paused || answeredRef.current}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            className="w-full bg-[#141b2e]/70 border-2 border-rose-300/40 rounded-2xl px-4 py-4 text-xl font-extrabold outline-none focus:border-rose-300/90 transition-colors placeholder:text-white/25 text-center disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!activeQ || paused || answeredRef.current}
            className="btn-primary w-full py-3 mt-2 text-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Zap className="w-5 h-5" /> جاوب
          </button>
        </form>
      ) : (
        <div className="glass rounded-2xl py-4 text-center font-bold text-white/70 flex items-center justify-center gap-2">
          <Skull className="w-5 h-5 text-rose-300" /> خرجت من التحدي — بتتفرج على الباقيين
        </div>
      )}

      {/* اللاعيبة (أونلاين) */}
      {online && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
          {net!.rows.map((r) => (
            <span
              key={r.id}
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-extrabold border transition-all ${
                !r.alive
                  ? "bg-white/[.02] border-white/8 text-white/30 line-through"
                  : r.answered
                    ? "bg-emerald-400/15 border-emerald-300/40 text-emerald-200"
                    : "bg-white/6 border-white/12 text-white/65"
              }`}
            >
              <Avatar src={r.avatar} name={r.name} size={16} />
              {r.name}
              <span className="font-display text-white/45">{r.score.toLocaleString("ar-EG")}</span>
            </span>
          ))}
        </div>
      )}

      <button onClick={onExit} className="btn-ghost w-full py-2.5 mt-2 text-sm font-bold text-white/50 flex items-center justify-center gap-2">
        <Trophy className="w-4 h-4" /> إنهاء
      </button>

      <div className="sr-only">{profile.name}</div>
    </div>
  );
}
