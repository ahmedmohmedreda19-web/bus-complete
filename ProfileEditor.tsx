import { useRef, useState } from "react";
import { X, Camera, Trash2, Check, UserRound, ShieldCheck } from "lucide-react";
import Avatar from "./Avatar";
import BusLogo from "./BusLogo";
import { useProfile, saveProfile, compressImage } from "../lib/profile";
import { getTitleLabel, readWallet } from "../lib/wallet";
import { sfx } from "../lib/sound";

export default function ProfileEditor({ onClose }: { onClose: () => void }) {
  const p = useProfile();
  const [name, setName] = useState(p.name);
  const [avatar, setAvatar] = useState(p.avatar);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const title = getTitleLabel();

  const pick = async (f?: File | null) => {
    if (!f) return;
    setErr("");
    setBusy(true);
    try {
      const data = await compressImage(f);
      setAvatar(data);
      sfx.correct();
    } catch {
      setErr("مقدرناش نقرأ الصورة — جرب صورة تانية");
      sfx.bad();
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    saveProfile({ name: name.trim() || "النجم", avatar });
    sfx.land();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[86] backdrop flex items-center justify-center p-3" dir="rtl" onClick={onClose}>
      <div className="modal-solid rounded-3xl w-full max-w-sm pop-in overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 border-b border-white/15 bg-black/20">
          <span className="w-11 h-11 rounded-2xl bg-sky-400/20 border border-sky-300/40 flex items-center justify-center">
            <UserRound className="w-5.5 h-5.5 text-sky-300" />
          </span>
          <div className="flex-1">
            <h2 className="font-display text-2xl font-extrabold leading-6 text-sky-100">بروفايلك</h2>
            <p className="text-xs font-bold text-white/60">اسمك وصورتك هيشوفهم كل اللاعيبة</p>
          </div>
          <button onClick={onClose} className="btn-ghost w-10 h-10 flex items-center justify-center" aria-label="قفل">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {/* الصورة */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => fileRef.current?.click()}
              className="relative group"
              aria-label="غيّر الصورة"
            >
              <Avatar src={avatar} name={name} size={108} ring />
              <span className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-7 h-7 text-white" />
              </span>
              <span className="absolute -bottom-1 -left-1 w-9 h-9 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center border-2 border-[#1c2438]">
                <Camera className="w-4.5 h-4.5" />
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { pick(e.target.files?.[0]); e.currentTarget.value = ""; }}
            />
            <div className="flex gap-2 mt-3">
              <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn-ghost px-4 py-2 text-xs font-bold flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-sky-300" /> {busy ? "بنجهّزها…" : avatar ? "غيّر الصورة" : "ارفع صورة"}
              </button>
              {avatar && (
                <button onClick={() => { setAvatar(""); sfx.tick(); }} className="btn-ghost px-3 py-2 text-xs font-bold text-rose-200 flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4" /> شيلها
                </button>
              )}
            </div>
            {err && <p className="text-[11px] font-bold text-rose-300 mt-2">{err}</p>}
          </div>

          {/* الاسم */}
          <label className="block text-xs font-extrabold text-white/60 mt-5 mb-2">اسمك</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={16}
            placeholder="اكتب اسمك…"
            className="w-full bg-[#141b2e]/70 border border-white/15 rounded-2xl px-4 py-3 text-lg font-extrabold outline-none focus:border-sky-400/70 transition-colors placeholder:text-white/25 text-center"
          />

          {title && (
            <div className="flex items-center justify-center gap-1.5 mt-3 text-xs font-extrabold text-amber-300">
              <ShieldCheck className="w-4 h-4" /> لقبك الحالي: {title}
            </div>
          )}

          {/* معاينة سينمائية: أنت راكب الأتوبيس */}
          <div className="mt-4 rounded-2xl bg-[#141b2e]/60 border border-white/12 p-2 pt-3 overflow-hidden">
            <div className="scale-95 origin-center">
              <BusLogo skinId={readWallet().skin} avatar={avatar} name={name} />
            </div>
            <p className="text-center text-[10px] font-extrabold text-amber-200/70 -mt-1">
              {avatar ? "أهلاً بيك في الأتوبيس 🚌" : "حط صورتك وهتلاقي نفسك راكب"}
            </p>
          </div>

          <p className="text-[10px] font-bold text-white/35 text-center mt-4 leading-5">
            الصورة والاسم محفوظين على جهازك — هتلاقيهم زي ما هما لما تفتح اللعبة تاني
          </p>

          <button onClick={save} className="btn-primary w-full py-3.5 text-lg mt-4 flex items-center justify-center gap-2">
            <Check className="w-5 h-5" strokeWidth={2.75} /> احفظ
          </button>
        </div>
      </div>
    </div>
  );
}
