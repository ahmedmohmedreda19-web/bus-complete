import { useEffect, useState } from "react";
import { BookPlus, X, Trash2, Check, Search, Sparkles } from "lucide-react";
import { CATS, addCustomWord, removeCustomWord, getCustomWords, isKnownWord, CUSTOM_DICT_EVENT, type CatKey, type CustomWord } from "../data/lexicon";
import { sfx } from "../lib/sound";
import { checkAchievements } from "../lib/achievements";

/** هوك يتابع تغييرات القاموس الشخصي */
export function useCustomWords(): CustomWord[] {
  const [list, setList] = useState<CustomWord[]>(() => getCustomWords());
  useEffect(() => {
    const h = () => setList(getCustomWords());
    window.addEventListener(CUSTOM_DICT_EVENT, h);
    return () => window.removeEventListener(CUSTOM_DICT_EVENT, h);
  }, []);
  return list;
}

export default function Dictionary({ onClose, presetCat, presetWord }: {
  onClose: () => void;
  presetCat?: CatKey;
  presetWord?: string;
}) {
  const words = useCustomWords();
  const [cat, setCat] = useState<CatKey>(presetCat ?? CATS[0].key);
  const [text, setText] = useState(presetWord ?? "");
  const [msg, setMsg] = useState<{ t: "ok" | "err"; s: string } | null>(null);
  const [filter, setFilter] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = text.trim();
    if (!w) return;
    const res = addCustomWord(cat, w);
    if (res === "added") {
      sfx.correct();
      try { checkAchievements(); } catch { /* اتجاهل */ }
      setMsg({ t: "ok", s: `«${w}» اتضافت للقاموس — هتتحسب صح +١٠ من دلوقتي` });
      setText("");
    } else if (res === "exists") {
      sfx.bad();
      setMsg({ t: "err", s: "الكلمة دي موجودة في القاموس بالفعل" });
    } else if (res === "short") {
      sfx.bad();
      setMsg({ t: "err", s: "الكلمة قصيرة أو مكررة الحروف — اكتب كلمة حقيقية" });
    } else {
      sfx.bad();
      setMsg({ t: "err", s: "اكتب كلمة عربية صحيحة" });
    }
    setTimeout(() => setMsg(null), 2600);
  };

  const shown = words.filter((w) => !filter || w.word.includes(filter.trim()));
  const catLabel = (k: CatKey) => CATS.find((c) => c.key === k)!;
  const dupe = text.trim() && isKnownWord(cat, text.trim());

  return (
    <div className="fixed inset-0 z-[80] backdrop flex items-center justify-center p-3" onClick={onClose}>
      <div
        className="modal-solid rounded-3xl w-full max-w-lg max-h-[88dvh] flex flex-col pop-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* الترويسة */}
        <div className="flex items-center gap-3 p-4 border-b border-white/15 bg-black/20">
          <span className="w-11 h-11 rounded-2xl bg-emerald-400/20 border border-emerald-300/40 flex items-center justify-center shrink-0">
            <BookPlus className="w-5.5 h-5.5 text-emerald-300" />
          </span>
          <div className="flex-1">
            <h2 className="font-display text-2xl font-extrabold leading-6 text-emerald-100">قاموسي</h2>
            <p className="text-xs font-bold text-white/60">ضيف أي كلمة والقاموس هيحفظها ويحسبها صح</p>
          </div>
          <span className="rounded-xl bg-white/10 border border-white/15 px-3 py-1.5 font-display font-extrabold text-emerald-200">
            {words.length.toLocaleString("ar-EG")}
          </span>
          <button onClick={onClose} className="btn-ghost w-10 h-10 flex items-center justify-center shrink-0" aria-label="قفل">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* إضافة كلمة */}
        <form onSubmit={submit} className="p-3 border-b border-white/10">
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {CATS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCat(c.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-colors ${
                  cat === c.key ? "text-white" : "bg-white/7 border-white/12 text-white/60 hover:bg-white/12"
                }`}
                style={cat === c.key ? { background: `${c.color}2e`, borderColor: `${c.color}88`, color: c.color } : undefined}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`كلمة جديدة في «${catLabel(cat).label}»…`}
              maxLength={30}
              autoComplete="off"
              className="flex-1 min-w-0 bg-[#141b2e]/70 border border-white/15 rounded-2xl px-4 py-3 font-extrabold outline-none focus:border-emerald-400/70 transition-colors placeholder:text-white/30"
            />
            <button
              type="submit"
              disabled={!text.trim() || !!dupe}
              className="btn-primary px-5 rounded-2xl flex items-center gap-1.5 font-bold disabled:opacity-50"
            >
              <Check className="w-4.5 h-4.5" strokeWidth={2.75} />
              ضيف
            </button>
          </div>
          {dupe && (
            <p className="text-[11px] font-bold text-amber-300/90 mt-1.5">الكلمة دي معروفة أصلًا في «{catLabel(cat).label}» ✔</p>
          )}
          {msg && (
            <p className={`text-xs font-bold mt-2 rounded-xl px-3 py-2 ${msg.t === "ok" ? "bg-emerald-400/15 border border-emerald-300/35 text-emerald-200" : "bg-rose-400/12 border border-rose-300/30 text-rose-200"}`}>
              {msg.s}
            </p>
          )}
        </form>

        {/* البحث والقائمة */}
        <div className="p-3 overflow-y-auto flex-1">
          {words.length > 3 && (
            <div className="relative mb-2.5">
              <Search className="w-4 h-4 text-white/35 absolute top-1/2 -translate-y-1/2 right-3" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="دوّر في كلماتك…"
                className="w-full bg-white/7 border border-white/12 rounded-xl pr-9 pl-3 py-2 text-sm font-bold outline-none focus:border-white/25 placeholder:text-white/30"
              />
            </div>
          )}

          {words.length === 0 ? (
            <div className="text-center py-10">
              <Sparkles className="w-10 h-10 text-white/15 mx-auto mb-3" />
              <p className="text-white/50 font-bold text-sm leading-6">
                قاموسك لسه فاضي
                <br />
                <span className="text-white/35 text-xs">ضيف الكلمات اللي اللعبة مش عارفاها وهتتحسب صح +١٠ في كل الجولات الجاية</span>
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {shown.map((w) => {
                const c = catLabel(w.cat);
                return (
                  <div key={`${w.cat}-${w.word}-${w.at}`} className="flex items-center gap-2.5 rounded-xl bg-white/7 border border-white/12 px-3 py-2.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                    <span className="text-[11px] font-extrabold text-white/50 w-12 shrink-0">{c.label}</span>
                    <span className="flex-1 font-display font-bold truncate">{w.word}</span>
                    <button
                      onClick={() => { removeCustomWord(w.cat, w.word); sfx.tick(); }}
                      className="w-8 h-8 rounded-lg bg-white/8 text-white/45 hover:bg-rose-400/25 hover:text-rose-300 flex items-center justify-center transition-colors shrink-0"
                      aria-label="امسح"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
              {shown.length === 0 && (
                <p className="text-center text-white/40 font-bold text-sm py-6">مفيش كلمة بالاسم ده</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
