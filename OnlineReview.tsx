import { useMemo, useState } from "react";
import { Check, X, BadgeCheck, Megaphone, PencilRuler } from "lucide-react";
import { CATS } from "../data/lexicon";
import Avatar from "./Avatar";
import type { ReviewData, ManualMode, ReviewRow, ReviewEntry } from "../net/online";

function tierOf(entry: ReviewEntry | null): { cls: string; pts: string; label: string } {
  if (!entry) return { cls: "text-white/30", pts: "", label: "فاضية" };
  const v = entry.auto;
  if (!v || v.t === "bad") return { cls: "text-rose-300", pts: "٠", label: "القاموس رفضها" };
  if (v.t === "exact") return { cls: "text-emerald-300", pts: "١٠", label: "صح" };
  if (v.t === "fixed") return { cls: "text-sky-300", pts: "٨", label: "تصحيح" };
  return { cls: "text-amber-300", pts: "٠", label: "مقبولة" };
}

function calcRowPts(row: ReviewRow, ov: Partial<Record<string, ManualMode>>): number {
  let pts = 0;
  for (const c of CATS) {
    const e = row.answers[c.key];
    if (!e) continue;
    const m = ov[c.key] ?? "auto";
    if (m === "yes") pts += 10;
    else if (m === "no") continue;
    else if (e.auto && e.auto.t !== "bad") pts += e.auto.pts;
  }
  return pts + row.stopBonus;
}

export default function OnlineReview({ data, onFinalize, myId, readOnly = false }: {
  data: ReviewData;
  onFinalize: (overrides: Record<string, Partial<Record<string, ManualMode>>>) => void;
  myId?: string;
  readOnly?: boolean;
}) {
  const [manual, setManual] = useState<Record<string, Partial<Record<string, ManualMode>>>>({});

  const get = (id: string, cat: string): ManualMode => manual[id]?.[cat] ?? "auto";
  const setMode = (id: string, cat: string, mode: ManualMode) => {
    if (readOnly) return; // المشاهدة فقط لا تعدّل
    setManual((m) => {
      const row = { ...(m[id] ?? {}) };
      const next: ManualMode = row[cat] === mode ? "auto" : mode;
      if (next === "auto") delete row[cat]; else row[cat] = next;
      return { ...m, [id]: row };
    });
  };

  const changes = useMemo(
    () => Object.values(manual).reduce((n, r) => n + Object.keys(r).length, 0),
    [manual]
  );

  return (
    <div className="min-h-dvh px-3 py-6 max-w-2xl mx-auto">
      <div className="text-center rise-in">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-400/15 border border-amber-300/40 flex items-center justify-center mb-2">
          <PencilRuler className="w-7 h-7 text-amber-300" />
        </div>
        <h2 className="font-display text-3xl sm:text-4xl font-extrabold title-gradient">صحح زي الحكَم الحقيقي</h2>
        <p className="text-white/60 font-bold text-sm mt-1">
          حرف «{data.letter}» · الجولة {data.round.toLocaleString("ar-EG")} — إجابات الجميع مفتوحة، والمضيف يصحح آخر كلمة
        </p>
      </div>

      <div className="space-y-3 mt-5 pb-4">
        {data.rows.map((row, ri) => (
          <div key={row.id} className={`glass rounded-3xl p-4 rise-in ${row.id === myId ? "ring-1 ring-amber-300/40" : ""}`} style={{ animationDelay: `${ri * 0.06}s` }}>
            <div className="flex items-center gap-2.5 mb-3">
              <Avatar src={row.avatar} name={row.name} size={38} />
              <div className="flex-1 min-w-0">
                <div className="font-extrabold truncate flex items-center gap-2">
                  {row.name}
                  {row.id === myId && <span className="text-[9px] font-extrabold text-amber-300/80">(أنت)</span>}
                  {row.title && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-300/90">
                      <BadgeCheck className="w-3 h-3" />{row.title}
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-bold text-white/45">
                  {row.connected ? (row.stopped ? "وقّف الأتوبيس بنفسه" : "خلّص مع الوقت") : "فُقد الاتصال"}
                </div>
              </div>
              <div className="text-left shrink-0">
                <div className="font-display text-xl font-extrabold text-amber-300 tabular-nums">
                  {calcRowPts(row, manual[row.id] ?? {}).toLocaleString("ar-EG")}
                </div>
                <div className="text-[10px] font-bold text-white/40">
                  نقطة الجولة{row.stopBonus > 0 ? ` (+${row.stopBonus.toLocaleString("ar-EG")} سرعة)` : ""}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              {CATS.map((c) => {
                const entry = row.answers[c.key];
                const tier = tierOf(entry);
                const mode = get(row.id, c.key);
                return (
                  <div
                    key={c.key}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
                      !entry
                        ? "border-white/5 bg-white/[.02]"
                        : mode === "yes"
                          ? "border-emerald-300/55 bg-emerald-400/12"
                          : mode === "no"
                            ? "border-rose-300/55 bg-rose-400/10"
                            : "border-white/10 bg-white/[.035]"
                    }`}
                  >
                    <span className="w-14 shrink-0 text-[11px] font-extrabold text-white/55">{c.label}</span>
                    <span className={`flex-1 min-w-0 font-display font-bold truncate text-sm ${!entry ? "text-white/20" : mode === "no" ? "line-through text-rose-300/80" : ""}`}>
                      {entry ? entry.text : "—"}
                    </span>
                    {entry ? (
                      <>
                        {mode === "yes" ? (
                          <span className="text-[10px] font-extrabold text-emerald-300 bg-emerald-400/15 rounded-full px-2 py-0.5 shrink-0">صح +١٠</span>
                        ) : mode === "no" ? (
                          <span className="text-[10px] font-extrabold text-rose-300 bg-rose-400/15 rounded-full px-2 py-0.5 shrink-0">غلط ٠</span>
                        ) : (
                          <span className={`text-[10px] font-extrabold shrink-0 ${tier.cls}`}>
                            {tier.label} {tier.pts}
                          </span>
                        )}
                        {!readOnly && (
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => setMode(row.id, c.key, "yes")}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                mode === "yes"
                                  ? "bg-emerald-400 text-emerald-950 scale-105"
                                  : "bg-white/8 text-white/50 hover:bg-emerald-400/25 hover:text-emerald-300"
                              }`}
                              aria-label="صح"
                            >
                              <Check className="w-4.5 h-4.5" strokeWidth={2.75} />
                            </button>
                            <button
                              onClick={() => setMode(row.id, c.key, "no")}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                mode === "no"
                                  ? "bg-rose-500 text-white scale-105"
                                  : "bg-white/8 text-white/50 hover:bg-rose-400/25 hover:text-rose-300"
                              }`}
                              aria-label="غلط"
                            >
                              <X className="w-4.5 h-4.5" strokeWidth={2.75} />
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] font-bold text-white/25 shrink-0">مكفاش حاجة</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-3">
        {readOnly ? (
          <div className="glass rounded-2xl py-3 flex items-center justify-center gap-2 font-bold text-white/60 text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: "0s" }} />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: "0.15s" }} />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: "0.3s" }} />
            مستنيين المضيف يعرض النتايج…
          </div>
        ) : (
          <button
            onClick={() => onFinalize(manual)}
            className="btn-primary w-full py-4 text-lg sm:text-xl flex items-center justify-center gap-2 pulse-glow"
          >
            <Megaphone className="w-5.5 h-5.5" />
            اعرض النتايج النهائية{changes > 0 ? ` — عدّلت ${changes.toLocaleString("ar-EG")} إجابة` : ""}
          </button>
        )}
      </div>
    </div>
  );
}
