import { useState } from "react";
import { Coins, X, Lightbulb, Clock3, BadgeCheck, ShoppingBag, Check, Palette, Lock, Trophy, Gem } from "lucide-react";
import BusLogo from "./BusLogo";
import { PRICES, TITLES, SKINS } from "../data/shop";
import { useWallet, buyHint, buyTime, buyTitle, equipTitle, buySkin, equipSkin } from "../lib/wallet";
import { useProfile } from "../lib/profile";
import { sfx } from "../lib/sound";

function Price({ n, dark = false, gem = false }: { n: number; dark?: boolean; gem?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-display text-base font-extrabold ${
        dark ? "text-[#4a2402] drop-shadow-[0_1px_0_rgba(255,255,255,.4)]" : gem ? "text-sky-300" : "text-amber-300"
      }`}
    >
      {gem
        ? <Gem className={`w-4 h-4 ${dark ? "text-[#4a2402]" : "text-sky-300"}`} strokeWidth={dark ? 2.75 : 2} />
        : <Coins className={`w-4 h-4 ${dark ? "text-[#4a2402]" : "text-amber-300"}`} strokeWidth={dark ? 2.75 : 2} />}
      {n.toLocaleString("ar-EG")}
    </span>
  );
}

export default function Shop({ onClose }: { onClose: () => void }) {
  const w = useWallet();
  const profile = useProfile();
  const [tab, setTab] = useState<"booster" | "titles" | "skins">("booster");
  const [flash, setFlash] = useState("");

  const ok = (msg: string) => { sfx.correct(); setFlash(msg); setTimeout(() => setFlash(""), 1600); };
  const no = () => sfx.bad();

  return (
    <div className="fixed inset-0 z-[80] backdrop flex items-center justify-center p-3" onClick={onClose}>
      <div
        className="modal-solid rounded-3xl w-full max-w-lg max-h-[88dvh] flex flex-col pop-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* الترويسة */}
        <div className="flex items-center gap-3 p-4 border-b border-white/15 bg-black/20">
          <span className="w-11 h-11 rounded-2xl bg-amber-400/15 border border-amber-300/30 flex items-center justify-center">
            <ShoppingBag className="w-5.5 h-5.5 text-amber-300" />
          </span>
          <div className="flex-1">
            <h2 className="font-display text-2xl font-extrabold leading-6 text-amber-100">دكان السواق</h2>
            <p className="text-xs font-bold text-white/60">كل ما تلعب هتجمع جنيه وتشتري</p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-2xl bg-amber-400/15 border border-amber-300/35 px-3 py-2">
              <Coins className="w-5 h-5 text-amber-300" />
              <span className="flex flex-col items-start leading-none">
                <span key={w.coins} className="font-display text-xl font-extrabold text-amber-300 tabular-nums pop-in">
                  {w.coins.toLocaleString("ar-EG")}
                </span>
                <span className="text-[8px] font-bold text-amber-300/55">جنيه</span>
              </span>
            </div>
            <div className="flex items-center gap-1 rounded-2xl bg-sky-400/15 border border-sky-300/35 px-3 py-2">
              <Gem className="w-5 h-5 text-sky-300" />
              <span className="flex flex-col items-start leading-none">
                <span key={w.gems} className="font-display text-xl font-extrabold text-sky-300 tabular-nums pop-in">
                  {w.gems.toLocaleString("ar-EG")}
                </span>
                <span className="text-[8px] font-bold text-sky-300/55">جوهرة</span>
              </span>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost w-10 h-10 flex items-center justify-center shrink-0" aria-label="قفل">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* التبويبات */}
        <div className="flex gap-1.5 p-3 pb-0">
          {([["booster", "مساعدات"], ["titles", "ألقاب"], ["skins", "سكنات الباص"]] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                tab === k ? "bg-amber-400/25 border border-amber-300/50 text-amber-100 shadow-[0_4px_12px_-6px_rgba(232,181,99,.28)]" : "bg-white/8 border border-white/12 text-white/65 hover:bg-white/12 hover:text-white"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {flash && (
          <div className="mx-3 mt-3 rounded-xl bg-emerald-400/15 border border-emerald-300/35 text-emerald-200 text-sm font-bold px-3 py-2 text-center pop-in">
            {flash}
          </div>
        )}

        {/* المحتوى */}
        <div className="p-3 overflow-y-auto flex-1">
          {tab === "booster" && (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl p-3.5 text-center bg-white/8 border border-white/15">
                <span className="mx-auto w-12 h-12 rounded-2xl bg-sky-400/20 border border-sky-300/40 flex items-center justify-center mb-2">
                  <Lightbulb className="w-6 h-6 text-sky-300" />
                </span>
                <div className="font-extrabold text-sm text-white">تلميح القاموس</div>
                <p className="text-xs font-bold text-white/60 mt-1 leading-4.5">القاموس بيهمّس لك بكلمة مظبوطة في أول خانة فاضية</p>
                <div className="text-xs font-bold text-amber-200/80 mt-1.5">عندك: {w.inv.hint.toLocaleString("ar-EG")}</div>
                <button
                  onClick={() => (buyHint() ? ok("اشتريت تلميح!") : no())}
                  className="btn-primary w-full mt-2.5 py-2.5 text-sm flex items-center justify-center gap-1"
                >
                  اشتري بـ <Price n={PRICES.hint} dark />
                </button>
              </div>
              <div className="rounded-2xl p-3.5 text-center bg-white/8 border border-white/15">
                <span className="mx-auto w-12 h-12 rounded-2xl bg-emerald-400/20 border border-emerald-300/40 flex items-center justify-center mb-2">
                  <Clock3 className="w-6 h-6 text-emerald-300" />
                </span>
                <div className="font-extrabold text-sm text-white">وقود زيادة</div>
                <p className="text-xs font-bold text-white/60 mt-1 leading-4.5">+١٠ ثواني على عداد الجولة الواحدة في الوضع الفردي</p>
                <div className="text-xs font-bold text-amber-200/80 mt-1.5">عندك: {w.inv.time.toLocaleString("ar-EG")}</div>
                <button
                  onClick={() => (buyTime() ? ok("اشتريت وقت!") : no())}
                  className="btn-primary w-full mt-2.5 py-2.5 text-sm flex items-center justify-center gap-1"
                >
                  اشتري بـ <Price n={PRICES.time} dark />
                </button>
              </div>
              <p className="col-span-2 text-center text-xs font-bold text-white/45">
                المساعدات للوضع الفردي بس — أونلاين اللعب نضيف
              </p>
              <div className="col-span-2 rounded-xl border border-sky-300/25 bg-sky-400/[.06] p-3 flex items-start gap-2.5">
                <Gem className="w-5 h-5 text-sky-300 shrink-0 mt-0.5" />
                <div className="text-[11px] font-bold leading-5">
                  <div className="text-sky-200 font-extrabold mb-0.5">الجواهر — عملة نادرة أقوى من الجنيه</div>
                  <div className="text-white/50">تُكسبها فقط بـ:</div>
                  <ul className="text-white/45 pr-3 space-y-0.5">
                    <li>• جولة كاملة إجاباتها التسع صحيحة (+١ جوهرة)</li>
                    <li>• فوز أونلاين على ٣ لاعيبة أو أكتر (+١ جوهرة)</li>
                    <li>• سلاسل أيام ٧/١٥/٣٠ يوم (+٣/٦/١٠ جواهر — يوم كامل بالكذب)</li>
                    <li>• خانة 💎 نادرة جدًا في عجلة الحظ</li>
                  </ul>
                  <div className="mt-1.5 text-white/35">الجواهر بتحط على ألقاب وباصات أسطورية لا تُشترى بالجنيه أبدًا.</div>
                </div>
              </div>
            </div>
          )}

          {tab === "titles" && (
            <div className="space-y-2">
              <button
                onClick={() => { equipTitle(""); ok("شيلت اللقب"); }}
                className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 border font-bold text-sm transition-colors ${!w.title ? "bg-amber-400/15 border-amber-300/50" : "bg-white/7 border-white/12 hover:bg-white/10"}`}
              >
                <BadgeCheck className="w-4.5 h-4.5 text-white/50" />
                <span className="flex-1 text-right text-white/75">من غير لقب</span>
                {!w.title && <Check className="w-4.5 h-4.5 text-amber-300" />}
              </button>
              {TITLES.map((t) => {
                const owned = w.ownedTitles.includes(t.id);
                const equipped = w.title === t.id;
                const isGem = (t.gemPrice ?? 0) > 0;
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 border ${equipped ? "bg-amber-400/15 border-amber-300/50" : isGem ? "bg-sky-400/[.07] border-sky-300/30" : "bg-white/7 border-white/12"}`}
                  >
                    <BadgeCheck className={`w-4.5 h-4.5 shrink-0 ${equipped ? "text-amber-300" : isGem ? "text-sky-300" : "text-white/45"}`} />
                    <div className="flex-1 text-right">
                      <div className="font-extrabold text-sm text-white">{t.label}</div>
                      <div className="text-xs font-bold text-white/55">{t.desc}</div>
                    </div>
                    {owned ? (
                      equipped ? (
                        <span className="text-xs font-extrabold text-amber-200 bg-amber-400/20 border border-amber-300/35 rounded-full px-3 py-1.5">مُجهّز</span>
                      ) : (
                        <button onClick={() => { equipTitle(t.id); ok(`جهّزت لقب «${t.label}»`); }} className="btn-ghost px-3.5 py-1.5 text-xs font-bold">
                          جهّز
                        </button>
                      )
                    ) : isGem ? (
                      <button
                        disabled={w.gems < (t.gemPrice ?? 0)}
                        onClick={() => (buyTitle(t.id) ? ok(`مبروك! اشتريت لقب «${t.label}» بالجواهر`) : no())}
                        className={`px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 rounded-full border ${
                          w.gems >= (t.gemPrice ?? 0)
                            ? "bg-sky-400/20 border-sky-300/50 text-sky-100"
                            : "bg-white/6 border-white/12 text-white/40"
                        }`}
                      >
                        <Gem className="w-3.5 h-3.5" /> {(t.gemPrice ?? 0).toLocaleString("ar-EG")}
                      </button>
                    ) : t.exclusive ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-violet-200 bg-violet-400/15 border border-violet-300/30 rounded-full px-2.5 py-1.5 shrink-0">
                        <Trophy className="w-3.5 h-3.5" /> من إنجاز
                        <Lock className="w-3 h-3 opacity-60" />
                      </span>
                    ) : (
                      <button onClick={() => (buyTitle(t.id) ? ok(`مبروك لقب «${t.label}»!`) : no())} className="btn-primary px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5">
                        اشتري <Price n={t.price} dark />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === "skins" && (
            <div className="grid grid-cols-2 gap-2.5">
              {SKINS.map((sk) => {
                const owned = w.ownedSkins.includes(sk.id);
                const equipped = w.skin === sk.id;
                const isGem = (sk.gemPrice ?? 0) > 0;
                return (
                  <div key={sk.id} className={`rounded-2xl p-3 text-center ${isGem ? "bg-sky-400/[.07] border-sky-300/35" : "bg-white/8 border-white/15"} ${equipped ? "!border-amber-300/60 !bg-amber-400/10" : ""}`}>
                    <div className="h-16 flex items-center justify-center overflow-hidden">
                      <div className="scale-[0.42] origin-center pointer-events-none">
                        <BusLogo skinId={sk.id} avatar={profile.avatar} />
                      </div>
                    </div>
                    <div className="font-extrabold text-xs mt-1 flex items-center justify-center gap-1.5 text-white">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: sk.body }} />
                      {sk.name}
                      {isGem && <Gem className="w-3 h-3 text-sky-300" />}
                    </div>
                    <div className="mt-1.5">
                      {owned ? (
                        equipped ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-300 bg-amber-400/12 rounded-full px-2.5 py-1">
                            <Palette className="w-3.5 h-3.5" /> مُجهّز
                          </span>
                        ) : (
                          <button onClick={() => { equipSkin(sk.id); ok(`لونّا الأتوبيس: ${sk.name}`); }} className="btn-ghost px-3 py-1.5 text-xs font-bold w-full">
                            جهّز
                          </button>
                        )
                      ) : isGem ? (
                        <button
                          disabled={w.gems < (sk.gemPrice ?? 0)}
                          onClick={() => (buySkin(sk.id) ? ok(`مبروك! كسبت «${sk.name}» بالجواهر`) : no())}
                          className={`w-full px-3 py-1.5 text-xs font-bold flex items-center justify-center gap-1.5 rounded-full border ${
                            w.gems >= (sk.gemPrice ?? 0)
                              ? "bg-sky-400/20 border-sky-300/50 text-sky-100"
                              : "bg-white/6 border-white/12 text-white/40"
                          }`}
                        >
                          <Gem className="w-3.5 h-3.5" /> {(sk.gemPrice ?? 0).toLocaleString("ar-EG")}
                        </button>
                      ) : (
                        <button onClick={() => (buySkin(sk.id) ? ok(`مبروك الباص الجديد!`) : no())} className="btn-primary px-3 py-1.5 text-xs font-bold w-full flex items-center justify-center gap-1.5">
                          اشتري <Price n={sk.price} dark />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
