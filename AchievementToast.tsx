import { useEffect } from "react";
import { Coins, BadgeCheck } from "lucide-react";
import type { Achievement } from "../lib/achievements";
import { TITLES } from "../data/shop";
import { sfx } from "../lib/sound";
import { fx, PALETTES } from "../lib/fx";

/** إشعار فتح إنجاز — بيظهر فوق أي شاشة */
export default function AchievementToast({ items, onDone }: { items: Achievement[]; onDone: () => void }) {
  useEffect(() => {
    if (items.length === 0) return;
    try {
      sfx.fanfare();
      fx.rain(PALETTES.win, 90);
    } catch { /* اتجاهل */ }
    const t = setTimeout(onDone, 3200 + items.length * 700);
    return () => clearTimeout(t);
  }, [items, onDone]);

  if (items.length === 0) return null;

  return (
    <div className="fixed inset-x-0 top-4 z-[95] flex flex-col items-center gap-2 px-4 pointer-events-none" dir="rtl">
      {items.map((a, i) => {
        const titleLabel = a.title ? TITLES.find((t) => t.id === a.title)?.label : null;
        return (
          <div
            key={a.id}
            className="stamp-in w-full max-w-sm rounded-3xl border border-amber-300/60 bg-gradient-to-l from-amber-400/16 via-[#232c45] to-[#1c2438] px-4 py-3 flex items-center gap-3 shadow-[0_14px_34px_-20px_rgba(232,181,99,.35)]"
            style={{ animationDelay: `${i * 0.18}s` }}
          >
            <span className="w-14 h-14 rounded-2xl bg-white/12 border border-white/20 flex items-center justify-center text-3xl shrink-0">
              {a.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-extrabold text-amber-300/90">🎉 إنجاز جديد اتفتح!</div>
              <div className="font-display text-lg font-extrabold text-amber-100 truncate">{a.name}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-200">
                  <Coins className="w-3.5 h-3.5" /> +{a.coins.toLocaleString("ar-EG")}
                </span>
                {titleLabel && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-violet-200 bg-violet-400/20 rounded-full px-2 py-0.5">
                    <BadgeCheck className="w-3 h-3" /> لقب: {titleLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
