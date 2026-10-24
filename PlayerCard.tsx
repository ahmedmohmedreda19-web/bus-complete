import { X, Trophy, Gamepad2, Target, BookOpen, BadgeCheck, Crown } from "lucide-react";
import Avatar from "./Avatar";
import type { PlayerStats } from "../net/online";

export interface CardPlayer {
  id: string;
  name: string;
  avatar?: string;
  title?: string;
  stats?: PlayerStats;
  isHost?: boolean;
  isMe?: boolean;
}

/** كارت اللاعب العام — بيظهر لما تضغط على صورة أي حد */
export default function PlayerCard({ player, onClose }: { player: CardPlayer; onClose: () => void }) {
  const s = player.stats;
  const winRate = s && s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0;

  const items = [
    { icon: Gamepad2, label: "جولات", value: s?.games ?? 0, color: "text-sky-300 bg-sky-400/12 border-sky-300/30" },
    { icon: Trophy, label: "أعلى نتيجة", value: s?.best ?? 0, color: "text-amber-300 bg-amber-400/12 border-amber-300/30" },
    { icon: Crown, label: "مرات الفوز", value: s?.wins ?? 0, color: "text-violet-300 bg-violet-400/12 border-violet-300/30" },
    { icon: BookOpen, label: "كلمات صح", value: s?.words ?? 0, color: "text-emerald-300 bg-emerald-400/12 border-emerald-300/30" },
  ];

  return (
    <div className="fixed inset-0 z-[88] backdrop flex items-center justify-center p-4" dir="rtl" onClick={onClose}>
      <div className="modal-solid rounded-3xl w-full max-w-xs pop-in overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* ترويسة بصورة كبيرة */}
        <div className="relative bg-gradient-to-b from-amber-400/10 to-transparent p-5 pb-4 text-center">
          <button onClick={onClose} className="absolute top-3 left-3 btn-ghost w-9 h-9 flex items-center justify-center" aria-label="قفل">
            <X className="w-4.5 h-4.5" />
          </button>
          <Avatar src={player.avatar} name={player.name} size={86} ring className="mx-auto" />
          <h3 className="font-display text-2xl font-extrabold mt-2.5 truncate px-4">
            {player.name}
            {player.isMe && <span className="text-xs font-bold text-white/45 mr-1.5">(أنت)</span>}
          </h3>
          <div className="flex items-center justify-center gap-1.5 mt-1 flex-wrap">
            {player.isHost && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 border border-amber-300/40 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-200">
                <Crown className="w-3 h-3" /> المضيف
              </span>
            )}
            {player.title && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/8 border border-white/15 px-2.5 py-0.5 text-[10px] font-extrabold text-white/70">
                <BadgeCheck className="w-3 h-3 text-amber-300" /> {player.title}
              </span>
            )}
          </div>
        </div>

        {/* الإحصائيات */}
        <div className="p-4 pt-1">
          {s ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {items.map((it) => {
                  const Icon = it.icon;
                  return (
                    <div key={it.label} className={`rounded-2xl border p-3 text-center ${it.color}`}>
                      <Icon className="w-4.5 h-4.5 mx-auto mb-1" />
                      <div className="font-display text-2xl font-extrabold leading-none">
                        {it.value.toLocaleString("ar-EG")}
                      </div>
                      <div className="text-[10px] font-extrabold text-white/50 mt-1">{it.label}</div>
                    </div>
                  );
                })}
              </div>

              {/* نسبة الفوز */}
              {s.games > 0 && (
                <div className="mt-3 rounded-2xl bg-white/6 border border-white/12 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-white/60">
                      <Target className="w-3.5 h-3.5 text-rose-300" /> نسبة الفوز
                    </span>
                    <span className="font-display font-extrabold text-rose-200">
                      {winRate.toLocaleString("ar-EG")}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${winRate}%`, background: "linear-gradient(90deg,#dd8f8f,#e8b563)" }}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-white/45 font-bold text-sm py-6 leading-6">
              اللاعب ده لسه ما شاركش إحصائياته
              <br />
              <span className="text-[11px] text-white/30">هتظهر أول ما يلعب جولة</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
