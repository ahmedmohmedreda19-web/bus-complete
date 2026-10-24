import { useEffect, useRef, useState } from "react";
import { Link2, Home, Heart, Crown, ArrowLeft, Zap, Skull, Hourglass, Coins } from "lucide-react";
import Avatar from "./Avatar";
import type { ChainState } from "../lib/chainTypes";
import { useWallet } from "../lib/wallet";
import { sfx } from "../lib/sound";

export interface ChainNet {
  state: ChainState | null;
  myId: string;
  onWord(word: string): void;
}

/** وصلة الحروف أونلاين — كل لاعب في دوره */
export default function ChainOnline({
  net, msg, onExit,
}: {
  net: ChainNet;
  msg: { id: string; ok: boolean; text: string; k: number } | null;
  onExit: () => void;
}) {
  const wallet = useWallet();
  const [text, setText] = useState("");
  const [now, setNow] = useState(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const s = net.state;

  const myTurn = !!s && s.turnId === net.myId && !s.over;
  const me = s?.players.find((p) => p.id === net.myId);
  const turnPlayer = s?.players.find((p) => p.id === s.turnId);
  const msLeft = s ? Math.max(0, s.deadline - now) : 0;
  const secLeft = Math.ceil(msLeft / 1000);
  const pct = s ? Math.max(0, Math.min(1, msLeft / s.turnMs)) : 0;

  useEffect(() => {
    if (s?.over) return;
    const iv = setInterval(() => setNow(Date.now()), 80);
    return () => clearInterval(iv);
  }, [s?.over]);

  // دوري جه؟ ركّز على الإدخال
  useEffect(() => {
    if (myTurn) {
      setText("");
      setTimeout(() => inputRef.current?.focus(), 60);
      try { sfx.tick(); } catch { /* اتجاهل */ }
    }
  }, [myTurn, s?.turnId, s?.round]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = text.trim();
    if (!w || !myTurn) return;
    net.onWord(w);
    setText("");
  };

  if (!s) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p className="text-white/50 font-bold animate-pulse">بنجهّز السلسلة…</p>
      </div>
    );
  }

  /* ===== النتيجة ===== */
  if (s.over) {
    const rows = [...s.players].sort((a, b) => b.score - a.score);
    const iWon = rows.length > 1 && rows[0]?.id === net.myId;
    return (
      <div className="min-h-dvh flex items-start sm:items-center justify-center px-3 py-6">
        <div className="w-full max-w-md">
          <div className="text-center rise-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-400/15 border border-cyan-300/40 text-cyan-200 font-bold text-sm stamp-in">
              <Link2 className="w-4 h-4" /> وصلة الحروف
            </div>
            <h2 className="font-display title-gradient text-4xl font-extrabold mt-2">
              {iWon ? "كسبت السلسلة! 👑" : "خلصت اللعبة"}
            </h2>
            <p className="text-white/55 font-bold text-sm mt-1">
              طول السلسلة: {s.history.length.toLocaleString("ar-EG")} كلمة
            </p>
          </div>

          <div className="glass rounded-3xl p-4 mt-4 rise-in" style={{ animationDelay: ".08s" }}>
            <div className="space-y-1.5">
              {rows.map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 border font-bold ${
                    i === 0 ? "bg-amber-400/15 border-amber-300/45" : "bg-white/[.04] border-white/10"
                  } ${p.id === net.myId ? "ring-1 ring-cyan-300/50" : ""}`}
                >
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-display shrink-0 ${
                    i === 0 ? "bg-amber-400 text-amber-950" : "bg-white/10 text-white/60"
                  }`}>
                    {i === 0 ? <Crown className="w-4 h-4" /> : (i + 1).toLocaleString("ar-EG")}
                  </span>
                  <Avatar src={p.avatar} name={p.name} size={30} />
                  <span className="flex-1 truncate">
                    {p.name} {p.id === net.myId && <span className="text-[10px] text-white/45">(أنت)</span>}
                  </span>
                  <span className="text-[10px] font-bold text-white/40">{p.words.toLocaleString("ar-EG")} كلمة</span>
                  <span className="font-display text-lg text-amber-300 tabular-nums">{p.score.toLocaleString("ar-EG")}</span>
                </div>
              ))}
            </div>
            {me && (
              <div className="mt-3 rounded-2xl bg-amber-400/12 border border-amber-300/30 px-4 py-2.5 text-center">
                <span className="font-bold text-sm text-amber-200 inline-flex items-center gap-1.5">
                  <Coins className="w-4 h-4" /> رصيدك {wallet.coins.toLocaleString("ar-EG")} جنيه
                </span>
              </div>
            )}
          </div>

          {s.history.length > 0 && (
            <div className="glass rounded-3xl p-4 mt-3 rise-in" style={{ animationDelay: ".15s" }}>
              <h3 className="font-display font-bold text-sm mb-2 text-cyan-200">السلسلة</h3>
              <div className="flex flex-wrap gap-1.5 items-center">
                {[...s.history].reverse().slice(-16).map((h, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    {i > 0 && <ArrowLeft className="w-3 h-3 text-white/25" />}
                    <span className="rounded-lg border border-cyan-300/30 bg-cyan-400/12 px-2.5 py-1 text-xs font-bold text-cyan-100">
                      {h.word}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <button onClick={onExit} className="btn-primary w-full py-3.5 text-xl flex items-center justify-center gap-2 mt-4">
            <Home className="w-5.5 h-5.5" /> رجوع
          </button>
        </div>
      </div>
    );
  }

  /* ===== اللعب ===== */
  return (
    <div className="min-h-dvh flex flex-col max-w-lg mx-auto px-4 py-5">
      {/* الترويسة */}
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-2xl bg-cyan-400/20 border border-cyan-300/40 flex items-center justify-center shrink-0">
          <Link2 className="w-6 h-6 text-cyan-300" />
        </span>
        <div className="flex-1">
          <div className="text-[11px] font-extrabold text-cyan-300/90">وصلة الحروف · أونلاين</div>
          <div className="font-display text-lg font-extrabold">
            دورة {s.round.toLocaleString("ar-EG")} · {s.history.length.toLocaleString("ar-EG")} كلمة
          </div>
        </div>
        {me && (
          <Heart className={`w-5 h-5 ${me.lives > 0 ? "text-rose-400 fill-rose-400" : "text-white/15"}`} />
        )}
      </div>

      {/* دور مين */}
      <div className={`mt-3 rounded-2xl border px-4 py-2.5 flex items-center gap-2.5 transition-all ${
        myTurn
          ? "bg-emerald-400/15 border-emerald-300/50 pulse-glow"
          : "bg-white/[.04] border-white/12"
      }`}>
        {turnPlayer && <Avatar src={turnPlayer.avatar} name={turnPlayer.name} size={32} ring={myTurn} />}
        <span className="flex-1 font-bold text-sm">
          {myTurn ? (
            <span className="text-emerald-200 font-display text-base">دورك دلوقتي! 🎯</span>
          ) : (
            <>دور <span className="text-cyan-200 font-display">{turnPlayer?.name ?? "…"}</span></>
          )}
        </span>
        <span className={`font-display text-2xl font-extrabold ${secLeft <= 3 ? "warn-pulse" : "text-white/70"}`}>
          {secLeft.toLocaleString("ar-EG")}
        </span>
      </div>

      {/* شريط الوقت */}
      <div className="h-2 rounded-full bg-white/10 overflow-hidden mt-2">
        <div
          className="h-full rounded-full transition-none"
          style={{
            width: `${pct * 100}%`,
            background: pct > 0.4 ? "linear-gradient(90deg,#7fb3d5,#6bc9a0)" : "linear-gradient(90deg,#dd8f8f,#e8b563)",
          }}
        />
      </div>

      {/* الكلمة السابقة والحرف */}
      <div className="flex-1 flex flex-col items-center justify-center py-4">
        {s.lastWord ? (
          <div className="flex items-center gap-2 mb-4 pop-in" key={s.lastWord}>
            <span className="rounded-2xl border border-white/15 bg-white/6 px-4 py-2 font-display text-lg font-bold text-white/70">
              {s.lastWord}
            </span>
            <ArrowLeft className="w-5 h-5 text-cyan-300" />
          </div>
        ) : (
          <p className="text-white/50 font-bold text-sm mb-3">أول كلمة تبدأ بـ</p>
        )}

        <span className="inline-flex w-24 h-24 rounded-3xl letter-disc items-center justify-center">
          <span className="font-display font-extrabold text-6xl leading-none text-[#33240f]">{s.letter}</span>
        </span>

        {msg && (
          <div
            key={msg.k}
            className={`mt-4 rounded-2xl px-4 py-2 font-bold pop-in border text-sm ${
              msg.ok
                ? "bg-emerald-400/15 border-emerald-300/40 text-emerald-100"
                : "bg-rose-400/15 border-rose-300/40 text-rose-100"
            }`}
          >
            <span className="text-white/50 text-xs">
              {s.players.find((p) => p.id === msg.id)?.name ?? ""}:
            </span>{" "}
            {msg.text}
          </div>
        )}
      </div>

      {/* الإدخال */}
      {me?.alive ? (
        <form onSubmit={submit}>
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={myTurn ? `كلمة بحرف «${s.letter}»…` : "استنى دورك…"}
            disabled={!myTurn}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            className="w-full bg-[#141b2e]/70 border-2 rounded-2xl px-4 py-4 text-xl font-extrabold outline-none transition-colors placeholder:text-white/25 text-center disabled:opacity-45 border-cyan-300/40 focus:border-cyan-300/90"
          />
          <button
            type="submit"
            disabled={!myTurn}
            className="btn-primary w-full py-3 mt-2 text-lg flex items-center justify-center gap-2 disabled:opacity-45"
          >
            <Zap className="w-5 h-5" /> وصّل
          </button>
        </form>
      ) : (
        <div className="glass rounded-2xl py-4 text-center font-bold text-white/70 flex items-center justify-center gap-2">
          <Skull className="w-5 h-5 text-rose-300" /> خرجت — بتتفرج على الباقيين
        </div>
      )}

      {/* اللاعيبة */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
        {s.players.map((p) => (
          <span
            key={p.id}
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-extrabold border transition-all ${
              !p.alive
                ? "bg-white/[.02] border-white/8 text-white/30 line-through"
                : p.id === s.turnId
                  ? "bg-emerald-400/20 border-emerald-300/50 text-emerald-100 scale-105"
                  : "bg-white/6 border-white/12 text-white/65"
            }`}
          >
            <Avatar src={p.avatar} name={p.name} size={16} />
            {p.name}
            <span className="font-display text-white/45">{p.score.toLocaleString("ar-EG")}</span>
            {!p.alive && <Skull className="w-3 h-3 text-white/30" />}
          </span>
        ))}
      </div>

      {/* آخر الكلمات */}
      {s.history.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-center mt-2 max-h-16 overflow-hidden">
          {s.history.slice(0, 8).map((h, i) => (
            <span key={i} className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-bold text-white/45">
              {h.word}
            </span>
          ))}
        </div>
      )}

      <button onClick={onExit} className="btn-ghost w-full py-2.5 mt-2 text-sm font-bold text-white/50 flex items-center justify-center gap-2">
        <Hourglass className="w-4 h-4" /> خروج
      </button>
    </div>
  );
}
