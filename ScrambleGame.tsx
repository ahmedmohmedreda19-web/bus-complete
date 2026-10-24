import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Shuffle, Timer, Home, Check, Coins, Trophy, BookOpen, Zap, Delete, Target } from "lucide-react";
import { judgeScramble, solutionsFor, allSolutionsFor } from "../data/lexicon";
import { makeScramble, reshuffle, sameWord, SCRAMBLE_MS } from "../lib/scramble";
import { earn, useWallet } from "../lib/wallet";
import { bumpStats, pushHistory } from "../lib/storage";
import { checkAchievements } from "../lib/achievements";
import { submitRecord } from "../lib/globalBoard";
import { useProfile } from "../lib/profile";
import { sfx } from "../lib/sound";
import { fx, PALETTES } from "../lib/fx";

const REWARD_PER_WORD = 8;
const COMPLETE_BONUS = 70;

interface Found { word: string; pts: number }

export default function ScrambleGame({ onExit }: { onExit: () => void }) {
  const profile = useProfile();
  const wallet = useWallet();

  const [round] = useState(() => makeScramble());
  const [shown, setShown] = useState<string[]>(() => round.pool);
  const [picked, setPicked] = useState<number[]>([]);   // مؤشرات الحروف المختارة
  const [found, setFound] = useState<Found[]>([]);
  const [remaining, setRemaining] = useState(SCRAMBLE_MS);
  const [msg, setMsg] = useState("");
  const [shake, setShake] = useState(false);
  const [over, setOver] = useState(false);
  const [reward, setReward] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const foundRef = useRef<Found[]>([]);
  foundRef.current = found;
  const tickRef = useRef(-1);

  const word = useMemo(() => picked.map((i) => shown[i]).join(""), [picked, shown]);
  const score = useMemo(() => found.reduce((s, f) => s + f.pts, 0), [found]);
  const secs = Math.ceil(remaining / 1000);
  const complete = found.length >= round.goal;

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const list = foundRef.current;
    const pts = list.reduce((s, f) => s + f.pts, 0);
    const done = list.length >= round.goal;
    const coins = list.length * REWARD_PER_WORD + (done ? COMPLETE_BONUS : 0);
    setReward(coins);
    try {
      earn(coins);
      bumpStats({ score: pts, words: list.length, won: done });
      pushHistory({ d: Date.now(), letter: "🔤", score: pts, mode: "solo" });
      submitRecord({ name: profile.name || "النجم", avatar: profile.avatar, score: pts, mode: "scramble" });
      checkAchievements();
    } catch { /* اتجاهل */ }
    try {
      if (done) { sfx.fanfare(); fx.rain(PALETTES.win, 140); }
      else sfx.horn();
    } catch { /* اتجاهل */ }
    setOver(true);
  }, [round.goal, profile.avatar, profile.name]);

  // المؤقّت
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

  // وصلت الهدف؟
  useEffect(() => {
    if (found.length >= round.goal && !doneRef.current) setTimeout(finish, 800);
  }, [found.length, round.goal, finish]);

  const flash = (s: string) => { setMsg(s); setTimeout(() => setMsg(""), 1500); };
  const bump = () => { setShake(true); setTimeout(() => setShake(false), 400); };

  const pick = (i: number) => {
    if (over || picked.includes(i)) return;
    setPicked((p) => [...p, i]);
    try { sfx.tick(); } catch { /* اتجاهل */ }
  };

  const unpick = () => {
    setPicked((p) => p.slice(0, -1));
    try { sfx.tick(); } catch { /* اتجاهل */ }
  };

  const clear = () => setPicked([]);

  const shuffleLetters = () => {
    setShown((s) => reshuffle(s));
    setPicked([]);
    try { sfx.flip(); } catch { /* اتجاهل */ }
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (over || !word) return;

    if (foundRef.current.some((f) => sameWord(f.word, word))) {
      try { sfx.bad(); } catch { /* اتجاهل */ }
      flash("قلتها قبل كده! 😄");
      bump();
      clear();
      return;
    }

    const v = judgeScramble(round.cat, word, round.pool);
    if (v.t === "bad") {
      try { sfx.bad(); } catch { /* اتجاهل */ }
      if (v.reason === "letter") {
        flash("استخدم الحروف المتاحة بس");
      } else if (round.cat) {
        flash(`مش «${round.label}» في القاموس`);
      } else {
        flash("مش كلمة مفهومة في القاموس");
      }
      bump();
      clear();
      return;
    }

    setFound((f) => [{ word: v.display, pts: v.pts }, ...f]);
    clear();
    try { sfx.correct(); fx.burstAtEl(listRef.current, PALETTES.exact, 26, 7); } catch { /* اتجاهل */ }
  };

  /* ===== النتيجة ===== */
  if (over) {
    const rawMissed: string[] = round.cat
      ? (solutionsFor(round.pool, 16)[round.cat] ?? [])
      : allSolutionsFor(round.pool, 18);

    const missed = rawMissed
      .filter((w: string) => !found.some((f) => sameWord(f.word, w)))
      .slice(0, 14);

    return (
      <div className="min-h-dvh flex items-start sm:items-center justify-center px-3 py-6">
        <div className="w-full max-w-md">
          <div className="text-center rise-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-fuchsia-400/15 border border-fuchsia-300/40 text-fuchsia-200 font-bold text-sm stamp-in">
              <Shuffle className="w-4 h-4" /> الحروف المتلغبطة
            </div>
            <h2 className="font-display title-gradient text-4xl font-extrabold mt-2">
              {complete ? "لغبطتها صح! 🎉" : "خلص الوقت"}
            </h2>
            <p className="text-white/60 font-bold text-sm mt-1">{round.label} ({round.goal.toLocaleString("ar-EG")} مطلوبين)</p>
          </div>

          <div className="glass rounded-3xl p-5 mt-4 text-center rise-in" style={{ animationDelay: ".08s" }}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-white/50 font-bold text-xs">طلّعت</div>
                <div className={`font-display text-5xl font-extrabold leading-none pop-in ${complete ? "text-emerald-300" : "text-white/85"}`}>
                  {found.length.toLocaleString("ar-EG")}<span className="text-2xl text-white/40">/{round.goal.toLocaleString("ar-EG")}</span>
                </div>
              </div>
              <div>
                <div className="text-white/50 font-bold text-xs">النقاط</div>
                <div className="font-display text-5xl font-extrabold text-amber-300 leading-none pop-in" style={{ animationDelay: ".1s" }}>
                  {score.toLocaleString("ar-EG")}
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-gradient-to-l from-amber-400/11 to-fuchsia-400/6 border border-amber-300/40 px-4 py-3 pop-in" style={{ animationDelay: ".2s" }}>
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
              <h3 className="font-display font-bold text-sm mb-2 text-emerald-200">كلماتك</h3>
              <div className="flex flex-wrap gap-1.5">
                {found.map((f, i) => (
                  <span key={i} className="rounded-lg border border-emerald-300/30 bg-emerald-400/12 px-2.5 py-1 text-xs font-bold text-emerald-100">
                    {f.word}
                  </span>
                ))}
              </div>
            </div>
          )}

          {missed.length > 0 && (
            <div className="glass rounded-3xl p-4 mt-3 rise-in" style={{ animationDelay: ".2s" }}>
              <h3 className="font-display font-bold text-sm mb-2 text-white/70 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-sky-300" /> كان ينفع كمان
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {missed.map((w: string) => (
                  <span key={w} className="rounded-lg border border-white/12 bg-white/6 px-2.5 py-1 text-xs font-bold text-white/60">{w}</span>
                ))}
              </div>
            </div>
          )}

          <button onClick={onExit} className="btn-primary w-full py-3.5 text-xl flex items-center justify-center gap-2 mt-4 rise-in" style={{ animationDelay: ".26s" }}>
            <Home className="w-5.5 h-5.5" /> رجوع
          </button>
        </div>
      </div>
    );
  }

  /* ===== اللعب ===== */
  return (
    <div className={`min-h-dvh flex flex-col max-w-lg mx-auto px-4 py-5 ${shake ? "shake" : ""}`}>
      {/* الترويسة */}
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-2xl bg-fuchsia-400/20 border border-fuchsia-300/40 flex items-center justify-center shrink-0">
          <Shuffle className="w-6 h-6 text-fuchsia-300" />
        </span>
        <div className="flex-1">
          <div className="text-[11px] font-extrabold text-fuchsia-300/90 flex items-center gap-1">
            الحروف المتلغبطة
            {round.mode === "any" ? (
              <span className="rounded-full bg-purple-400/20 border border-purple-300/40 text-purple-200 px-1.5 py-0.2 text-[9px]">مفتوح</span>
            ) : (
              <span className="rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 px-1.5 py-0.2 text-[9px]">فئة محددة</span>
            )}
          </div>
          <div className="font-display text-xl font-extrabold leading-tight mt-0.5" style={{ color: round.color }}>
            طلّع {round.goal.toLocaleString("ar-EG")} {round.label}
          </div>
          <div className="text-[10px] font-bold text-white/50">{round.subLabel}</div>
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

      {/* شريط الوقت */}
      <div className="h-2.5 rounded-full bg-white/8 overflow-hidden mt-3">
        <div
          className="ribbon h-full rounded-full"
          style={{
            width: `${(remaining / SCRAMBLE_MS) * 100}%`,
            background: secs <= 15 ? "linear-gradient(90deg,#dd8f8f,#e0899b)" : "linear-gradient(90deg,#c49ad0,#a898d0,#e8b563)",
          }}
        />
      </div>

      {/* تقدم الهدف */}
      <div className="flex items-center gap-1.5 mt-3">
        <div className="flex-1 flex gap-1">
          {Array.from({ length: round.goal }).map((_, i) => (
            <span key={i} className={`h-2.5 flex-1 rounded-full transition-all ${i < found.length ? "bg-gradient-to-l from-emerald-400 to-fuchsia-400" : "bg-white/10"}`} />
          ))}
        </div>
        <span className={`font-display text-sm font-extrabold ${complete ? "text-emerald-300" : "text-white/55"}`}>
          {found.length.toLocaleString("ar-EG")}/{round.goal.toLocaleString("ar-EG")}
        </span>
      </div>

      {/* الكلمة اللي بتتكوّن */}
      <div className="mt-5 flex items-center justify-center gap-1.5 min-h-16">
        {picked.length === 0 ? (
          <p className="text-white/30 font-bold text-sm">اضغط على الحروف تحت</p>
        ) : (
          picked.map((idx, k) => (
            <span
              key={k}
              className="pop-in w-11 h-12 rounded-xl bg-fuchsia-400/25 border-2 border-fuchsia-300/60 flex items-center justify-center font-display text-2xl font-extrabold text-fuchsia-50"
            >
              {shown[idx]}
            </span>
          ))
        )}
      </div>

      {/* أزرار التحكم */}
      <div className="flex items-center justify-center gap-2 mt-2">
        <button onClick={unpick} disabled={!picked.length} className="btn-ghost px-3 py-2 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40">
          <Delete className="w-4 h-4" /> امسح حرف
        </button>
        <button onClick={shuffleLetters} className="btn-ghost px-3 py-2 text-xs font-bold flex items-center gap-1.5">
          <Shuffle className="w-4 h-4 text-fuchsia-300" /> لغبط تاني
        </button>
      </div>

      {/* الحروف المتاحة */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
        {shown.map((ch, i) => {
          const used = picked.includes(i);
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={used}
              className={`w-14 h-14 rounded-2xl font-display text-3xl font-extrabold transition-all ${
                used
                  ? "bg-white/5 border border-white/10 text-white/20 scale-90"
                  : "letter-disc text-[#33240f] hover:scale-105 active:scale-95"
              }`}
            >
              {ch}
            </button>
          );
        })}
      </div>

      <div className="h-5 mt-2 text-center text-xs font-bold text-rose-300/90">{msg}</div>

      <button
        onClick={() => submit()}
        disabled={!word}
        className="btn-primary w-full py-3.5 mt-1 text-lg flex items-center justify-center gap-2 disabled:opacity-45"
      >
        <Check className="w-5 h-5" strokeWidth={2.75} /> تأكيد الكلمة
      </button>

      {/* الكلمات اللي طلعت */}
      <div ref={listRef} className="flex-1 mt-3 overflow-y-auto min-h-12">
        {found.length === 0 ? (
          <p className="text-center text-[11px] font-bold text-white/30 leading-5 flex items-center justify-center gap-1">
            <Target className="w-3.5 h-3.5 text-fuchsia-300/60" />
            {round.available.toLocaleString("ar-EG")} كلمة ممكنة من الحروف دي
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {found.map((f, i) => (
              <span key={i} className="pop-in inline-flex items-center gap-1 rounded-xl border border-emerald-300/40 bg-emerald-400/12 px-3 py-1.5 text-sm font-bold text-emerald-100">
                <Check className="w-3.5 h-3.5" />
                {f.word}
                <span className="font-display text-white/45">+{f.pts.toLocaleString("ar-EG")}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <button onClick={finish} className="btn-ghost w-full py-2.5 mt-2 text-sm font-bold text-white/50 flex items-center justify-center gap-2">
        <Trophy className="w-4 h-4 text-amber-300" /> خلصت
      </button>
      <p className="text-center text-[10px] font-bold text-white/30 mt-1 flex items-center justify-center gap-1">
        <Zap className="w-3 h-3" /> كل كلمة +{REWARD_PER_WORD.toLocaleString("ar-EG")} جنيه · كمّل الهدف وخد +{COMPLETE_BONUS.toLocaleString("ar-EG")}
      </p>
    </div>
  );
}
