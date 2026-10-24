import { useEffect, useState } from "react";
import { Trophy, OctagonX, Hourglass, RotateCcw, Home, Bus, Crown, Star, Check, Wand2, Coins, ShoppingBag, Bot, Medal, BookPlus, Plus, CalendarDays, Gift, Flame } from "lucide-react";
import type { RoundAnswer } from "./Game";
import Shop from "./Shop";
import { useWallet } from "../lib/wallet";
import { fx, PALETTES } from "../lib/fx";
import { sfx } from "../lib/sound";
import { CATS, addCustomWord, isKnownWord, type CatKey } from "../data/lexicon";
import type { BotResult } from "../lib/bots";
import Dictionary from "./Dictionary";

export default function Results({
  letter, answers, roundScore, bonus, stopped, sessionTotal, rounds, savedRank, bots, beatBots,
  isDaily = false, dailyReward = 0, dailyStreak = 0, onNext, onRestart, onMenu,
}: {
  letter: string;
  answers: RoundAnswer[];
  roundScore: number;
  bonus: number;
  stopped: boolean;
  sessionTotal: number;
  rounds: number;
  savedRank: number; // -1 لو مش من التوب
  bots: BotResult[] | null;
  beatBots: boolean;
  isDaily?: boolean;
  dailyReward?: number;
  dailyStreak?: number;
  onNext: () => void;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const total = roundScore + bonus;
  const wallet = useWallet();
  const [shopOpen, setShopOpen] = useState(false);
  const [dictOpen, setDictOpen] = useState(false);
  const [added, setAdded] = useState<Record<string, boolean>>({});

  // كلمات كسبت ٢ نقطة بس (مش في القاموس) — ممكن تضيفها
  const addable = answers.filter(
    (a) => a.verdict && a.verdict.t === "ok" && !isKnownWord(a.cat as CatKey, a.verdict.display)
  );

  const promote = (cat: CatKey, word: string) => {
    const res = addCustomWord(cat, word);
    if (res === "added" || res === "exists") {
      sfx.correct();
      setAdded((m) => ({ ...m, [cat]: true }));
      fx.burst(window.innerWidth / 2, window.innerHeight / 2, PALETTES.exact, 26, 6);
    } else sfx.bad();
  };

  // ترتيب المنافسة: أنت + البوتات
  const ranking = bots && bots.length > 0
    ? [
        { id: "you", name: "أنت", title: "", total, roundPts: roundScore, bonus, stopped, isBot: false },
        ...bots.map((b) => ({ id: b.id, name: b.name, title: b.title, total: b.total, roundPts: b.roundPts, bonus: b.bonus, stopped: b.stopped, isBot: true })),
      ].sort((a, b) => b.total - a.total)
    : null;

  const playerVerdict = (cat: string) => {
    const a = answers.find((x) => x.cat === cat);
    return a?.verdict && a.verdict.t !== "bad" ? a.verdict : null;
  };

  const tierCls = (v: { t: string } | null) => {
    if (!v) return "bg-white/[.03] border-white/10 text-white/30";
    if (v.t === "exact") return "bg-emerald-400/12 border-emerald-300/35 text-emerald-200";
    if (v.t === "fixed") return "bg-sky-400/12 border-sky-300/35 text-sky-200";
    return "bg-amber-400/12 border-amber-300/35 text-amber-200";
  };

  useEffect(() => {
    if (total >= 80) { fx.rain(PALETTES.win, 160); sfx.fanfare(); }
    else if (total >= 45) { fx.burst(window.innerWidth / 2, window.innerHeight / 3, PALETTES.win, 60, 9); sfx.correct(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verdictInfo = (a: RoundAnswer) => {
    if (!a.verdict || a.verdict.t === "bad") return { label: "فاضية", cls: "text-white/35 bg-white/5", icon: <OctagonX className="w-4 h-4" /> };
    const v = a.verdict;
    if (v.t === "exact") return { label: `صح +${v.pts.toLocaleString("ar-EG")}`, cls: "text-emerald-300 bg-emerald-400/12", icon: <Check className="w-4 h-4" /> };
    if (v.t === "fixed") return { label: `تصحيح +${v.pts.toLocaleString("ar-EG")}`, cls: "text-sky-300 bg-sky-400/12", icon: <Wand2 className="w-4 h-4" /> };
    return { label: `مقبولة +${v.pts.toLocaleString("ar-EG")}`, cls: "text-amber-300 bg-amber-400/12", icon: <Star className="w-4 h-4" /> };
  };

  return (
    <div className="min-h-dvh flex items-start sm:items-center justify-center px-3 py-6">
      <div className="w-full max-w-md">
        {/* الترويسة */}
        <div className="text-center rise-in">
          {savedRank === 0 ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/15 border border-amber-300/40 text-amber-300 font-bold text-sm stamp-in">
              <Crown className="w-4 h-4" /> رقم قياسي جديد!
            </div>
          ) : savedRank > 0 ? (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/6 border border-white/12 text-white/80 font-bold text-sm pop-in">
              <Trophy className="w-4 h-4 text-amber-300" /> ترتيبك في لوحة الشرف: #{(savedRank + 1).toLocaleString("ar-EG")}
            </div>
          ) : null}
          {isDaily && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mt-2 rounded-full bg-amber-400/15 border border-amber-300/40 text-amber-200 font-bold text-sm stamp-in">
              <CalendarDays className="w-4 h-4" /> التحدي اليومي — {answers[0]?.label ?? "سؤال"} بحرف «{letter}»
            </div>
          )}
          <h2 className="font-display title-gradient text-4xl sm:text-5xl font-extrabold mt-2">
            {stopped ? "وقّفت الأتوبيس!" : "الأتوبيس سابك!"}
          </h2>
          <p className="text-white/55 font-bold text-sm mt-1 flex items-center justify-center gap-1.5">
            <Hourglass className="w-4 h-4" />
            {stopped ? "أنهيت الجولة على مزاجك" : "الوقت خلص — الجولة انتهت"}
          </p>
        </div>

        {/* نقاط الجولة */}
        <div className="glass rounded-3xl p-5 mt-4 text-center rise-in" style={{ animationDelay: ".08s" }}>
          <div className="text-white/50 font-bold text-xs mb-1">نقاط الجولة (حرف «{letter}»)</div>
          <div className="font-display text-6xl font-extrabold text-amber-300 leading-none pop-in" style={{ animationDelay: ".2s" }}>
            {total.toLocaleString("ar-EG")}
          </div>
          {bonus > 0 && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-300 bg-emerald-400/12 rounded-full px-3 py-1">
              <Bus className="w-4 h-4" /> بونص السرعة +{bonus.toLocaleString("ar-EG")}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-amber-400/12 border border-amber-300/30 px-4 py-2.5 pop-in" style={{ animationDelay: ".25s" }}>
            <Coins className="w-4.5 h-4.5 text-amber-300" />
            <span className="font-bold text-sm text-amber-200">
              كسبت <span className="font-display">{total.toLocaleString("ar-EG")}</span> جنيه
            </span>
            <span className="text-white/30 text-xs font-bold">· رصيدك: <span className="font-display text-amber-300">{wallet.coins.toLocaleString("ar-EG")}</span> جنيه{wallet.gems > 0 && <> + <span className="font-display text-sky-300">{wallet.gems.toLocaleString("ar-EG")}</span> جوهرة</>}</span>
          </div>
          {beatBots && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-violet-400/15 border border-violet-300/40 px-4 py-2 pop-in" style={{ animationDelay: ".3s" }}>
              <Crown className="w-4.5 h-4.5 text-violet-300" />
              <span className="font-bold text-sm text-violet-200">
                كسبت كل البوتات! جايزة الفوز <span className="font-display">+٢٠ جنيه</span>
              </span>
            </div>
          )}
          {isDaily && dailyReward > 0 && (
            <div className="mt-3 rounded-2xl bg-gradient-to-l from-amber-400/11 to-emerald-400/6 border border-amber-300/40 px-4 py-3 pop-in" style={{ animationDelay: ".34s" }}>
              <div className="flex items-center justify-center gap-2 font-bold text-sm text-amber-100">
                <Gift className="w-4.5 h-4.5 text-amber-300" />
                جايزة التحدي اليومي <span className="font-display text-lg text-amber-300">+{dailyReward.toLocaleString("ar-EG")}</span> جنيه
              </div>
              {dailyStreak > 1 && (
                <div className="flex items-center justify-center gap-1.5 mt-1.5 text-xs font-extrabold text-rose-200">
                  <Flame className="w-4 h-4 text-rose-300" />
                  سلسلة {dailyStreak.toLocaleString("ar-EG")} أيام ورا بعض — كمّل بكرة!
                </div>
              )}
            </div>
          )}
          <div className="flex justify-between items-center mt-4 pt-3 border-t border-white/8 text-sm font-bold">
            <span className="text-white/50">مجموع الجلسة · {rounds.toLocaleString("ar-EG")} جولة</span>
            <span className="font-display text-2xl text-white">{sessionTotal.toLocaleString("ar-EG")}</span>
          </div>
        </div>

        {/* منصة المنافسة مع البوتات */}
        {ranking && (
          <div className="glass rounded-3xl p-4 mt-3 rise-in" style={{ animationDelay: ".14s" }}>
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-5 h-5 text-violet-300" />
              <h3 className="font-display text-lg font-bold">منصة المنافسة</h3>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {ranking.map((r, i) => (
                <div
                  key={r.id}
                  className={`rounded-2xl p-2.5 text-center border pop-in ${
                    i === 0
                      ? "bg-gradient-to-b from-amber-400/14 to-amber-400/5 border-amber-300/50"
                      : "bg-white/[.04] border-white/10"
                  }`}
                  style={{ animationDelay: `${i * 0.09}s` }}
                >
                  <div className={`mx-auto w-7 h-7 rounded-lg flex items-center justify-center mb-1 ${i === 0 ? "bg-amber-400 text-amber-950" : "bg-white/8 text-white/60"}`}>
                    {i === 0 ? <Crown className="w-4 h-4" /> : i < 3 ? <Medal className="w-3.5 h-3.5" /> : <span className="text-[10px] font-display">{(i + 1).toLocaleString("ar-EG")}</span>}
                  </div>
                  <div className={`font-display font-bold text-xs truncate ${i === 0 ? "text-amber-200" : ""}`}>
                    {r.name}
                  </div>
                  <div className={`font-display font-extrabold leading-none mt-0.5 ${i === 0 ? "text-2xl text-amber-300" : "text-lg text-white/85"}`}>
                    {r.total.toLocaleString("ar-EG")}
                  </div>
                  <div className="text-[10px] font-bold text-white/45 mt-0.5">
                    {r.isBot ? (r.stopped ? "وقّف بدري" : "مع الوقت") : stopped ? "وقّفت بدري" : "مع الوقت"}
                    {r.bonus > 0 && <span className="text-emerald-300"> +{r.bonus.toLocaleString("ar-EG")}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* مقارنة الإجابات: أنت والبوتات */}
        {bots && bots.length > 0 && (
          <div className="glass rounded-3xl p-4 mt-3 rise-in" style={{ animationDelay: ".2s" }}>
          <h3 className="font-display font-bold text-base mb-3 text-white/85">إجابات الكل في كل فئة</h3>
          <div className="space-y-2.5">
            {answers.map((a) => CATS.find((c) => c.key === a.cat)!).filter(Boolean).map((c, i) => (
                <div key={c.key} className="rise-in" style={{ animationDelay: `${0.24 + i * 0.04}s` }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                    <span className="text-xs font-extrabold text-white/65">{c.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pr-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-bold max-w-full ring-1 ring-amber-300/50 ${tierCls(playerVerdict(c.key))}`}>
                      <span className="text-white/45 font-extrabold">أنت:</span>
                      <span className="truncate max-w-36">
                        {playerVerdict(c.key) ? playerVerdict(c.key)!.display : "—"}
                      </span>
                    </span>
                    {bots.map((b) => {
                      const a = b.answers[c.key];
                      const v = a?.verdict && a.verdict.t !== "bad" ? a.verdict : null;
                      return (
                        <span key={b.id} className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-bold max-w-full ${tierCls(v)}`}>
                          <span className="text-white/45 font-extrabold">{b.name}:</span>
                          <span className="truncate max-w-36">{v ? v.display : "—"}</span>
                          {v && <span className="font-display text-white/40">{v.t === "exact" ? "١٠" : v.t === "fixed" ? "٨" : "٠"}</span>}
                        </span>
                      );
                    })}
                    {answers.find((a) => a.cat === c.key)?.unique && (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-violet-300/40 bg-violet-400/15 px-2 py-1 text-[11px] font-bold text-violet-200">
                        تميّز +٣
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* علّم القاموس كلماتك */}
        {addable.length > 0 && (
          <div className="rounded-3xl p-4 mt-3 border border-emerald-300/35 bg-gradient-to-l from-emerald-400/7 to-transparent rise-in" style={{ animationDelay: ".17s" }}>
            <div className="flex items-center gap-2 mb-1">
              <BookPlus className="w-5 h-5 text-emerald-300" />
              <h3 className="font-display text-lg font-bold text-emerald-100">علّم القاموس كلماتك</h3>
            </div>
            <p className="text-xs font-bold text-white/55 mb-3">
              الكلمات دي القاموس مايعرفهاش فأخدت ٢ نقطة — ضيفها وهتاخد <span className="text-emerald-300">صح +١٠</span> في الجولات الجاية
            </p>
            <div className="flex flex-wrap gap-1.5">
              {addable.map((a) => {
                const word = a.verdict!.t !== "bad" ? a.verdict!.display : a.text;
                const done = added[a.cat];
                return (
                  <button
                    key={a.cat}
                    onClick={() => promote(a.cat as CatKey, word)}
                    disabled={done}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                      done
                        ? "bg-emerald-400/20 border-emerald-300/50 text-emerald-200"
                        : "bg-white/7 border-white/15 text-white/80 hover:bg-emerald-400/15 hover:border-emerald-300/45"
                    }`}
                  >
                    {done ? <Check className="w-4 h-4" strokeWidth={2.75} /> : <Plus className="w-4 h-4 text-emerald-300" />}
                    <span className="text-white/45 font-extrabold">{a.label}:</span>
                    <span className="font-display">{word}</span>
                    {done && <span className="text-[10px] text-emerald-300">اتضافت</span>}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setDictOpen(true)}
              className="text-[11px] font-extrabold text-emerald-300/80 hover:text-emerald-200 mt-2.5 transition-colors"
            >
              افتح قاموسي وضيف كلمات تانية ←
            </button>
          </div>
        )}

        {/* تفاصيل الإجابات */}
        <div className="glass rounded-3xl p-4 mt-3 rise-in" style={{ animationDelay: ".15s" }}>
          <div className="space-y-1.5 max-h-64 overflow-y-auto pl-1">
            {answers.map((a, i) => {
              const info = verdictInfo(a);
              return (
                <div key={a.cat} className="flex items-center gap-2.5 rounded-xl bg-white/[.035] border border-white/[.06] px-3 py-2 rise-in" style={{ animationDelay: `${0.2 + i * 0.05}s` }}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.color }} />
                  <span className="text-xs font-extrabold text-white/60 w-12 shrink-0">{a.label}</span>
                  <div className="flex-1 min-w-0">
                    {a.verdict && a.verdict.t !== "bad" ? (
                      <>
                        <div className="font-display font-bold truncate">{a.verdict.display}</div>
                        {a.verdict.t === "fixed" && a.text && a.text !== a.verdict.display && (
                          <div className="text-[10px] font-bold text-white/40 line-through truncate">{a.text}</div>
                        )}
                      </>
                    ) : (
                      <div className="font-bold text-white/25 text-sm">—</div>
                    )}
                  </div>
                  <span className={`flex items-center gap-1 text-[11px] font-display font-bold px-2 py-1 rounded-lg shrink-0 ${info.cls}`}>
                    {info.icon} {info.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* الأزرار */}
        <div className="grid grid-cols-1 gap-2 mt-4 rise-in" style={{ animationDelay: ".3s" }}>
          {isDaily ? (
            <>
              <div className="glass rounded-2xl py-3 flex items-center justify-center gap-2 font-bold text-white/70 text-sm">
                <CalendarDays className="w-4.5 h-4.5 text-amber-300" />
                خلصت تحدي النهارده — استناني بكرة على حرف جديد!
              </div>
              <button onClick={onMenu} className="btn-primary py-3.5 text-xl flex items-center justify-center gap-2">
                <Home className="w-5.5 h-5.5" /> رجوع للقائمة
              </button>
            </>
          ) : (
            <>
              <button onClick={onNext} className="btn-primary py-3.5 text-xl flex items-center justify-center gap-2">
                <Bus className="w-5.5 h-5.5" /> جولة جديدة — حرف جديد
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={onRestart} className="btn-ghost py-3 flex items-center justify-center gap-2 font-bold">
                  <RotateCcw className="w-4.5 h-4.5" /> من جديد
                </button>
                <button onClick={onMenu} className="btn-ghost py-3 flex items-center justify-center gap-2 font-bold text-white/60">
                  <Home className="w-4.5 h-4.5" /> القائمة
                </button>
              </div>
            </>
          )}
          <button
            onClick={() => setShopOpen(true)}
            className="w-full py-3 mt-0 rounded-2xl flex items-center justify-center gap-2 font-bold text-amber-200 border border-amber-300/35 bg-gradient-to-l from-amber-400/8 to-orange-400/5 hover:from-amber-400/14 transition-all"
          >
            <ShoppingBag className="w-4.5 h-4.5 text-amber-300" />
            صرف الجنيه في الدكان — عندك {wallet.coins.toLocaleString("ar-EG")}
            <Coins className="w-4 h-4 text-amber-300" />
          </button>
        </div>
      </div>

      {shopOpen && <Shop onClose={() => setShopOpen(false)} />}
      {dictOpen && <Dictionary onClose={() => setDictOpen(false)} />}
    </div>
  );
}
