import { useState } from "react";
import {
  Play, Trophy, Medal, BookOpenCheck, Bus, Globe, ChevronLeft, Coins,
  ShoppingBag, CalendarDays, Clock, Camera, Target, Zap, Link2, Gift,
  Shuffle, X, Users, Gem,
} from "lucide-react";
import BusLogo from "./BusLogo";
import Shop from "./Shop";
import Dictionary from "./Dictionary";
import ProfileEditor from "./ProfileEditor";
import Achievements from "./Achievements";
import LuckyWheel from "./LuckyWheel";
import AccountFriends from "./AccountFriends";
import Avatar from "./Avatar";
import { useWheel } from "../lib/wheel";
import { useAchievements } from "../lib/achievements";
import { useProfile, readProfile, saveProfile } from "../lib/profile";
import { useBoard, MODE_LABEL } from "../lib/globalBoard";
import { useWallet } from "../lib/wallet";
import { useDaily, formatCountdown } from "../lib/daily";
import { useAccount, isLoggedIn } from "../lib/account";
import { consumeInviteFromUrl, sendFriendRequestByCode } from "../lib/friends";
import { TITLES } from "../data/shop";
import { useEffect } from "react";

export default function Menu({
  initialName, onStart, onOnline, onDaily, onTen, onBlitz, onChain, onScramble,
}: {
  initialName: string;
  onStart: (name: string) => void;
  onOnline: () => void;
  onDaily: () => void;
  onTen: () => void;
  onBlitz: () => void;
  onChain: () => void;
  onScramble: () => void;
}) {
  const [name, setName] = useState(() => initialName || readProfile().name);
  const [shopOpen, setShopOpen] = useState(false);
  const [dictOpen, setDictOpen] = useState(false);
  const [profOpen, setProfOpen] = useState(false);
  const [achOpen, setAchOpen] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const wheel = useWheel();
  const ach = useAchievements();
  const profile = useProfile();
  const wallet = useWallet();
  const daily = useDaily();
  const board = useBoard();
  const account = useAccount();
  const title = TITLES.find((item) => item.id === wallet.title)?.label ?? "";

  useEffect(() => {
    const invite = consumeInviteFromUrl();
    if (invite.friendCode) {
      sendFriendRequestByCode(invite.friendCode);
      setFriendsOpen(true);
    }
  }, []);

  const start = () => {
    const nextName = name.trim() || "النجم";
    saveProfile({ name: nextName });
    onStart(nextName);
  };

  const modes = [
    { name: "الحروف المتلغبطة", meta: "٦٠ ثانية", icon: Shuffle, action: onScramble, tone: "text-fuchsia-200 bg-fuchsia-400/10 border-fuchsia-300/20" },
    { name: "وصلة الحروف", meta: "روح واحدة", icon: Link2, action: onChain, tone: "text-cyan-200 bg-cyan-400/10 border-cyan-300/20" },
    { name: "الخمس ثواني", meta: "سريع", icon: Zap, action: onBlitz, tone: "text-rose-200 bg-rose-400/10 border-rose-300/20" },
    { name: "العشر كلمات", meta: "٦٠ ثانية", icon: Target, action: onTen, tone: "text-violet-200 bg-violet-400/10 border-violet-300/20" },
  ];

  return (
    <div className="min-h-dvh w-full max-w-3xl mx-auto px-4 py-4 sm:py-6">
      {/* أدوات الحساب في شريط واحد صغير */}
      <header className="flex items-center gap-1.5 w-full rise-in">
        <button onClick={() => setShopOpen(true)} className="glass rounded-xl h-9 px-2.5 flex items-center gap-1.5" aria-label="الرصيد والمحل">
          <Coins className="w-4 h-4 text-amber-300" />
          <span className="flex flex-col items-start leading-none">
            <span className="font-display font-bold text-amber-200 tabular-nums">{wallet.coins.toLocaleString("ar-EG")}</span>
            <span className="text-[8px] font-bold text-amber-300/60 mt-0.5">جنيه</span>
          </span>
        </button>
        <button onClick={() => setShopOpen(true)} className="glass rounded-xl h-9 px-2.5 flex items-center gap-1.5" aria-label="جواهرك">
          <Gem className="w-4 h-4 text-sky-300" />
          <span className="flex flex-col items-start leading-none">
            <span className="font-display font-bold text-sky-200 tabular-nums">{wallet.gems.toLocaleString("ar-EG")}</span>
            <span className="text-[8px] font-bold text-sky-300/60 mt-0.5">جوهرة</span>
          </span>
        </button>

        <div className="flex-1" />

        <button onClick={() => setDictOpen(true)} className="glass rounded-xl w-9 h-9 grid place-items-center" aria-label="قاموسي">
          <BookOpenCheck className="w-4 h-4 text-emerald-200" />
        </button>
        <button
          onClick={() => setWheelOpen(true)}
          className={`relative glass rounded-xl w-9 h-9 grid place-items-center ${wheel.available ? "border-violet-300/45" : ""}`}
          aria-label="عجلة الحظ"
        >
          <Gift className={`w-4 h-4 ${wheel.available ? "text-violet-200" : "text-white/35"}`} />
          {wheel.available && <span className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-rose-300" />}
        </button>
        <button onClick={() => setAchOpen(true)} className="relative glass rounded-xl w-9 h-9 grid place-items-center" aria-label="الإنجازات">
          <Trophy className="w-4 h-4 text-amber-200" />
          {ach.unlocked.length > 0 && (
            <span className="absolute -top-1 -left-1 min-w-4 h-4 px-0.5 rounded-full bg-amber-300 text-[#33240f] text-[8px] font-bold grid place-items-center">
              {ach.unlocked.length.toLocaleString("ar-EG")}
            </span>
          )}
        </button>
        <button onClick={() => setShopOpen(true)} className="glass rounded-xl w-9 h-9 grid place-items-center" aria-label="المحل">
          <ShoppingBag className="w-4 h-4 text-white/60" />
        </button>
        <button onClick={() => setFriendsOpen(true)} className="glass rounded-xl w-9 h-9 grid place-items-center" aria-label="الأصدقاء">
          <Users className={`w-4 h-4 ${isLoggedIn(account) ? "text-sky-200" : "text-white/55"}`} />
        </button>
        <button onClick={() => setProfOpen(true)} className="glass rounded-full p-0.5 flex items-center gap-1.5 pl-2 max-w-32" aria-label="بروفايلك">
          <Avatar src={account.avatar || profile.avatar} name={name || account.name || profile.name} size={30} ring />
          <span className="font-display text-[11px] font-bold truncate">{name || account.name || profile.name || "حسابي"}</span>
        </button>
      </header>

      {/* هوية اللعبة، بدون تفاصيل تسويقية زائدة */}
      <section className="text-center mt-2 rise-in" style={{ animationDelay: ".04s" }}>
        <div className="h-28 overflow-hidden flex items-center justify-center">
          <div className="scale-[.76]">
            <BusLogo skinId={wallet.skin} avatar={profile.avatar} name={name || profile.name} />
          </div>
        </div>
        <h1 className="font-display title-gradient text-4xl sm:text-5xl font-extrabold leading-none">أتوبيس كومبليت</h1>
        <p className="text-white/45 text-sm font-bold mt-2">اختار لعبتك وابدأ</p>
      </section>

      {/* اللعب الأساسي */}
      <form className="glass rounded-2xl p-3 mt-5 rise-in" style={{ animationDelay: ".08s" }} onSubmit={(event) => { event.preventDefault(); start(); }}>
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="اسمك"
              maxLength={18}
              autoComplete="off"
              className="w-full h-11 bg-[#141b2e]/55 border border-white/10 rounded-xl px-3 pl-9 text-sm font-bold outline-none focus:border-amber-300/45 placeholder:text-white/25"
            />
            <button type="button" onClick={() => setProfOpen(true)} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/35 hover:text-sky-200" aria-label="الصورة">
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <button type="submit" className="btn-primary h-11 px-5 text-sm flex items-center justify-center gap-1.5 shrink-0">
            <Play className="w-4 h-4 fill-current" /> العب
          </button>
        </div>
      </form>

      {/* أبرز اختيارين */}
      <div className="grid grid-cols-2 gap-2 mt-3 rise-in" style={{ animationDelay: ".11s" }}>
        <button onClick={onOnline} className="min-h-14 rounded-2xl border border-emerald-300/25 bg-emerald-400/[.07] px-3 flex items-center gap-2.5 text-right hover:bg-emerald-400/10 transition-colors">
          <Globe className="w-5 h-5 text-emerald-200 shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block font-display text-sm font-bold text-emerald-100">العب أونلاين</span>
            <span className="block text-[10px] font-bold text-white/35">عام أو بكود</span>
          </span>
          <ChevronLeft className="w-3.5 h-3.5 text-white/25" />
        </button>

        <button
          onClick={() => daily.available && onDaily()}
          disabled={!daily.available}
          className={`min-h-14 rounded-2xl border px-3 flex items-center gap-2.5 text-right transition-colors ${
            daily.available ? "border-amber-300/25 bg-amber-400/[.07] hover:bg-amber-400/10" : "border-white/8 bg-white/[.025] opacity-65"
          }`}
        >
          {daily.available ? <CalendarDays className="w-5 h-5 text-amber-200 shrink-0" /> : <Clock className="w-5 h-5 text-white/35 shrink-0" />}
          <span className="flex-1 min-w-0">
            <span className="block font-display text-sm font-bold">التحدي اليومي</span>
            <span className="block text-[10px] font-bold text-white/35" dir={daily.available ? "rtl" : "ltr"}>
              {daily.available ? "سؤال مفاجئ" : formatCountdown(daily.remaining)}
            </span>
          </span>
          <span className="font-display text-lg font-bold text-amber-200">{daily.available ? "؟" : ""}</span>
        </button>
      </div>

      {/* الأطوار الإضافية في شبكة مدمجة */}
      <section className="mt-4 rise-in" style={{ animationDelay: ".14s" }}>
        <div className="flex items-center justify-between mb-2 px-0.5">
          <h2 className="font-display text-sm font-bold text-white/60">ألعاب سريعة</h2>
          <button onClick={() => setBoardOpen(true)} className="flex items-center gap-1 text-[11px] font-bold text-amber-200/70 hover:text-amber-200">
            <Medal className="w-3.5 h-3.5" /> لوحة الشرف
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {modes.map((mode) => {
            const Icon = mode.icon;
            return (
              <button key={mode.name} onClick={mode.action} className={`h-12 rounded-xl border px-2.5 flex items-center gap-2 text-right hover:bg-white/[.07] transition-colors ${mode.tone}`}>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 min-w-0 font-display text-xs font-bold truncate">{mode.name}</span>
                <span className="text-[9px] font-bold text-white/35 shrink-0">{mode.meta}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex items-center justify-center gap-1.5 mt-5 text-[10px] font-bold text-white/25">
        <Bus className="w-3.5 h-3.5" /> {title || "كلمات أسرع، جولات أهدى"}
      </div>

      {shopOpen && <Shop onClose={() => setShopOpen(false)} />}
      {dictOpen && <Dictionary onClose={() => setDictOpen(false)} />}
      {achOpen && <Achievements onClose={() => setAchOpen(false)} />}
      {wheelOpen && <LuckyWheel onClose={() => setWheelOpen(false)} />}
      {friendsOpen && <AccountFriends onClose={() => setFriendsOpen(false)} />}
      {profOpen && <ProfileEditor onClose={() => { setProfOpen(false); setName(readProfile().name); }} />}

      {/* لوحة الشرف خرجت من الصفحة الأساسية لتقليل الزحمة */}
      {boardOpen && (
        <div className="fixed inset-0 z-[86] backdrop flex items-center justify-center p-3" onClick={() => setBoardOpen(false)}>
          <div className="modal-solid rounded-2xl w-full max-w-sm max-h-[78dvh] overflow-hidden pop-in" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
              <Trophy className="w-4 h-4 text-amber-200" />
              <h2 className="font-display font-bold">لوحة الشرف</h2>
              <Globe className="w-3.5 h-3.5 text-emerald-200" />
              <button onClick={() => setBoardOpen(false)} className="mr-auto w-8 h-8 grid place-items-center text-white/40" aria-label="إغلاق">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 overflow-y-auto max-h-[66dvh]">
              {board.length === 0 ? (
                <p className="text-center text-sm font-bold text-white/35 py-8">لسه مفيش أرقام</p>
              ) : (
                <ol className="space-y-1">
                  {board.slice(0, 15).map((record, index) => {
                    const mine = record.name === (name || profile.name);
                    return (
                      <li
                        key={record.id}
                        className={`h-11 rounded-xl px-2.5 flex items-center gap-2 border ${
                          index === 0 ? "bg-amber-400/[.08] border-amber-300/20" : "bg-white/[.025] border-white/[.06]"
                        } ${mine ? "ring-1 ring-sky-300/30" : ""}`}
                      >
                        <span className="w-5 text-center font-display text-xs font-bold text-white/40">{(index + 1).toLocaleString("ar-EG")}</span>
                        <Avatar src={record.avatar} name={record.name} size={26} />
                        <span className="flex-1 truncate text-xs font-bold">{record.name}</span>
                        <span className="text-[9px] font-bold text-white/30">{MODE_LABEL[record.mode]}</span>
                        <span className="font-display text-sm font-bold text-amber-200">{record.score.toLocaleString("ar-EG")}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}