import { useMemo, useRef, useState } from "react";
import { X, Gift, Clock, Sparkles, Coins } from "lucide-react";
import { PRIZES, spinWheel, useWheel, type SpinResult } from "../lib/wheel";
import { formatCountdown } from "../lib/daily";
import { useWallet } from "../lib/wallet";
import { sfx } from "../lib/sound";
import { fx, PALETTES } from "../lib/fx";

const R = 110;            // نصف قطر العجلة
const SEG = 360 / PRIZES.length;
const SPIN_MS = 4200;

/** رسم قطاع دائري */
function segPath(i: number): string {
  const a0 = ((i * SEG - 90) * Math.PI) / 180;
  const a1 = (((i + 1) * SEG - 90) * Math.PI) / 180;
  const x0 = R + R * Math.cos(a0), y0 = R + R * Math.sin(a0);
  const x1 = R + R * Math.cos(a1), y1 = R + R * Math.sin(a1);
  return `M ${R} ${R} L ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1} Z`;
}

export default function LuckyWheel({ onClose }: { onClose: () => void }) {
  const { available, remaining, state } = useWheel();
  const wallet = useWallet();
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const spinDiscRef = useRef<HTMLDivElement>(null);

  // خانات العجلة ثابتة — تُرسم مرة واحدة فقط
  const segments = useMemo(
    () =>
      PRIZES.map((p, i) => {
        const mid = ((i * SEG + SEG / 2 - 90) * Math.PI) / 180;
        return {
          id: p.id,
          color: p.color,
          icon: p.icon,
          label: p.label,
          d: segPath(i),
          tx: R + R * 0.64 * Math.cos(mid),
          ty: R + R * 0.64 * Math.sin(mid),
        };
      }),
    []
  );

  const doSpin = () => {
    if (spinning || !available) return;
    const res = spinWheel();
    if (!res) return;
    setSpinning(true);
    setResult(null);
    try { sfx.flip(); } catch { /* اتجاهل */ }

    // زاوية الخانة الفائزة + ٥ لفات كاملة
    const target = 360 * 5 + (360 - (res.index * SEG + SEG / 2));
    const finalAngle = angle + target;
    setAngle(finalAngle);

    // مباشرة عبر Web Animations API (بدون إعادة تصيير React أثناء الدوران)
    const el = spinDiscRef.current;
    let useRaf = true;
    if (el && el.animate) {
      useRaf = false;
      el.getAnimations().forEach((a) => a.cancel());
      // setAngle حافظ للزاوية النهائية فقط؛ الدوران نفسه على مؤشر Web Animations
      el.style.transform = `rotate(${angle}deg)`;
      const anim = el.animate(
        [{ transform: `rotate(${angle}deg)` }, { transform: `rotate(${finalAngle}deg)` }],
        { duration: SPIN_MS, easing: "cubic-bezier(.17,.67,.16,1)", fill: "forwards" }
      );
      anim.addEventListener("finish", () => {
        el.style.transform = `rotate(${finalAngle}deg)`;
      });
      const clickMarkers = [200, 400, 600, 800, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3250, 3500];
      clickMarkers.forEach((t) => {
        setTimeout(() => { try { sfx.tick(); } catch { /* اتجاهل */ } }, t);
      });
    }

    // مسار احتياطي عبر rAF للمتصفحات القديمة
    let stopRaf = false;
    if (useRaf && el) {
      const start = performance.now();
      const from = angle;
      const tickAnim = (t: number) => {
        if (stopRaf) return;
        const p = Math.min(1, (t - start) / SPIN_MS);
        const eased = 1 - Math.pow(1 - p, 3);
        el.style.transform = `rotate(${from + target * eased}deg)`;
        if (p < 1) requestAnimationFrame(tickAnim);
      };
      requestAnimationFrame(tickAnim);
    }

    setTimeout(() => {
      stopRaf = true;
      setSpinning(false);
      setResult(res);
      try {
        if (res.prize.kind === "jackpot" || res.prize.kind === "skin") {
          sfx.fanfare();
          fx.rain(PALETTES.win, 150);
        } else {
          sfx.correct();
          fx.burstAtEl(wheelRef.current, PALETTES.win, 45, 8);
        }
      } catch { /* اتجاهل */ }
    }, SPIN_MS);
  };

  return (
    <div className="fixed inset-0 z-[89] backdrop flex items-center justify-center p-3" dir="rtl" onClick={spinning ? undefined : onClose}>
      <div className="modal-solid rounded-3xl w-full max-w-sm pop-in overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* الترويسة */}
        <div className="flex items-center gap-3 p-4 border-b border-white/15 bg-black/20">
          <span className="w-11 h-11 rounded-2xl bg-violet-400/20 border border-violet-300/40 flex items-center justify-center shrink-0">
            <Gift className="w-5.5 h-5.5 text-violet-300" />
          </span>
          <div className="flex-1">
            <h2 className="font-display text-2xl font-extrabold leading-6 text-violet-100">عجلة الحظ</h2>
            <p className="text-xs font-bold text-white/60">لفة مجانية كل يوم</p>
          </div>
          {!spinning && (
            <button onClick={onClose} className="btn-ghost w-10 h-10 flex items-center justify-center shrink-0" aria-label="قفل">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-5">
          {/* العجلة */}
          <div ref={wheelRef} className="relative mx-auto" style={{ width: R * 2 + 16, height: R * 2 + 16 }}>
            {/* المؤشر */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10">
              <div
                className="w-0 h-0"
                style={{
                  borderLeft: "11px solid transparent",
                  borderRight: "11px solid transparent",
                  borderTop: "20px solid #e8b563",
                  filter: "drop-shadow(0 2px 6px rgba(0,0,0,.6))",
                }}
              />
            </div>

            <div
              ref={spinDiscRef}
              className="absolute inset-2 rounded-full"
              style={{
                transform: `rotate(${angle}deg)`,
                willChange: spinning ? "transform" : undefined,
                filter: "drop-shadow(0 10px 30px rgba(0,0,0,.5))",
              }}
            >
              <svg viewBox={`0 0 ${R * 2} ${R * 2}`} className="w-full h-full">
                {segments.map((s) => (
                  <g key={s.id}>
                    <path d={s.d} fill={s.color} stroke="#1c2438" strokeWidth="2" opacity={0.92} />
                    <text x={s.tx} y={s.ty - 6} textAnchor="middle" style={{ fontSize: 20 }}>
                      {s.icon}
                    </text>
                    <text
                      x={s.tx} y={s.ty + 12}
                      textAnchor="middle"
                      style={{
                        fontFamily: "Changa, sans-serif",
                        fontSize: 10,
                        fontWeight: 800,
                        fill: "#242c44",
                      }}
                    >
                      {s.label}
                    </text>
                  </g>
                ))}
                <circle cx={R} cy={R} r={R} fill="none" stroke="rgba(255,194,75,.55)" strokeWidth="4" />
                <circle cx={R} cy={R} r="20" fill="#1c2438" stroke="#e8b563" strokeWidth="3" />
              </svg>
            </div>
          </div>

          {/* النتيجة */}
          {result && (
            <div className="mt-4 rounded-2xl border border-amber-300/50 bg-gradient-to-l from-amber-400/14 to-transparent px-4 py-3 text-center stamp-in">
              <div className="text-3xl">{result.prize.icon}</div>
              <div className="font-display text-xl font-extrabold text-amber-100 mt-0.5">
                {result.skinName
                  ? `سكن «${result.skinName}»!`
                  : `+${(result.amount ?? 0).toLocaleString("ar-EG")} ${result.prize.kind === "hint" ? "تلميح" : result.prize.kind === "time" ? "وقود وقت" : "جنيه"}`}
              </div>
              <div className="text-[11px] font-bold text-white/55 mt-0.5">
                {result.prize.kind === "jackpot" ? "🎉 مبروك الجاكبوت!" : "اتضافت لحسابك"}
              </div>
            </div>
          )}

          {/* الزرار */}
          {available || spinning ? (
            <button
              onClick={doSpin}
              disabled={spinning}
              className="btn-primary w-full py-4 text-xl mt-4 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Sparkles className="w-5.5 h-5.5" />
              {spinning ? "بتلف…" : "لِف العجلة!"}
            </button>
          ) : (
            <div className="mt-4 space-y-2">
              <div className="glass rounded-2xl py-3 flex items-center justify-center gap-2 font-bold text-white/70">
                <Clock className="w-4.5 h-4.5 text-amber-300" />
                اللفة الجاية بعد
                <span className="font-display text-amber-200 tabular-nums" dir="ltr">
                  {formatCountdown(remaining)}
                </span>
              </div>
              <button onClick={onClose} className="btn-ghost w-full py-3 font-bold text-white/60">
                تمام
              </button>
            </div>
          )}

          <div className="flex items-center justify-center gap-3 mt-3 text-[11px] font-bold text-white/40">
            <span className="inline-flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-amber-300" /> {wallet.coins.toLocaleString("ar-EG")}
            </span>
            <span>·</span>
            <span>لفّيت {state.spins.toLocaleString("ar-EG")} مرة</span>
          </div>
        </div>
      </div>
    </div>
  );
}
