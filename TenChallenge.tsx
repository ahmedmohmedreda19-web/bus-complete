import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Timer, Home, Check, Wand2, Star, Trophy, BookOpen, Zap, Coins, Target, Flame } from "lucide-react";
import { CATS, judge, wordsFor, countWordsFor, randomLetter, type CatKey } from "../data/lexicon";
import { normalizeArabic } from "../lib/arabic";
import { earn, useWallet } from "../lib/wallet";
import { bumpStats, pushHistory } from "../lib/storage";
import { checkAchievements } from "../lib/achievements";
import { submitRecord } from "../lib/globalBoard";
import { readProfile } from "../lib/profile";
import { sfx } from "../lib/sound";
import { fx, PALETTES } from "../lib/fx";

export const TEN_GOAL = 10;
const DURATION = 60_000;
const REWARD_PER_WORD = 5;
const COMPLETE_BONUS = 60;

interface Found { word: string; pts: number; t: "exact" | "fixed" | "ok" }

/** اختيار فئة وحرف فيهم كلمات كافية للتحدي */
export function pickTenChallenge(): { cat: CatKey; label: string; color: string; letter: string; available: number } {
  const pool: { cat: CatKey; label: string; color: string; letter: string; available: number }[] = [];
  for (const c of CATS) {
    for (let i = 0; i < 30; i++) {
      const l = randomLetter();
      const n = countWordsFor(c.key, l);
      if (n >= TEN_GOAL + 2) pool.push({ cat: c.key, label: c.label, color: c.color, letter: l, available: n });
    }
  }
  if (pool.length === 0) {
    const c = CATS[0];
    const l = randomLetter();
    return { cat: c.key, label: c.label, color: c.color, letter: l, available: countWordsFor(c.key, l) };
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function TenChallenge({ onExit }: { onExit: () => void }) {
  const [chal] = useState(() => pickTenChallenge());
  const [text, setText] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [remaining, setRemaining] = useState(DURATION);
  const [msg, setMsg] = useState("");
  const [shake, setShake] = useState(false);
  const [over, setOver] = useState(false);
  const [reward, setReward] = useState(0);
  const wallet = useWallet();

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const foundRef = useRef<Found[]>([]);
  foundRef.current = found;
  const tickRef = useRef(-1);

  const score = useMemo(() => found.reduce((s, f) => s + f.pts, 0), [found]);
  const secs = Math.ceil(remaining / 1000);
  const complete = found.length >= TEN_GOAL;

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const list = foundRef.current;
    const pts = list.reduce((s, f) => s + f.pts, 0);
    const done = list.length >= TEN_GOAL;
    const coins = list.length * REWARD_PER_WORD + (done ? COMPLETE_BONUS : 0);
    setReward(coins);
    try {
      earn(coins);
      bumpStats({ score: pts, words: list.length, won: done });
      pushHistory({ d: Date.now(), letter: chal.letter, score: pts, mode: "solo" });
      checkAchievements();
      const prof = readProfile();
      submitRecord({ name: prof.name || "النجم", avatar: prof.avatar, score: pts, mode: "ten" });
    } catch { /* اتجاهل */ }
    try {
      if (done) { sfx.fanfare(); fx.rain(PALETTES.win, 140); }
      else sfx.horn();
    } catch { /* اتجاهل */ }
    setOver(true);
  }, [chal.letter]);

  useEffect(() => {
    if (over) return;
    const iv = setInterval(() => {
      setRemaining((r) => {
        const next = r - 100;
        const s = Math.ceil(next / 1000);
        if (s <= 5 && s !== tickRef.current && s > 0) { tickRef.current = s; try { sfx.warn(); } catch { /* اتجاهل */ } }
        if (next <= 0) { clearInterval(iv); setTimeout(finish, 50); return 0; }
        return next;
      });
    }, 100);
    return () => clearInterval(iv);
  }, [over, finish]);

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 400); return () => clearTimeout(t); }, []);

  // وصلت العشرة؟ خلاص
  useEffect(() => {
    if (found.length >= TEN_GOAL && !doneRef.current) setTimeout(finish, 700);
  }, [found.length, finish]);

  const flash = (s: string) => { setMsg(s); setTimeout(() => setMsg(""), 1600); };
  const bump = () => { setShake(true); setTimeout(() => setShake(false), 400); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (over) return;
    const w = text.trim();
    if (!w) return;
    const key = normalizeArabic(w);
    if (foundRef.current.some((f) => normalizeArabic(f.word) === key)) {
      try { sfx.bad(); } catch { /* اتجاهل */ }
      flash("قلتها قبل كده! 😄");
      bump();
      setText("");
      return;
    }
    const v = judge(chal.cat, w, chal.letter);
    if (v.t === "bad") {
      try { sfx.bad(); } catch { /* اتجاهل */ }
      flash(v.reason === "letter" ? `لازم تبدأ بحرف «${chal.letter}»` : "مش كلمة مظبوطة");
      bump();
      return;
    }
    setFound((f) => [{ word: v.display, pts: v.pts, t: v.t }, ...f]);
    setText("");
    try {
      if (v.t === "exact") { sfx.correct(); fx.burstAtEl(listRef.current, PALETTES.exact, 26, 7); }
      else if (v.t === "fixed") { sfx.fixed(); fx.burstAtEl(listRef.current, PALETTES.fixed, 22, 6); }
      else { sfx.ok(); fx.burstAtEl(listRef.current, PALETTES.ok, 18, 5); }
    } catch { /* اتجاهل */ }
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  /* ====== النتيجة ====== */
  if (over) {
    const missed = wordsFor(chal.cat, chal.letter, 40)
      .filter((w) => !found.some((f) => normalizeArabic(f.word) === normalizeArabic(w)))
      .slice(0, 12);
    return (
      <div className="min-h-dvh flex items-start sm:items-center justify-center px-3 py-6">
        <div className="w-full max-w-md">
          <div className="text-center rise-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-400/15 border border-violet-300/40 text-violet-200 font-bold text-sm stamp-in">
              <Target className="w-4 h-4" /> تحدي العشر كلمات
            </div>
            <h2 className="font-display title-gradient text-4xl font-extrabold mt-2">
              {complete ? "كمّلت العشرة! 🎉" : "خلص الوقت"}
            </h2>
            <p className="text-white/60 font-bold text-sm mt-1">{chal.label} بحرف «{chal.letter}»</p>
          </div>

          <div className="glass rounded-3xl p-5 mt-4 text-center rise-in" style={{ animationDelay: ".08s" }}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-white/50 font-bold text-xs">لقيت</div>
                <div className={`font-display text-5xl font-extrabold leading-none pop-in ${complete ? "text-emerald-300" : "text-white/85"}`}>
                  {found.length.toLocaleString("ar-EG")}<span className="text-2xl text-white/40">/{TEN_GOAL.toLocaleString("ar-EG")}</span>
                </div>
              </div>
              <div>
                <div className="text-white/50 font-bold text-xs">النقاط</div>
                <div className="font-display text-5xl font-extrabold text-amber-300 leading-none pop-in" style={{ animationDelay: ".1s" }}>
                  {score.toLocaleString("ar-EG")}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-gradient-to-l from-amber-400/11 to-emerald-400/6 border border-amber-300/40 px-4 py-3 pop-in" style={{ animationDelay: ".2s" }}>
              <div className="flex items-center justify-center gap-2 font-bold text-sm text-amber-100">
                <Coins className="w-4.5 h-4.5 text-amber-300" />
                كسبت <span className="font-display text-lg text-amber-300">{reward.toLocaleString("ar-EG")}</span> جنيه
                {complete && <span className="text-emerald-300 text-xs">(+{COMPLETE_BONUS.toLocaleString("ar-EG")} بونص)</span>}
              </div>
              <div className="text-[11px] font-bold text-white/40 mt-1">رصيدك {wallet.coins.toLocaleString("ar-EG")}</div>
            </div>
          </div>

          {found.length > 0 && (
            <div className="glass rounded-3xl p-4 mt-3 rise-in" style={{ animationDelay: ".15s" }}>
              <h3 className="font-display font-bold text-sm mb-2 text-emerald-200">إجاباتك</h3>
              <div className="flex flex-wrap gap-1.5">
                {found.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/30 bg-emerald-400/12 px-2.5 py-1 text-xs font-bold text-emerald-100">
                    {f.word} <span className="font-display text-white/40">{f.pts.toLocaleString("ar-EG")}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {missed.length > 0 && (
            <div className="glass rounded-3xl p-4 mt-3 rise-in" style={{ animationDelay: ".2s" }}>
              <h3 className="font-display font-bold text-sm mb-2 text-white/70 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-sky-300" /> كلمات فاتتك
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {missed.map((w) => (
                  <span key={w} className="rounded-lg border border-white/12 bg-white/6 px-2.5 py-1 text-xs font-bold text-white/60">{w}</span>
                ))}
              </div>
            </div>
          )}

          <button onClick={onExit} className="btn-primary w-full py-3.5 text-xl flex items-center justify-center gap-2 mt-4 rise-in" style={{ animationDelay: ".26s" }}>
            <Home className="w-5.5 h-5.5" /> رجوع للقائمة
          </button>
        </div>
      </div>
    );
  }

  /* ====== اللعب ====== */
  return (
    <div className={`min-h-dvh flex flex-col max-w-lg mx-auto px-4 py-5 ${shake ? "shake" : ""}`}>
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-2xl letter-disc flex items-center justify-center shrink-0 pop-in">
          <span className="font-display font-extrabold text-4xl leading-none text-[#33240f]">{chal.letter}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-violet-300/90">
            <Target className="w-3.5 h-3.5" /> تحدي العشر كلمات
          </div>
          <div className="font-display text-2xl font-extrabold leading-7" style={{ color: chal.color }}>
            ١٠ {chal.label} بحرف «{chal.letter}»
          </div>
          <div className="text-[10px] font-bold text-white/40">
            القاموس عارف {chal.available.toLocaleString("ar-EG")} كلمة هنا
          </div>
        </div>
        <div className="text-left shrink-0">
          <div className={`flex items-center gap-1 font-display font-bold text-xl ${secs <= 10 ? "warn-pulse" : "text-white/85"}`}>
            <Timer className="w-4.5 h-4.5" /> {secs.toLocaleString("ar-EG")}
          </div>
          <div key={score} className="font-display text-amber-300 font-bold text-lg tabular-nums pop-in text-center">
            {score.toLocaleString("ar-EG")}
          </div>
        </div>
      </div>

      <div className="h-2.5 rounded-full bg-white/8 overflow-hidden mt-3">
        <div
          className="ribbon h-full rounded-full"
          style={{
            width: `${(remaining / DURATION) * 100}%`,
            background: secs <= 15 ? "linear-gradient(90deg,#dd8f8f,#e0899b)" : "linear-gradient(90deg,#a898d0,#6bc9a0,#e8b563)",
          }}
        />
      </div>

      {/* عدّاد العشرة */}
      <div className="flex items-center gap-1.5 mt-3">
        <div className="flex-1 flex gap-1">
          {Array.from({ length: TEN_GOAL }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 flex-1 rounded-full transition-all ${
                i < found.length ? "bg-gradient-to-l from-emerald-400 to-violet-400" : "bg-white/10"
              }`}
            />
          ))}
        </div>
        <span className={`font-display text-sm font-extrabold ${complete ? "text-emerald-300" : "text-white/55"}`}>
          {found.length.toLocaleString("ar-EG")}/{TEN_GOAL.toLocaleString("ar-EG")}
        </span>
      </div>

      <form onSubmit={submit} className="mt-4">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`${chal.label} بحرف «${chal.letter}»…`}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          className="w-full bg-[#141b2e]/70 border-2 border-violet-300/40 rounded-2xl px-4 py-4 text-xl font-extrabold outline-none focus:border-violet-300/90 transition-colors placeholder:text-white/25 text-center"
        />
        <button type="submit" className="btn-primary w-full py-3 mt-2 text-lg flex items-center justify-center gap-2">
          <Zap className="w-5 h-5" /> ضيف الكلمة
        </button>
      </form>

      <div className="h-5 mt-2 text-center text-xs font-bold text-rose-300/90">{msg}</div>

      <div ref={listRef} className="flex-1 mt-2 overflow-y-auto">
        {found.length === 0 ? (
          <p className="text-center text-white/35 font-bold text-sm py-8 leading-6">
            اكتب ١٠ كلمات من «{chal.label}» بحرف «{chal.letter}»
            <br />
            <span className="text-[11px] text-white/25">كل كلمة +٥ جنيه · وبونص ٦٠ لو كمّلت العشرة</span>
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {found.map((f, i) => (
              <span
                key={`${f.word}-${i}`}
                className={`pop-in inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-bold ${
                  f.t === "exact"
                    ? "border-emerald-300/40 bg-emerald-400/12 text-emerald-100"
                    : f.t === "fixed"
                      ? "border-sky-300/40 bg-sky-400/12 text-sky-100"
                      : "border-amber-300/40 bg-amber-400/12 text-amber-100"
                }`}
              >
                {f.t === "exact" ? <Check className="w-3.5 h-3.5" /> : f.t === "fixed" ? <Wand2 className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
                {f.word}
                <span className="font-display text-white/45">+{f.pts.toLocaleString("ar-EG")}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <button onClick={finish} className="btn-ghost w-full py-3 mt-2 flex items-center justify-center gap-2 font-bold text-white/70 shrink-0">
        <Trophy className="w-4.5 h-4.5 text-amber-300" /> خلصت — اعرض النتيجة
      </button>
      <p className="text-center text-[10px] font-bold text-white/30 mt-1.5 flex items-center justify-center gap-1">
        <Flame className="w-3 h-3 text-rose-300" />
        كل كلمة +٥ جنيه · كمّل العشرة وخد +{COMPLETE_BONUS.toLocaleString("ar-EG")}
      </p>
    </div>
  );
}
