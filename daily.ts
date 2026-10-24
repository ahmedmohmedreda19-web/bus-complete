/* ===== التحدي اليومي: فئة واحدة + حرف واحد، يتجدد يوميًا الساعة ١٢ منتصف الليل ===== */

import { useEffect, useState } from "react";
import { CATS, ELIGIBLE_LETTERS, type Cat } from "../data/lexicon";

const KEY = "busComplete.daily.v1";
const EVT = "busComplete.dailyChanged";

export const DAILY_REWARD = 20; // جايزة المحاولة اليومية
export const DAILY_PERFECT_BONUS = 15; // لو الإجابة صحيحة

export interface DailyState {
  lastDay: string;   // آخر يوم اتلعب فيه (YYYY-M-D)
  lastAt: number;    // وقت آخر لعب بالمللي ثانية
  lastScore: number;
  streak: number;    // أيام متتالية
  bestScore: number;
  plays: number;
}

const EMPTY: DailyState = { lastDay: "", lastAt: 0, lastScore: 0, streak: 0, bestScore: 0, plays: 0 };

/** مفتاح اليوم بتوقيت الجهاز (YYYY-M-D) */
export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function yesterdayKey(d = new Date()): string {
  const prev = new Date(d);
  prev.setDate(prev.getDate() - 1);
  return todayKey(prev);
}

/** رقم عشوائي ثابت مشتق من نص (نفس اليوم = نفس الحرف والنتيجة للكل) */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** حرف اليوم — ثابت من ١٢ بالليل لـ ١٢ بالليل */
export function dailyLetter(day = todayKey()): string {
  return ELIGIBLE_LETTERS[hashString(day) % ELIGIBLE_LETTERS.length];
}

/** فئة اليوم — ثابتة وتتغير كل يوم عند منتصف الليل */
export function dailyCategory(day = todayKey()): Cat {
  const [year, month, date] = day.split("-").map(Number);
  const dayNumber = Math.floor(new Date(year, month - 1, date).getTime() / 86_400_000);
  return CATS[Math.abs(dayNumber) % CATS.length];
}

export function readDaily(): DailyState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as DailyState) };
  } catch {
    return { ...EMPTY };
  }
}

function write(s: DailyState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* اتجاهل */ }
  window.dispatchEvent(new CustomEvent(EVT));
}

/** هل التحدي متاح؟ متاح لو ملعبتش في نفس اليوم التقويمي (بيتجدد ١٢ بليل) */
export function isDailyAvailable(s = readDaily()): boolean {
  return s.lastDay !== todayKey();
}

/** تسجيل نتيجة التحدي اليومي */
export function completeDaily(score: number): DailyState {
  const s = readDaily();
  const today = todayKey();
  if (s.lastDay === today) return s; // اتلعب خلاص النهارده

  const yest = yesterdayKey();
  const streak = s.lastDay === yest ? s.streak + 1 : 1;

  const next: DailyState = {
    lastDay: today,
    lastAt: Date.now(),
    lastScore: score,
    streak,
    bestScore: Math.max(s.bestScore, score),
    plays: s.plays + 1,
  };
  write(next);
  return next;
}

/** الوقت المتبقي حتى منتصف الليل القادم (الساعة ١٢ بالليل) */
export function msUntilTomorrow(): number {
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return Math.max(0, t.getTime() - d.getTime());
}

export function formatCountdown(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const p = (n: number) => n.toLocaleString("ar-EG", { minimumIntegerDigits: 2, useGrouping: false });
  return `${p(h)}:${p(m)}:${p(s)}`;
}

/** هوك حالة التحدي + عدّاد تنازلي حي حتى ١٢ بليل */
export function useDaily() {
  const [state, setState] = useState<DailyState>(() => readDaily());
  const [remaining, setRemaining] = useState(() => msUntilTomorrow());

  useEffect(() => {
    const h = () => {
      const s = readDaily();
      setState(s);
      setRemaining(msUntilTomorrow());
    };
    window.addEventListener(EVT, h);
    const iv = setInterval(() => {
      const s = readDaily();
      setState(s);
      setRemaining(msUntilTomorrow());
    }, 1000);
    return () => {
      window.removeEventListener(EVT, h);
      clearInterval(iv);
    };
  }, []);

  return {
    state,
    remaining,
    available: isDailyAvailable(state),
    letter: dailyLetter(),
    category: dailyCategory(),
  };
}
