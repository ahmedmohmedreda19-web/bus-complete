/* ===== نظام الإنجازات: شارات دائمة بتتفتح مع رحلة اللاعب ===== */

import { useEffect, useState } from "react";
import { loadStats } from "./storage";
import { readDaily } from "./daily";
import { customCount } from "../data/lexicon";
import { earn, readWallet, grantTitle } from "./wallet";

const KEY = "busComplete.achievements.v1";
const EVT = "busComplete.achievementsChanged";
export const ACH_EVENT = EVT;
export const ACH_UNLOCK_EVENT = "busComplete.achievementUnlocked";

export type AchId =
  | "first100" | "score200" | "perfectRound" | "flawless5"
  | "daily3" | "daily7" | "daily30"
  | "onlineWin" | "online5wins" | "socialLike"
  | "dict10" | "dict100"
  | "words100" | "words500" | "games25" | "botSlayer";

export interface Achievement {
  id: AchId;
  name: string;
  desc: string;
  icon: string;      // إيموجي الشارة
  coins: number;     // مكافأة
  title?: string;    // لقب حصري (id من TITLES أو نص حر)
  tier: "bronze" | "silver" | "gold";
  /** التقدم الحالي والهدف — للعرض */
  progress: () => { now: number; goal: number };
}

/** حالة الجلسة اللي بتتجمع أثناء اللعب (لإنجازات لحظية) */
interface RunState {
  flawlessStreak: number; // جولات متتالية من غير غلطة
  perfectRounds: number;  // جولات كاملة التسع فئات
  onlineWins: number;
  likesGiven: number;
}

const EMPTY_RUN: RunState = { flawlessStreak: 0, perfectRounds: 0, onlineWins: 0, likesGiven: 0 };

interface Store {
  unlocked: AchId[];
  run: RunState;
}

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { unlocked: [], run: { ...EMPTY_RUN } };
    const s = JSON.parse(raw) as Store;
    return { unlocked: Array.isArray(s.unlocked) ? s.unlocked : [], run: { ...EMPTY_RUN, ...s.run } };
  } catch { return { unlocked: [], run: { ...EMPTY_RUN } }; }
}

function write(s: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* اتجاهل */ }
  try { window.dispatchEvent(new CustomEvent(EVT)); } catch { /* اتجاهل */ }
}

/* ============ كتالوج الإنجازات ============ */

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first100", name: "أول ١٠٠ نقطة", desc: "اجمع ١٠٠ نقطة في جولة واحدة",
    icon: "💯", coins: 40, tier: "bronze",
    progress: () => ({ now: Math.min(loadStats().best, 100), goal: 100 }),
  },
  {
    // نحتفظ بالـid القديم عشان بيانات اللاعبين الحالية ما تضيعش.
    id: "score200", name: "المدفع", desc: "اجمع ١٥٠ نقطة في جولة واحدة",
    icon: "💥", coins: 100, tier: "gold", title: "ach_cannon",
    progress: () => ({ now: Math.min(loadStats().best, 150), goal: 150 }),
  },
  {
    id: "perfectRound", name: "أتوبيس كومبليت!", desc: "املأ التسع فئات في جولة واحدة",
    icon: "🚌", coins: 60, tier: "silver",
    progress: () => ({ now: Math.min(read().run.perfectRounds, 1), goal: 1 }),
  },
  {
    id: "flawless5", name: "بدون غلطة", desc: "٥ جولات ورا بعض، ٥ إجابات صحيحة على الأقل بكل جولة",
    icon: "🎯", coins: 120, tier: "gold", title: "ach_marksman",
    progress: () => ({ now: Math.min(read().run.flawlessStreak, 5), goal: 5 }),
  },
  {
    id: "daily3", name: "منتظم", desc: "٣ أيام تحدي ورا بعض",
    icon: "🔥", coins: 50, tier: "bronze",
    progress: () => ({ now: Math.min(readDaily().streak, 3), goal: 3 }),
  },
  {
    id: "daily7", name: "أسبوع كامل", desc: "٧ أيام تحدي ورا بعض",
    icon: "📅", coins: 150, tier: "gold", title: "ach_week",
    progress: () => ({ now: Math.min(readDaily().streak, 7), goal: 7 }),
  },
  {
    id: "daily30", name: "شهر ما فوّتش", desc: "٣٠ يوم تحدي ورا بعض",
    icon: "👑", coins: 500, tier: "gold", title: "ach_month",
    progress: () => ({ now: Math.min(readDaily().streak, 30), goal: 30 }),
  },
  {
    id: "onlineWin", name: "أول فوز أونلاين", desc: "اكسب جولة أونلاين",
    icon: "🥇", coins: 80, tier: "silver",
    progress: () => ({ now: Math.min(read().run.onlineWins, 1), goal: 1 }),
  },
  {
    id: "online5wins", name: "بطل الغرف", desc: "اكسب ٥ جولات أونلاين",
    icon: "🏆", coins: 200, tier: "gold", title: "ach_online",
    progress: () => ({ now: Math.min(read().run.onlineWins, 5), goal: 5 }),
  },
  {
    id: "socialLike", name: "ذوق عالي", desc: "اعمل إعجاب على ٥ إجابات",
    icon: "❤️", coins: 30, tier: "bronze",
    progress: () => ({ now: Math.min(read().run.likesGiven, 5), goal: 5 }),
  },
  {
    id: "dict10", name: "معلّم القاموس", desc: "ضيف ١٠ كلمات لقاموسك",
    icon: "📖", coins: 50, tier: "bronze",
    progress: () => ({ now: Math.min(customCount(), 10), goal: 10 }),
  },
  {
    id: "dict100", name: "صاحب المعجم", desc: "ضيف ١٠٠ كلمة لقاموسك",
    icon: "📚", coins: 300, tier: "gold", title: "ach_dictionary",
    progress: () => ({ now: Math.min(customCount(), 100), goal: 100 }),
  },
  {
    id: "words100", name: "مية كلمة", desc: "اكتب ١٠٠ كلمة صح",
    icon: "✍️", coins: 60, tier: "silver",
    progress: () => ({ now: Math.min(loadStats().words, 100), goal: 100 }),
  },
  {
    id: "words500", name: "بحر كلام", desc: "اكتب ٥٠٠ كلمة صح",
    icon: "🌊", coins: 250, tier: "gold", title: "ach_wordsea",
    progress: () => ({ now: Math.min(loadStats().words, 500), goal: 500 }),
  },
  {
    id: "games25", name: "راكب دائم", desc: "العب ٢٥ جولة",
    icon: "🎫", coins: 100, tier: "silver", title: "ach_veteran",
    progress: () => ({ now: Math.min(loadStats().games, 25), goal: 25 }),
  },
  {
    id: "botSlayer", name: "قاهر البوتات", desc: "اكسب ١٠ مرات (بوتات أو أونلاين)",
    icon: "🤖", coins: 120, tier: "silver",
    progress: () => ({ now: Math.min(loadStats().wins, 10), goal: 10 }),
  },
];

