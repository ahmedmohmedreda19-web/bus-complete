import { X, Trophy, Lock, Check, Coins, BadgeCheck } from "lucide-react";
import { useAchievements } from "../lib/achievements";
import { TITLES } from "../data/shop";

const TIER_STYLE: Record<string, string> = {
  bronze: "from-orange-400/11 to-transparent border-orange-300/40",
  silver: "from-slate-300/20 to-transparent border-slate-200/40",
  gold: "from-amber-400/14 to-transparent border-amber-300/50",
};

const TIER_LABEL: Record<string, string> = { bronze: "برونزي", silver: "فضي", gold: "ذهبي" };

export default function Achievements({ onClose }: { onClose: () => void }) {
  const { list, unlocked, total } = useAchievements();
  const done = list.filter((a) => a.done);
  const pending = list.filter((a) => !a.done);
  const pct = Math.round((unlocked.length / total) * 100);

  return (
    <div className="fixed inset-0 z-[87] backdrop flex items-center justify-center p-3" dir="rtl" onClick={onClose}>
      <div className="modal-solid rounded-3xl w-full max-w-lg max-h-[88dvh] flex flex-col pop-in overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* الترويسة */}
        <div className="p-4 border-b border-white/15 bg-black/20">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center">
              <Trophy className="w-5.5 h-5.5 text-amber-300" />
            </span>
            <div className="flex-1">
              <h2 className="font-display text-2xl font-extrabold leading-6 text-amber-100">إنجازاتك</h2>
              <p className="text-xs font-bold text-white/60">
                فتحت {unlocked.length.toLocaleString("ar-EG")} من {total.toLocaleString("ar-EG")}
              </p>
            </div>
            <span className="font-display text-3xl font-extrabold text-amber-300">{pct.toLocaleString("ar-EG")}%</span>
            <button onClick={onClose} className="btn-ghost w-10 h-10 flex items-center justify-center shrink-0" aria-label="قفل">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden mt-3">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: "linear-gradient(90deg,#e8b563,#6bc9a0)" }}
            />
          </div>
        </div>

        <div className="p-3 overflow-y-auto flex-1 space-y-2">
          {[...done, ...pending].map((a) => {
            const p = a.progress();
            const ratio = Math.min(100, Math.round((p.now / p.goal) * 100));
            const titleLabel = a.title ? TITLES.find((t) => t.id === a.title)?.label : null;
            return (
              <div
                key={a.id}
                className={`rounded-2xl border p-3 flex items-center gap-3 transition-all ${
                  a.done ? `bg-gradient-to-l ${TIER_STYLE[a.tier]}` : "bg-white/[.04] border-white/10"
                }`}
              >
                <span
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${
                    a.done ? "bg-white/12" : "bg-white/5 grayscale opacity-45"
                  }`}
                >
                  {a.done ? a.icon : <Lock className="w-5 h-5 text-white/35" />}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-display font-bold truncate ${a.done ? "" : "text-white/55"}`}>{a.name}</span>
                    {a.done && <Check className="w-4 h-4 text-emerald-300 shrink-0" strokeWidth={3} />}
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded shrink-0 ${
                      a.tier === "gold" ? "bg-amber-400/20 text-amber-200" : a.tier === "silver" ? "bg-slate-300/15 text-slate-200" : "bg-orange-400/15 text-orange-200"
                    }`}>
                      {TIER_LABEL[a.tier]}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-white/50 truncate">{a.desc}</p>

                  {!a.done && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-amber-400/70" style={{ width: `${ratio}%` }} />
                      </div>
                      <span className="text-[10px] font-display font-bold text-white/45 shrink-0">
                        {p.now.toLocaleString("ar-EG")}/{p.goal.toLocaleString("ar-EG")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-left shrink-0">
                  <div className="flex items-center gap-1 justify-end">
                    <Coins className="w-3.5 h-3.5 text-amber-300" />
                    <span className="font-display font-extrabold text-amber-300 text-sm">{a.coins.toLocaleString("ar-EG")}</span>
                  </div>
                  {titleLabel && (
                    <div className="flex items-center gap-0.5 text-[9px] font-extrabold text-violet-300 mt-0.5">
                      <BadgeCheck className="w-3 h-3" /> {titleLabel}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
