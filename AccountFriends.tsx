import { useMemo, useState } from "react";
import {
  X, Users, Copy, Check, LogOut,
  UserPlus, Cloud, CloudOff, Share2, MessageCircle,
} from "lucide-react";
import Avatar from "./Avatar";
import {
  loginWithFacebook,
  loginWithFacebookLocal,
  logoutAccount,
  syncProgressNow,
  useAccount,
  isLoggedIn,
} from "../lib/account";
import { isFirebaseConfigured } from "../lib/firebase";
import {
  acceptFriendRequest,
  declineFriendRequest,
  getInviteLinks,
  removeFriend,
  sendFriendRequestByCode,
  useFriends,
} from "../lib/friends";
import { sfx } from "../lib/sound";

export default function AccountFriends({
  onClose,
  roomCode,
}: {
  onClose: () => void;
  roomCode?: string;
}) {
  const account = useAccount();
  const friends = useFriends();
  const [tab, setTab] = useState<"account" | "friends" | "invite">("account");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const invites = useMemo(() => getInviteLinks({ roomCode }), [roomCode, account.friendCode]);

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 2200);
  };

  const login = async () => {
    setBusy(true);
    try {
      if (isFirebaseConfigured()) {
        const res = await loginWithFacebook();
        if (!res.ok) {
          // fallback محلي لو الفيس اترفض أو الإعدادات ناقصة
          loginWithFacebookLocal();
          flash(res.reason === "firebase-not-configured"
            ? "تم ربط حساب محلي — فعّل Firebase للفيس الحقيقي"
            : "تعذر فيسبوك، اتعمل حساب محلي بدلًا منه");
        } else {
          flash("تم تسجيل الدخول وحفظ التقدم");
          sfx.correct();
        }
      } else {
        loginWithFacebookLocal();
        flash("تم إنشاء حساب وحفظ التقدم على الجهاز");
        sfx.correct();
      }
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    try {
      await logoutAccount();
      flash("تم تسجيل الخروج");
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    setBusy(true);
    try {
      const res = await syncProgressNow();
      if (res.ok) {
        flash("التقدم اتحفظ على السحابة");
        sfx.correct();
      } else if (res.reason === "firebase-not-configured") {
        flash("الحفظ السحابي محتاج تفعيل Firebase");
      } else if (res.reason === "not-logged-in") {
        flash("سجّل دخول الأول");
      } else {
        flash("المزامنة فشلت، حاول تاني");
      }
    } finally {
      setBusy(false);
    }
  };

  const sendRequest = () => {
    const res = sendFriendRequestByCode(code);
    if (res.ok) {
      setCode("");
      flash("اتبعت طلب الصداقة");
      sfx.correct();
      return;
    }
    const map: Record<string, string> = {
      "invalid-code": "اكتب كود صحيح",
      "login-required": "سجّل دخول عشان تضيف أصحاب",
      self: "مش هتقدر تضيف نفسك",
      "already-friends": "هو صاحبكم أصلًا",
      "already-sent": "الطلب متبعت قبل كده",
    };
    flash(map[res.reason || ""] || "مقدرناش نبعت الطلب");
    sfx.bad();
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
      flash("اتنسخ");
    } catch {
      flash("النسخ فشل");
    }
  };

  return (
    <div className="fixed inset-0 z-[88] backdrop flex items-center justify-center p-3" onClick={onClose}>
      <div className="modal-solid rounded-2xl w-full max-w-md max-h-[84dvh] overflow-hidden pop-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <Users className="w-4 h-4 text-sky-200" />
          <h2 className="font-display font-bold">الحساب والأصدقاء</h2>
          <button onClick={onClose} className="mr-auto w-8 h-8 grid place-items-center text-white/40" aria-label="إغلاق">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1 p-2 border-b border-white/8">
          {[
            { id: "account", label: "حسابي" },
            { id: "friends", label: "أصدقاء" },
            { id: "invite", label: "دعوة" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className={`h-9 rounded-lg text-xs font-bold ${tab === t.id ? "bg-white/10 text-white" : "text-white/45 hover:text-white/70"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-3 overflow-y-auto max-h-[66dvh] space-y-3">
          {msg && <div className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-xs font-bold text-white/70">{msg}</div>}

          {tab === "account" && (
            <>
              <div className="glass rounded-xl p-3 flex items-center gap-3">
                <Avatar src={account.avatar} name={account.name || "زائر"} size={46} ring={isLoggedIn(account)} />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-sm font-bold truncate">{account.name || "مش مسجّل"}</div>
                  <div className="text-[11px] font-bold text-white/40">
                    {isLoggedIn(account) ? (isFirebaseConfigured() ? "حساب فيسبوك + حفظ سحابي" : "حساب محفوظ على الجهاز") : "التقدم محلي فقط"}
                  </div>
                  {account.friendCode && (
                    <div className="mt-1 text-[11px] font-bold text-amber-200/80">كود الصداقة: {account.friendCode}</div>
                  )}
                </div>
              </div>

              {!isLoggedIn(account) ? (
                <button disabled={busy} onClick={login} className="btn-primary w-full h-11 text-sm flex items-center justify-center gap-2">
                  <span className="font-display text-base leading-none">f</span>
                  {busy ? "جاري الدخول…" : "تسجيل بالفيس"}
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button disabled={busy} onClick={sync} className="btn-ghost h-10 text-xs font-bold flex items-center justify-center gap-1.5">
                    {isFirebaseConfigured() ? <Cloud className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
                    حفظ التقدم
                  </button>
                  <button disabled={busy} onClick={logout} className="btn-ghost h-10 text-xs font-bold flex items-center justify-center gap-1.5 text-rose-200">
                    <LogOut className="w-3.5 h-3.5" /> خروج
                  </button>
                </div>
              )}

              <div className="rounded-xl border border-white/8 bg-white/[.03] p-3 text-[11px] font-bold text-white/45 leading-5">
                التسجيل بالفيس بيحفظ اسمك وصورتك وتقدمك.
                {!isFirebaseConfigured() && " حالياً الحفظ على الجهاز شغال، ولتفعيل الفيس الحقيقي حط بيانات Firebase في ملف الإعداد."}
              </div>
            </>
          )}

          {tab === "friends" && (
            <>
              <div className="glass rounded-xl p-3 space-y-2">
                <div className="text-[11px] font-bold text-white/45">ضيف بالـ كود</div>
                <div className="flex gap-2">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                    maxLength={8}
                    className="flex-1 h-10 rounded-xl bg-[#141b2e]/55 border border-white/10 px-3 text-sm font-bold outline-none focus:border-sky-300/40"
                  />
                  <button onClick={sendRequest} className="btn-primary h-10 px-3 text-xs flex items-center gap-1">
                    <UserPlus className="w-3.5 h-3.5" /> إضافة
                  </button>
                </div>
                {account.friendCode && (
                  <button onClick={() => copyText(account.friendCode)} className="text-[11px] font-bold text-amber-200/80 flex items-center gap-1">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    كودي: {account.friendCode}
                  </button>
                )}
              </div>

              {friends.incoming.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-white/45">طلبات واردة</div>
                  {friends.incoming.map((req) => (
                    <div key={req.id} className="h-12 rounded-xl border border-white/8 bg-white/[.03] px-2.5 flex items-center gap-2">
                      <Avatar src={req.from.avatar} name={req.from.name} size={28} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{req.from.name}</div>
                        <div className="text-[10px] text-white/35">{req.from.friendCode}</div>
                      </div>
                      <button onClick={() => acceptFriendRequest(req.id)} className="btn-primary h-8 px-2 text-[10px]">قبول</button>
                      <button onClick={() => declineFriendRequest(req.id)} className="btn-ghost h-8 px-2 text-[10px]">رفض</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-white/45">أصحابي ({friends.friends.length.toLocaleString("ar-EG")})</div>
                {friends.friends.length === 0 ? (
                  <p className="text-center text-xs font-bold text-white/30 py-6">لسه مفيش أصحاب</p>
                ) : (
                  friends.friends.map((f) => (
                    <div key={f.friendCode} className="h-12 rounded-xl border border-white/8 bg-white/[.03] px-2.5 flex items-center gap-2">
                      <Avatar src={f.avatar} name={f.name} size={28} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{f.name}</div>
                        <div className="text-[10px] text-white/35">{f.source === "facebook" ? "فيسبوك" : "من اللعبة"} · {f.friendCode}</div>
                      </div>
                      <button onClick={() => removeFriend(f.friendCode)} className="text-[10px] font-bold text-rose-200/80">حذف</button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {tab === "invite" && (
            <>
              <div className="glass rounded-xl p-3 space-y-2">
                <div className="text-sm font-bold">ادعُ أصحابك</div>
                <p className="text-[11px] font-bold text-white/40 leading-5">
                  ابعت لينك اللعبة على أي منصة. لو معندهمش اللعبة يقدروا يفتحوا اللينك ويلعبوا.
                </p>
                <div className="rounded-lg bg-[#141b2e]/50 border border-white/10 px-2.5 py-2 text-[11px] font-bold text-white/55 break-all">
                  {invites.link}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <a href={invites.whatsapp} target="_blank" rel="noreferrer" className="btn-ghost h-10 text-[11px] font-bold flex items-center justify-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-300" /> واتساب
                  </a>
                  <a href={invites.messenger} target="_blank" rel="noreferrer" className="btn-ghost h-10 text-[11px] font-bold flex items-center justify-center gap-1">
                    <span className="text-sky-300 font-display text-sm leading-none">m</span> ماسنجر
                  </a>
                  <a href={invites.telegram} target="_blank" rel="noreferrer" className="btn-ghost h-10 text-[11px] font-bold flex items-center justify-center gap-1">
                    <span className="text-cyan-300 font-display text-sm leading-none">✈</span> تلجرام
                  </a>
                  <a href={invites.mail} target="_blank" rel="noreferrer" className="btn-ghost h-10 text-[11px] font-bold flex items-center justify-center gap-1">
                    <span className="text-amber-300 font-display text-sm leading-none">✉</span> ميل
                  </a>
                  <a href={invites.facebook} target="_blank" rel="noreferrer" className="btn-ghost h-10 text-[11px] font-bold flex items-center justify-center gap-1">
                    <span className="text-sky-300 font-display text-sm leading-none">f</span> فيسبوك
                  </a>
                  <a href={invites.instagram.url} target="_blank" rel="noreferrer" onClick={() => copyText(invites.instagram.text)} className="btn-ghost h-10 text-[11px] font-bold flex items-center justify-center gap-1">
                    <span className="text-fuchsia-300 font-display text-sm leading-none">📷</span> إنستا
                  </a>
                  <button onClick={() => copyText(invites.text)} className="btn-ghost h-10 text-[11px] font-bold flex items-center justify-center gap-1 col-span-2">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                    نسخ الرسالة
                  </button>
                </div>
              </div>

              {roomCode && (
                <div className="rounded-xl border border-amber-300/20 bg-amber-400/[.06] p-3 text-[11px] font-bold text-amber-100/90">
                  دعوة الغرفة الحالية: <span dir="ltr">{roomCode}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
