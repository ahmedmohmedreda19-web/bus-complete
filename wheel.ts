/* ===== عجلة الحظ اليومية: لفة مجانية كل يوم تتجدد الساعة ١٢ منتصف الليل ===== */

import { useEffect, useState } from "react";
import { SKINS } from "../data/shop";
import { readWallet, earn, earnGems, grantSkin, addHint, addTime } from "./wallet";

const KEY = "busComplete.wheel.v1";
const EVT = "busComplete.wheelChanged";
export const WHEEL_EVENT = EVT;

export type PrizeKind = "coins" | "hint" | "time" | "skin" | "jackpot" | "gems";

export interface Prize {
  id: string;
  kind: PrizeKind;
  label: string;       // الاسم الظاهر على العجلة (من غير رقم)
  icon: string;
  color: string;
  minAmount?: number;  // أقل مقدار عشوائي
  maxAmount?: number;  // أكبر مقدار عشوائي
  weight: number;      // احتمال الظهور
}

/** خانات العجلة (٨ خانات) — المقدار عشوائي جوه المدى */
export const PRIZES: Prize[] = [
  { id: "c25",   kind: "coins",   label: "جنيه",  icon: "🪙", color: "#e8b563", minAmount: 15,  maxAmount: 40,  weight: 24 },
  { id: "hint",  kind: "hint",    label: "تلميح", icon: "💡", color: "#7fb3d5", minAmount: 1,   maxAmount: 1,   weight: 16 },
  { id: "c60",   kind: "coins",   label: "جنيه",  icon: "💰", color: "#dda76b", minAmount: 45,  maxAmount: 85,  weight: 18 },
  { id: "time",  kind: "time",    label: "وقود وقت", icon: "⏱️", color: "#6bc9a0", minAmount: 1, maxAmount: 1,   weight: 16 },
  { id: "c120",  kind: "coins",   label: "جنيه",  icon: "💎", color: "#a898d0", minAmount: 95,  maxAmount: 170, weight: 10 },
  { id: "hint2", kind: "hint",    label: "تلميح", icon: "🔦", color: "#8fc4dd", minAmount: 2,   maxAmount: 3,   weight: 8 },
  { id: "skin",  kind: "skin",    label: "سكن نادر",  icon: "🚌", color: "#d998b8", weight: 5 },
  { id: "jack",  kind: "jackpot", label: "الجاكبوت!", icon: "👑", color: "#e6c47a", minAmount: 280, maxAmount: 420, weight: 3 },
  // جوهرة — نادرة جدًا، تكسبها الحظ فقط
  { id: "gem",  kind: "gems",    label: "جوهرة",  icon: "💎", color: "#8fc4dd", minAmount: 2, maxAmount: 3, weight: 1 },
];

export interface WheelState {
  lastDay: string;   // YYYY-M-D
  lastAt: number;    // timestamp
  spins: number;
  lastPrize?: string;
}

const EMPTY: WheelState = { lastDay: "", lastAt: 0, spins: 0 };

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function readWheel(): WheelState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as WheelState) } : { ...EMPTY };
  } catch { return { ...EMPTY }; }
}

function write(s: WheelState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* اتجاهل */ }
  try { window.dispatchEvent(new CustomEvent(EVT)); } catch { /* اتجاهل */ }
}

/** اللفة متاحة؟ تتجدد كل يوم عند منتصف الليل (الساعة ١٢ بالليل) */
export function canSpin(s = readWheel()): boolean {
  return s.lastDay !== todayKey();
}

/** الوقت المتبقي حتى منتصف الليل القادم (١٢ بالليل) */
export function msUntilNextSpin(): number {
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return Math.max(0, t.getTime() - d.getTime());
}

/** اختيار جايزة بالوزن */
function pickPrize(): Prize {
  // لو كل السكنات النادرة معاه، نستبعد خانة السكن
  const owned = readWallet().ownedSkins;
  const rareLeft = SKINS.filter((s) => s.rare && !owned.includes(s.id));
  const pool = PRIZES.filter((p) => p.kind !== "skin" || rareLeft.length > 0);
  const total = pool.reduce((n, p) => n + p.weight, 0);
  let r = Math.random() * total;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return pool[0];
}

/** اختيار مقدار عشوائي داخل المدى */
function rollAmount(prize: Prize): number | undefined {
  if (prize.minAmount == null) return undefined; // السكن ليس له مقدار
  const min = prize.minAmount;
  const max = prize.maxAmount ?? min;
  if (max <= min) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

export interface SpinResult {
  prize: Prize;
  index: number;      // مكان الخانة في العجلة (للدوران)
  skinName?: string;  // لو الجايزة سكن
  amount?: number;    // المقدار العشوائي المكسب فعلاً
}

/** لف العجلة — بيرجع الجايزة ويطبّقها */
export function spinWheel(): SpinResult | null {
  if (!canSpin()) return null;
  const prize = pickPrize();
  const index = PRIZES.findIndex((p) => p.id === prize.id);
  const amount = rollAmount(prize);

  let skinName: string | undefined;
  try {
    if (prize.kind === "coins" || prize.kind === "jackpot") earn(amount ?? 0);
    else if (prize.kind === "hint") addHint(amount ?? 1);
    else if (prize.kind === "time") addTime(amount ?? 1);
    else if (prize.kind === "gems") earnGems(amount ?? 1);
    else if (prize.kind === "skin") {
      const owned = readWallet().ownedSkins;
      const left = SKINS.filter((s) => s.rare && !owned.includes(s.id));
      const pick = left[Math.floor(Math.random() * left.length)];
      if (pick) { grantSkin(pick.id); skinName = pick.name; }
      else earn(100); // كلهم معاه — نديله جنيه بدلها
    }
  } catch { /* اتجاهل */ }

  const s = readWheel();
  write({ lastDay: todayKey(), lastAt: Date.now(), spins: s.spins + 1, lastPrize: prize.id });
  return { prize, index, skinName, amount };
}

/** هوك متابعة العجلة */
export function useWheel() {
  const [state, setState] = useState<WheelState>(() => readWheel());
  const [remaining, setRemaining] = useState(() => msUntilNextSpin());
  useEffect(() => {
    const h = () => {
      const s = readWheel();
      setState(s);
      setRemaining(msUntilNextSpin());
    };
    window.addEventListener(EVT, h);
    const iv = setInterval(() => {
      const s = readWheel();
      setState(s);
      setRemaining(msUntilNextSpin());
    }, 1000);
    return () => {
      window.removeEventListener(EVT, h);
      clearInterval(iv);
    };
  }, []);
  return { state, remaining, available: canSpin(state) };
}
