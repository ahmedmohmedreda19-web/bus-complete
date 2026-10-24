import { Crown, Medal, Play, LogOut, Hourglass, Bus, Coins, BadgeCheck, Heart } from "lucide-react";
import { CATS } from "../data/lexicon";
import { coinsFromResults, type NetResults, type NetResultRow, type LikeMap } from "../net/online";
import { useWallet } from "../lib/wallet";
import Avatar from "./Avatar";

function tierStyle(v: { t: string } | null) {
  if (!v) return { cls: "bg-white/[.04] border-white/10 text-white/30", pts: "" };
  if (v.t === "exact") return { cls: "bg-emerald-400/12 border-emerald-300/35 text-emerald-200", pts: "١٠" };
  if (v.t === "fixed") return { cls: "bg-sky-400/12 border-sky-300/35 text-sky-200", pts: "٨" };
  if (v.t === "ok") return { cls: "bg-amber-400/12 border-amber-300/35 text-amber-200", pts: "٠" };
  return { cls: "bg-rose-400/10 border-rose-300/30 text-rose-300 line-through", pts: "٠" };
}

function PodiumCard({ row, rank, me, onOpen }: { row: NetResultRow; rank: number; me: boolean; onOpen?: () => void }) {
  const first = rank === 0;
  return (
    <div className={`rounded-2xl p-3 text-center border pop-in ${first
      ? "bg-gradient-to-b from-amber-400/14 to-amber-400/5 border-amber-300/50 col-span-2 sm:col-span-1"
      : "glass-soft"}`}
      style={{ animationDelay: `${rank * 0.1}s` }}
    >
      <button onClick={onOpen} className="relative mx-auto w-fit mb-1.5 block hover:scale-105 transition-transform" aria-label={`بروفايل ${row.name}`}>
        <Avatar src={row.avatar} name={row.name} size={first ? 54 : 42} ring={first} />
        <span className={`absolute -bottom-1 -left-1 w-6 h-6 rounded-lg flex items-center justify-center border-2 border-[#1b2237] ${first ? "bg-amber-400 text-amber-950" : "bg-white/15 text-white/80"}`}>
          {first ? <Crown className="w-3.5 h-3.5" /> : <Medal className="w-3 h-3" />}
        </span>
      </button>
      <div className={`font-display font-bold truncate ${first ? "text-amber-200" : ""}`}>
        {row.name} {me && <span className="text-[10px] font-bold text-white/45">(أنت)</span>}
      </div>
      {!row.connected && <div className="text-[10px] font-bold text-rose-300/80">فُقد الاتصال</div>}
      <div className={`font-display font-extrabold leading-none mt-1 ${first ? "text-4xl text-amber-300" : "text-2xl text-white/85"}`}>
        {row.total.toLocaleString("ar-EG")}
      </div>
      <div className="text-[11px] font-bold text-white/50 mt-1">
        الجولة +{row.roundPts.toLocaleString("ar-EG")}
        {row.bonus > 0 && <span className="text-emerald-300"> وسرعة +{row.bonus.toLocaleString("ar-EG")}</span>}
      </div>
    </div>
  );
}