export function getAchievement(id: AchId): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export function unlockedIds(): AchId[] {
  return read().unlocked;
}

export function isUnlocked(id: AchId): boolean {
  return read().unlocked.includes(id);
}

/* ============ تسجيل أحداث اللعب ============ */

export function noteRun(patch: Partial<RunState>) {
  const s = read();
  s.run = { ...s.run, ...patch };
  write(s);
}

/** جولة خلصت: نحدّث السلاسل اللحظية */
export function noteRound(o: { flawless: boolean; perfect: boolean; onlineWin?: boolean }) {
  const s = read();
  s.run.flawlessStreak = o.flawless ? s.run.flawlessStreak + 1 : 0;
  if (o.perfect) s.run.perfectRounds += 1;
  if (o.onlineWin) s.run.onlineWins += 1;
  write(s);
}

export function noteLike() {
  const s = read();
  s.run.likesGiven += 1;
  write(s);
}

/** الجولة الكاملة لازم تكون التسع فئات، مش سؤال التحدي اليومي الواحد. */
export function isPerfectRound(answerCount: number, correctCount: number): boolean {
  return answerCount === 9 && correctCount === 9;
}

/** سلسلة بدون غلطة تتطلب جولة فعلية فيها ٥ محاولات على الأقل. */
export function isFlawlessRound(attempted: number, correct: number): boolean {
  return attempted >= 5 && attempted === correct;
}

/**
 * فحص كل الإنجازات ومنح الجديد منها.
 * بيرجع الإنجازات اللي اتفتحت دلوقتي (عشان نعرضها للاعب).
 */
export function checkAchievements(): Achievement[] {
  const s = read();
  const fresh: Achievement[] = [];
  // ترقية بيانات اللاعبين الحاليين: لو الإنجاز مفتوح من إصدار قديم، امنح لقبه
  // الحصري الجديد من غير إعادة مكافأة الجنيه.
  for (const id of s.unlocked) {
    const old = getAchievement(id);
    if (old?.title && !readWallet().ownedTitles.includes(old.title)) {
      try { grantTitle(old.title); } catch { /* اتجاهل */ }
    }
  }
  for (const a of ACHIEVEMENTS) {
    if (s.unlocked.includes(a.id)) continue;
    let p: { now: number; goal: number };
    try { p = a.progress(); } catch { continue; }
    if (p.now >= p.goal) {
      s.unlocked.push(a.id);
      fresh.push(a);
    }
  }
  if (fresh.length > 0) {
    write(s);
    for (const a of fresh) {
      try {
        earn(a.coins);
        if (a.title && !readWallet().ownedTitles.includes(a.title)) grantTitle(a.title);
      } catch { /* اتجاهل */ }
    }
    // حدث موحّد: أي شاشة (قاموس/أونلاين/فردي) تفتح إنجازًا، App يعرض الإشعار.
    try { window.dispatchEvent(new CustomEvent(ACH_UNLOCK_EVENT, { detail: fresh })); } catch { /* اتجاهل */ }
  }
  return fresh;
}

/** هوك يتابع الإنجازات */
export function useAchievements() {
  const [ids, setIds] = useState<AchId[]>(() => unlockedIds());
  useEffect(() => {
    const h = () => setIds(unlockedIds());
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, []);
  return {
    unlocked: ids,
    total: ACHIEVEMENTS.length,
    list: ACHIEVEMENTS.map((a) => ({ ...a, done: ids.includes(a.id) })),
  };
}
