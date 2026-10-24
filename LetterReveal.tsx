import { useEffect, useRef, useState } from "react";
import { FastForward } from "lucide-react";
import { ELIGIBLE_LETTERS } from "../data/lexicon";
import { sfx } from "../lib/sound";
import { fx, PALETTES } from "../lib/fx";

/** قرعة الحرف: حروف بتتقلب بسرعة ثم تقف على حرف الجولة */
export default function LetterReveal({ letter, onDone }: { letter: string; onDone: () => void }) {
  const [shown, setShown] = useState(ELIGIBLE_LETTERS[0]);
  const [landed, setLanded] = useState(false);
  const discRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    sfx.ensure();
    let t: ReturnType<typeof setTimeout>;
    let i = 0;
    // تسلسل سرعات: سريع ثم تباطؤ
    const delays = [45, 45, 45, 45, 50, 50, 55, 60, 65, 70, 80, 90, 100, 115, 130, 150, 175, 210, 260, 330, 420];
    const spin = () => {
      if (doneRef.current) return;
      if (i < delays.length) {
        const next = ELIGIBLE_LETTERS[Math.floor(Math.random() * ELIGIBLE_LETTERS.length)];
        setShown(next);
        sfx.flip();
        t = setTimeout(spin, delays[i++]);
      } else {
        setShown(letter);
        setLanded(true);
        sfx.land();
        fx.burstAtEl(discRef.current, PALETTES.win, 70, 9);
        t = setTimeout(() => { if (!doneRef.current) { doneRef.current = true; onDone(); } }, 1150);
      }
    };
    spin();
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter]);

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-4"
      onClick={() => { if (!landed) return; if (!doneRef.current) { doneRef.current = true; onDone(); } }}
    >
      <p className="font-display text-2xl text-white/75 font-bold mb-2 rise-in">السوّاق بيدوّر عجلة الحروف…</p>
      <p className="text-white/40 font-bold text-sm mb-8">الحرف اللي هتلعب بيه الجولة دي على وصول</p>

      <div
        ref={discRef}
        className={`relative w-44 h-44 sm:w-52 sm:h-52 rounded-full letter-disc flex items-center justify-center ${landed ? "pulse-glow" : ""}`}
      >
        <div className="absolute inset-2.5 rounded-full border-[3px] border-dashed border-white/40" />
        <span
          key={shown + (landed ? "-L" : "")}
          className={`font-display font-extrabold text-[#33240f] leading-none select-none ${landed ? "stamp-in text-[6.5rem] sm:text-[7.5rem]" : "wheel-flip text-8xl sm:text-9xl"}`}
        >
          {shown}
        </span>
      </div>

      <div className="h-14 mt-8 flex items-center">
        {landed ? (
          <p className="stamp-in font-display text-2xl font-bold text-amber-300">
            حرف «{letter}» — اركبوا يلا!
          </p>
        ) : (
          <button
            onClick={() => { if (!doneRef.current) { doneRef.current = true; sfx.land(); setLanded(false); onDone(); } }}
            className="btn-ghost px-5 py-2 text-sm font-bold text-white/60 flex items-center gap-2"
          >
            <FastForward className="w-4 h-4" />
            تخطي
          </button>
        )}
      </div>
    </div>
  );
}
