import { useState } from "react";
import { Hash, PenLine, OctagonX, Sparkles, ChevronLeft, PartyPopper } from "lucide-react";
import { sfx } from "../lib/sound";

const KEY = "busComplete.tutorialDone";

export function tutorialDone(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return true; }
}

function markDone() {
  try { localStorage.setItem(KEY, "1"); } catch { /* اتجاهل */ }
}

const STEPS = [
  {
    icon: Hash,
    color: "text-amber-300 bg-amber-400/15",
    title: "قرعة الحرف",
    body: "كل جولة بتسحب حرف واحد — كل إجاباتك لازم تبدأ بيه.",
  },
  {
    icon: PenLine,
    color: "text-sky-300 bg-sky-400/15",
    title: "اكتب وسيب الباقي علينا",
    body: "اكتب في الخانات، وإجاباتك بتتقفل لوحدها أول ما توقف كتابة — مفيش Enter خالص. القاموس بيصحّح غلط الإملاء لوحده.",
  },
  {
    icon: OctagonX,
    color: "text-rose-300 bg-rose-400/15",
    title: "وقّف الأتوبيس!",
    body: "لما تخلص التسع فئات (أو بتنتهي وقتها) اضغط «وقّف الأتوبيس» — خلص بدري = بونص سرعة.",
  },
];

export default function Tutorial({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;

  const advance = () => {
    sfx.tick();
    if (last) {
      markDone();
      sfx.land();
      onDone();
    } else setStep((s) => s + 1);
  };

  const finish = () => {
    markDone();
    sfx.land();
    onDone();
  };

  const cur = STEPS[step];
  const Icon = cur.icon;

  return (
    <div className="fixed inset-0 z-[85] backdrop flex items-center justify-center p-4" dir="rtl" onClick={finish}>
      <div className="modal-solid rounded-3xl p-6 w-full max-w-sm text-center pop-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center gap-1.5 mb-4">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-amber-400" : "w-2.5 bg-white/15"}`} />
          ))}
        </div>
        <div className={`mx-auto w-16 h-16 rounded-3xl border border-white/15 flex items-center justify-center mb-4 ${cur.color.split(" ")[1]}`}>
          <Icon className={`w-8 h-8 ${cur.color.split(" ")[0]}`} />
        </div>
        <h2 className="font-display text-2xl font-extrabold mb-2">{cur.title}</h2>
        <p className="text-white/65 font-bold text-sm leading-6 mb-6">{cur.body}</p>
        <button onClick={advance} className="btn-primary w-full py-3.5 text-lg flex items-center justify-center gap-2">
          {last ? <PartyPopper className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {last ? "يلا نلعب!" : "التالي"}
        </button>
        <button onClick={finish} className="mt-2 text-xs font-bold text-white/35 hover:text-white/60 transition-colors">
          تخطي الشرح
        </button>
        <div className="flex items-center justify-center gap-1 mt-4 text-[10px] font-bold text-white/30">
          <Sparkles className="w-3 h-3" /> بتظهر مرة واحدة بس — تلاقيها تاني من القائمة لما تحتاج
        </div>
      </div>
    </div>
  );
}