export default function OnlineResults({
  results, myId, amHost, seriesDone = false, likes = {}, likedByMe = new Set(), onLike, onOpenCard, onNext, onLeave,
}: {
  results: NetResults;
  myId: string;
  amHost: boolean;
  seriesDone?: boolean;
  likes?: LikeMap;
  likedByMe?: ReadonlySet<string>;
  onLike?: (target: string, cat: string) => void;
  onOpenCard?: (id: string) => void;
  onNext: () => void;
  onLeave: () => void;
}) {
  const podium = results.rows.slice(0, 3);
  const rest = results.rows.slice(3);
  const wallet = useWallet();
  const myRow = results.rows.find((r) => r.id === myId);
  const coins = coinsFromResults(results, myId);
  const won = results.rows.length >= 2 && results.rows[0].id === myId;
  return (
    <div className="min-h-dvh flex items-start justify-center px-3 py-6">
      <div className="w-full max-w-2xl">
        <div className="text-center rise-in">
          <h2 className="font-display title-gradient text-4xl font-extrabold">نتايج الجولة {results.round.toLocaleString("ar-EG")}</h2>
          <p className="text-white/55 font-bold text-sm mt-1">حرف «{results.letter}» — شوف مين رد عليك!</p>
          {myRow && (
            <div className="inline-flex items-center gap-1.5 mt-3 rounded-2xl bg-amber-400/12 border border-amber-300/30 px-4 py-2 pop-in">
              <Coins className="w-4.5 h-4.5 text-amber-300" />
              <span className="font-bold text-sm text-amber-200">
                كسبت <span className="font-display">{coins.toLocaleString("ar-EG")}</span> جنيه
                {won && <span className="text-amber-300"> (+٢٥ فوز)</span>}
              </span>
              <span className="text-white/30 text-xs font-bold">· رصيدك: <span className="font-display text-amber-300">{wallet.coins.toLocaleString("ar-EG")}</span> جنيه{wallet.gems > 0 && <> + <span className="font-display text-sky-300">{wallet.gems.toLocaleString("ar-EG")}</span> جوهرة</>}</span>
            </div>
          )}
        </div>

        {/* المنصة */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-5">
          {podium.map((r, i) => <PodiumCard key={r.id} row={r} rank={i} me={r.id === myId} onOpen={() => onOpenCard?.(r.id)} />)}
          {rest.length > 0 && (
            <div className="col-span-2 sm:col-span-3 space-y-1.5">
              {rest.map((r, i) => (
                <div key={r.id} className="glass-soft rounded-xl px-4 py-2 flex items-center gap-3 font-bold text-sm">
                  <span className="w-6 h-6 rounded-lg bg-white/8 text-white/50 flex items-center justify-center text-xs font-display">{(i + 4).toLocaleString("ar-EG")}</span>
                  <button onClick={() => onOpenCard?.(r.id)} className="shrink-0 hover:scale-110 transition-transform" aria-label={`بروفايل ${r.name}`}>
                    <Avatar src={r.avatar} name={r.name} size={28} />
                  </button>
                  <span className="flex-1 truncate">{r.name} {r.id === myId && <span className="text-[10px] text-white/40">(أنت)</span>}</span>
                  <span className="text-white/45 text-xs">+{r.roundPts.toLocaleString("ar-EG")}</span>
                  <span className="font-display text-amber-300 tabular-nums">{r.total.toLocaleString("ar-EG")}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* مقارنة الإجابات */}
        <div className="glass rounded-3xl p-4 mt-4 rise-in" style={{ animationDelay: ".15s" }}>
          <h3 className="font-display font-bold text-lg mb-3 text-white/85">إجابات الكل في كل فئة</h3>
          <div className="space-y-2.5">
            {CATS.map((c, i) => (
              <div key={c.key} className="rise-in" style={{ animationDelay: `${0.2 + i * 0.04}s` }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                  <span className="text-xs font-extrabold text-white/65">{c.label}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pr-4">
                  {results.rows.map((r) => {
                    const a = r.answers[c.key];
                    const st = tierStyle(a?.verdict ?? null);
                    return (
                      <span key={r.id} className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-bold max-w-full ${st.cls} ${r.id === myId ? "ring-1 ring-amber-300/50" : ""}`}>
                        <span className="text-white/45 font-extrabold">{r.name.split(" ")[0]}:</span>
                        <span className="truncate max-w-36">{a ? a.verdict && a.verdict.t !== "bad" ? a.verdict.display : a.text : "—"}</span>
                        {a?.verdict && a.verdict.t !== "bad" && <span className="font-display text-white/40">{st.pts}</span>}
                        {a?.unique && <span className="font-display text-violet-300 shrink-0" title="تميّز: ما حدش جابها غيرك">+٣</span>}
                        {a?.manual && <BadgeCheck className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-label="حكم المضيف" />}
                        {a?.verdict && a.verdict.t !== "bad" && (() => {
                          const n = likes[`${r.id}|${c.key}`] ?? 0;
                          const mine = r.id === myId;
                          const liked = likedByMe.has(`${r.id}|${c.key}`);
                          return (
                            <button
                              onClick={() => !mine && onLike?.(r.id, c.key)}
                              disabled={mine || liked}
                              className={`inline-flex items-center gap-0.5 rounded-md px-1 -mr-0.5 shrink-0 transition-all ${
                                mine || liked ? "opacity-70 cursor-default" : "hover:bg-rose-400/20 hover:scale-110 active:scale-95"
                              }`}
                              aria-label={liked ? "تم الإعجاب" : "إعجاب"}
                            >
                              <Heart className={`w-3.5 h-3.5 ${liked || n > 0 ? "text-rose-300 fill-rose-300" : "text-white/35"}`} />
                              {n > 0 && <span className="font-display text-rose-200">{n.toLocaleString("ar-EG")}</span>}
                            </button>
                          );
                        })()}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* الأزرار */}
        <div className="mt-4 rise-in" style={{ animationDelay: ".3s" }}>
          {seriesDone ? (
            <div className="rounded-2xl bg-gradient-to-l from-amber-400/11 to-amber-400/5 border border-amber-300/40 py-3 flex items-center justify-center gap-2 font-display font-bold text-lg text-amber-200">
              <Crown className="w-5 h-5 text-amber-300" /> خلصت السلسلة! كفاية كده؟
            </div>
          ) : amHost ? (
            <button onClick={onNext} className="btn-primary w-full py-3.5 text-xl flex items-center justify-center gap-2">
              <Bus className="w-5.5 h-5.5" /> ابدأ الجولة الجاية <Play className="w-5 h-5 fill-current" />
            </button>
          ) : (
            <div className="glass rounded-2xl py-3.5 flex items-center justify-center gap-2 font-bold text-white/70">
              <Hourglass className="w-5 h-5 text-amber-300 animate-spin" style={{ animationDuration: "2.4s" }} />
              مستني المضيف يبدأ الجولة الجاية…
            </div>
          )}
          <button onClick={onLeave} className="btn-ghost w-full py-3 mt-2 flex items-center justify-center gap-2 font-bold text-white/60">
            <LogOut className="w-4.5 h-4.5" /> انزل من الأتوبيس
          </button>
        </div>
      </div>
    </div>
  );
}
