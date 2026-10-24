import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link2, Timer, Home, Heart, Coins, Flame, Zap, ArrowLeft, Lightbulb, Trophy } from "lucide-react";
import { judgeChain, lastLetterOf, anyWordStartingWith, countAnyStartingWith, ELIGIBLE_LETTERS } from "../data/lexicon";
import { normalizeArabic } from "../lib/arabic";
import { earn, useWallet } from "../lib/wallet";
import { bumpStats, pushHistory } from "../lib/storage";
import { checkAchievements } from "../lib/achievements";
import { submitRecord } from "../lib/globalBoard";
import { useProfile } from "../lib/profile";
import { sfx } from "../lib/sound";
import { fx, PALETTES } from "../lib/fx";

const START_MS = 12_000;   // وقت أول كلمة
const MIN_MS = 5_000;      // أقل وقت ممكن
const STEP_MS = 400;       // الوقت بيقل كل كلمة
const LIVES = 1;  // روح واحدة: أي غلطة أو وقت بيخلص = خسارة فورية

interface Link { word: string; pts: number; fixed: boolean }

/** حرف بداية فيه كلمات كتير */
function pickStartLetter(): string {
  const rich = ELIGIBLE_LETTERS.filter((l) => countAnyStartingWith(l) >= 30);
  const pool = rich.length ? rich : ELIGIBLE_LETTERS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function ChainGame({ onExit }: { onExit: () => void }) {
  const profile = useProfile();
  const wallet = useWallet();

  const [letter, setLetter] = useState(() => pickStartLetter());
  const [chain, setChain] = useState<Link[]>([]);
  const [text, setText] = useState("");
  const [lives, setLives] = useState(LIVES);
  const [score, setScore] = useState(0);
  const [limit, setLimit] = useState(START_MS);
  const [deadline, setDeadline] = useState(() => Date.now() + START_MS);
  const [now, setNow] = useState(Date.now());
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [over, setOver] = useState(false);
  const [reward, setReward] = useState(0);
  const [shake, setShake] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const usedRef = useRef<Set<string>>(new Set());
  const liveRef = useRef({ lives: LIVES, score: 0, count: 0 });
  const warnedRef = useRef(false);

  const msLeft = Math.max(0, deadline - now);
  const secLeft = Math.ceil(msLeft / 1000);
  const pct = Math.max(0, Math.min(1, msLeft / limit));
  const available = useMemo(() => countAnyStartingWith(letter, usedRef.current), [letter, chain.length]);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const s = liveRef.current;
    const coins = Math.round(s.score * 0.7);
    setReward(coins);
    try {
      earn(coins);
      bumpStats({ score: s.score, words: s.count, won: s.count >= 15 });
      pushHistory({ d: Date.now(), letter: "🔗", score: s.score, mode: "solo" });
      submitRecord({ name: profile.name || "النجم", avatar: profile.avatar, score: s.score, mode: "chain" });
      checkAchievements();
    } catch { /* اتجاهل */ }
    try { sfx.horn(); } catch { /* اتجاهل */ }
    setOver(true);
  }, [profile.avatar, profile.name]);

  // مؤقّت العرض
  useEffect(() => {
    if (over) return;
    const iv = setInterval(() => setNow(Date.now()), 60);
    return () => clearInterval(iv);
  }, [over]);

  // تحذير آخر ثانيتين
  useEffect(() => {
    if (over) return;
    if (msLeft > 0 && msLeft < 2200 && !warnedRef.current) {
      warnedRef.current = true;
      try { sfx.warn(); } catch { /* اتجاهل */ }
    }
  }, [msLeft, over]);

  const loseLife = useCallback((msg: string) => {
    liveRef.current.lives -= 1;
    setLives(liveRef.current.lives);
    setFlash({ ok: false, msg });
    setShake(true);
    setTimeout(() => setShake(false), 420);
    try { sfx.bad(); } catch { /* اتجاهل */ }
    // روح واحدة: أول غلطة أو وقت بيخلص = خسارة فورية ونهاية الدور
    setTimeout(finish, 1300);
  }, [finish]);

  // انتهى الوقت
  useEffect(() => {
    if (over || doneRef.current) return;
    if (msLeft <= 0) {
      const hint = anyWordStartingWith(letter, usedRef.current);
      loseLife(hint ? `خلص الوقت! كان ينفع «${hint}»` : "خلص الوقت!");
    }
  }, [msLeft, over, letter, loseLife]);

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 350); return () => clearTimeout(t); }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (over || doneRef.current) return;
    const w = text.trim();
    if (!w) return;

    const key = normalizeArabic(w);
    if (usedRef.current.has(key)) {
      setText("");
      loseLife("قلتها قبل كده! 🔁");
      return;
    }

    const v = judgeChain(w, letter);
    if (v.t === "bad") {
      setText("");
      loseLife(
        v.reason === "letter"
          ? `لازم تبدأ بحرف «${letter}»`
          : "مش في القاموس — جرب كلمة تانية"
      );
      return;
    }

    // ✅ الكلمة صح — نكمل السلسلة
    const display = v.display;
    const next = lastLetterOf(display);
    const nextCount = countAnyStartingWith(next, new Set([...usedRef.current, key]));

    // بونص السرعة: كل ما ترد أسرع تاخد أكتر
    const speedBonus = Math.round((msLeft / limit) * 5);
    const pts = v.pts + speedBonus;

    usedRef.current.add(key);
    liveRef.current.score += pts;
    liveRef.current.count += 1;
    setScore(liveRef.current.score);
    setChain((c) => [{ word: display, pts, fixed: v.t === "fixed" }, ...c]);
    setText("");
    setFlash({ ok: true, msg: `+${pts.toLocaleString("ar-EG")}${v.t === "fixed" ? " (تصحيح)" : ""}` });
    setTimeout(() => setFlash(null), 1100);

    try {
      sfx.correct();
      fx.burstAtEl(listRef.current, v.t === "exact" ? PALETTES.exact : PALETTES.fixed, 24, 6);
    } catch { /* اتجاهل */ }

    // لو الحرف الجاي مسدود، نلف لحرف تاني عشان اللعب ما يقفش
    let nl = next;
    if (nextCount < 2 || !ELIGIBLE_LETTERS.includes(next)) {
      nl = pickStartLetter();
      setTimeout(() => setFlash({ ok: true, msg: `حرف «${next}» خلصت كلماته — كمّل بـ «${nl}»` }), 60);
      setTimeout(() => setFlash(null), 2000);
    }

    // الوقت بيقل تدريجيًا
    const newLimit = Math.max(MIN_MS, limit - STEP_MS);
    setLimit(newLimit);
    setLetter(nl);
    warnedRef.current = false;
    setDeadline(Date.now() + newLimit);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  /* ============ النتيجة ============ */
  if (over) {
    const best = chain.slice(0, 12);
    return (
      <div className="min-h-dvh flex items-start sm:items-center justify-center px-3 py-6">
        <div className="w-full max-w-md">
          <div className="text-center rise-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-400/15 border border-cyan-300/40 text-cyan-200 font-bold text-sm stamp-in">
              <Link2 className="w-4 h-4" /> وصلة الحروف
            </div>
            <h2 className="font-display title-gradient text-4xl font-extrabold mt-2">
              {liveRef.current.count >= 15 ? "سلسلة أسطورية! 🔗" : "اتقطعت السلسلة! 💔"}
            </h2>
          </div>

          <div className="glass rounded-3xl p-5 mt-4 text-center rise-in" style={{ animationDelay: ".08s" }}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-white/50 font-bold text-xs">طول السلسلة</div>
                <div className="font-display text-5xl font-extrabold text-cyan-300 leading-none pop-in">
                  {liveRef.current.count.toLocaleString("ar-EG")}
                </div>
              </div>
              <div>
                <div className="text-white/50 font-bold text-xs">النقاط</div>
                <div className="font-display text-5xl font-extrabold text-amber-300 leading-none pop-in" style={{ animationDelay: ".1s" }}>
                  {score.toLocaleString("ar-EG")}
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-gradient-to-l from-amber-400/11 to-cyan-400/6 border border-amber-300/40 px-4 py-3 pop-in" style={{ animationDelay: ".2s" }}>
              <div className="flex items-center justify-center gap-2 font-bold text-sm text-amber-100">
                <Coins className="w-4.5 h-4.5 text-amber-300" />
                كسبت <span className="font-display text-lg text-amber-300">{reward.toLocaleString("ar-EG")}</span> جنيه
              </div>
              <div className="text-[11px] font-bold text-white/40 mt-1">رصيدك {wallet.coins.toLocaleString("ar-EG")}</div>
            </div>
          </div>

          {best.length > 0 && (
            <div className="glass rounded-3xl p-4 mt-3 rise-in" style={{ animationDelay: ".15s" }}>
              <h3 className="font-display font-bold text-sm mb-2 text-cyan-200">سلسلتك</h3>
              <div className="flex flex-wrap gap-1.5 items-center">
                {[...best].reverse().map((l, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    {i > 0 && <ArrowLeft className="w-3 h-3 text-white/25" />}
                    <span className="rounded-lg border border-cyan-300/30 bg-cyan-400/12 px-2.5 py-1 text-xs font-bold text-cyan-100">
                      {l.word}
                    </span>
                  </span>
                ))}
                {chain.length > 12 && <span className="text-[11px] font-bold text-white/35">…و{(chain.length - 12).toLocaleString("ar-EG")} كمان</span>}
              </div>
            </div>
          )}

          <button onClick={onExit} className="btn-primary w-full py-3.5 text-xl flex items-center justify-center gap-2 mt-4 rise-in" style={{ animationDelay: ".24s" }}>
            <Home className="w-5.5 h-5.5" /> رجوع
          </button>
        </div>
      </div>
    );
  }

  /* ============ اللعب ============ */
  const lastWord = chain[0]?.word;

  return (
    <div className={`min-h-dvh flex flex-col max-w-lg mx-auto px-4 py-5 ${shake ? "shake" : ""}`}>
      {/* الترويسة */}
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-2xl bg-cyan-400/20 border border-cyan-300/40 flex items-center justify-center shrink-0">
          <Link2 className="w-6 h-6 text-cyan-300" />
        </span>
        <div className="flex-1">
          <div className="text-[11px] font-extrabold text-cyan-300/90">وصلة الحروف</div>
          <div className="font-display text-lg font-extrabold">
            سلسلة {liveRef.current.count.toLocaleString("ar-EG")}
            {liveRef.current.count >= 5 && <Flame className="w-4 h-4 text-rose-300 inline mr-1" />}
          </div>
        </div>
        <Heart className={`w-6 h-6 transition-all ${lives > 0 ? "text-rose-400 fill-rose-400" : "text-white/15 scale-75"}`} />
      </div>

      <div className="text-center mt-1">
        <span key={score} className="font-display text-2xl font-extrabold text-amber-300 pop-in">
          {score.toLocaleString("ar-EG")}
        </span>
      </div>

      {/* الكلمة السابقة + الحرف المطلوب */}
      <div className="flex-1 flex flex-col items-center justify-center py-4">
        {lastWord ? (
          <div className="flex items-center gap-2 mb-4 pop-in" key={lastWord}>
            <span className="rounded-2xl border border-white/15 bg-white/6 px-4 py-2 font-display text-lg font-bold text-white/70">
              {lastWord}
            </span>
            <ArrowLeft className="w-5 h-5 text-cyan-300" />
          </div>
        ) : (
          <p className="text-white/50 font-bold text-sm mb-3">ابدأ السلسلة بكلمة تبدأ بـ</p>
        )}

        <div className="text-center">
          <span className="inline-flex w-24 h-24 rounded-3xl letter-disc items-center justify-center pulse-glow">
            <span className="font-display font-extrabold text-6xl leading-none text-[#33240f]">{letter}</span>
          </span>
          <p className="text-[11px] font-bold text-white/40 mt-2">
            {available.toLocaleString("ar-EG")} كلمة متاحة · أي فئة تنفع
          </p>
        </div>

        {/* عدّاد السرعة */}
        <div className="w-full max-w-xs mt-5">
          <div className="h-3 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-none"
              style={{
                width: `${pct * 100}%`,
                background: pct > 0.5 ? "linear-gradient(90deg,#7fb3d5,#6bc9a0)" : "linear-gradient(90deg,#dd8f8f,#e8b563)",
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] font-extrabold text-white/35 flex items-center gap-1">
              <Timer className="w-3 h-3" /> {(limit / 1000).toLocaleString("ar-EG")}ث للكلمة
            </span>
            <span className={`font-display text-2xl font-extrabold ${secLeft <= 2 ? "warn-pulse" : "text-white/80"}`}>
              {secLeft.toLocaleString("ar-EG")}
            </span>
          </div>
        </div>

        {flash && (
          <div
            className={`mt-3 rounded-2xl px-5 py-2 font-bold pop-in border text-sm ${
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
      <form onSubmit={submit}>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`كلمة بحرف «${letter}»…`}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          className="w-full bg-[#141b2e]/70 border-2 border-cyan-300/40 rounded-2xl px-4 py-4 text-xl font-extrabold outline-none focus:border-cyan-300/90 transition-colors placeholder:text-white/25 text-center"
        />
        <button type="submit" className="btn-primary w-full py-3 mt-2 text-lg flex items-center justify-center gap-2">
          <Zap className="w-5 h-5" /> وصّل
        </button>
      </form>

      {/* السلسلة */}
      <div ref={listRef} className="mt-3 min-h-14 max-h-28 overflow-y-auto">
        {chain.length === 0 ? (
          <p className="text-center text-[11px] font-bold text-white/30 leading-5 flex items-center justify-center gap-1">
            <Lightbulb className="w-3.5 h-3.5 text-amber-300/60" />
            كل كلمة تبدأ بآخر حرف من اللي قبلها — أحمـ<span className="text-cyan-300">د</span> ← <span className="text-cyan-300">د</span>ولاـ<span className="text-cyan-300">ب</span> ← <span className="text-cyan-300">ب</span>رتقال
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {chain.slice(0, 14).map((l, i) => (
              <span
                key={`${l.word}-${i}`}
                className={`pop-in inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold ${
                  l.fixed
                    ? "border-sky-300/35 bg-sky-400/12 text-sky-100"
                    : "border-cyan-300/30 bg-cyan-400/10 text-cyan-100"
                }`}
              >
                {l.word}
                <span className="font-display text-white/35">+{l.pts.toLocaleString("ar-EG")}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <button onClick={finish} className="btn-ghost w-full py-2.5 mt-2 text-sm font-bold text-white/50 flex items-center justify-center gap-2">
        <Trophy className="w-4 h-4" /> إنهاء
      </button>
    </div>
  );
}
