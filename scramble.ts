/* ===== لعبة الحروف المتلغبطة: حروف مبعثرة وطلّع منها كلمات ===== */

import { CATS, countSolutions, countAllSolutions, solutionsFor, allSolutionsFor, type CatKey } from "../data/lexicon";
import { normalizeArabic } from "./arabic";

export const SCRAMBLE_MS = 60_000; // مدة الجولة

/** حروف شائعة تكوّن كلمات كتير */
const CORE = ["ا", "ل", "م", "ر", "ب", "س", "ن", "ح", "د", "ك", "ت", "ع", "ف", "ش", "ج", "ق", "ز", "و", "ي", "ه"];

export type ScrambleMode = "category" | "any";

export interface ScrambleRound {
  mode: ScrambleMode;                   // محدد بفئة أو مفتوح لأي كلمة
  pool: string[];                       // الحروف المتاحة (مبعثرة)
  cat: CatKey | null;                   // الفئة المطلوبة (أو null لو مفتوحة)
  label: string;                        // اسم التحدي
  subLabel: string;                     // وصف إضافي
  color: string;
  goal: number;                         // كم كلمة مطلوبة
  available: number;                    // عدد الحلول الممكنة
  samples: string[];                    // أمثلة (تُعرض في النهاية)
}

/** توليد جولة: إما فئة معينة (ولد/بنت/جماد...) أو كلمات مفتوحة من أي فئة */
export function makeScramble(poolSize = 9): ScrambleRound {
  // 50% فئة محددة، 50% مفتوح لأي فئة
  const chooseAny = Math.random() < 0.5;

  let best: ScrambleRound | null = null;

  for (let attempt = 0; attempt < 40; attempt++) {
    // حروف عشوائية من الشائعة + تكرار الألف واللام
    const pool: string[] = [];
    const bag = [...CORE].sort(() => Math.random() - 0.5);
    pool.push("ا", "ل");
    for (const ch of bag) {
      if (pool.length >= poolSize) break;
      if (pool.filter((p) => p === ch).length >= 2) continue;
      pool.push(ch);
    }
    if (Math.random() < 0.5 && pool.length < poolSize + 1) pool.push("ا");

    if (chooseAny) {
      const totalAvailable = countAllSolutions(pool);
      if (totalAvailable < 10) continue;
      const goal = totalAvailable >= 20 ? 6 : 5;
      const round: ScrambleRound = {
        mode: "any",
        pool: [...pool].sort(() => Math.random() - 0.5),
        cat: null,
        label: "أي كلمات أو أسماء",
        subLabel: "ولد، بنت، جماد، أكلة، بلاد… أي حاجة تنفع!",
        color: "#c084fc", // بنفسجي فاتح
        goal,
        available: totalAvailable,
        samples: [],
      };
      if (!best || round.available > best.available) best = round;
      if (round.available >= 25) break;
    } else {
      const counts = countSolutions(pool);
      const good = CATS.filter((c) => counts[c.key] >= 8);
      if (good.length === 0) continue;
      const cat = good[Math.floor(Math.random() * good.length)];
      const avail = counts[cat.key];
      const goal = avail >= 12 ? 5 : 4;
      const round: ScrambleRound = {
        mode: "category",
        pool: [...pool].sort(() => Math.random() - 0.5),
        cat: cat.key,
        label: cat.label,
        subLabel: `كل الكلمات لازم تكون «${cat.label}»`,
        color: cat.color,
        goal,
        available: avail,
        samples: [],
      };
      if (!best || round.available > best.available) best = round;
      if (round.available >= 14) break;
    }
  }

  if (!best) {
    // احتياطي مضمون
    const pool = ["ا", "ل", "م", "ح", "د", "ر", "ب", "س", "ن"];
    if (chooseAny) {
      const totalAvail = countAllSolutions(pool);
      best = {
        mode: "any",
        pool,
        cat: null,
        label: "أي كلمات أو أسماء",
        subLabel: "ولد، بنت، جماد، أكلة، بلاد… أي حاجة تنفع!",
        color: "#c084fc",
        goal: 5,
        available: totalAvail,
        samples: [],
      };
    } else {
      const counts = countSolutions(pool);
      const cat = CATS.reduce((a, b) => (counts[a.key] >= counts[b.key] ? a : b));
      best = {
        mode: "category",
        pool,
        cat: cat.key,
        label: cat.label,
        subLabel: `كل الكلمات لازم تكون «${cat.label}»`,
        color: cat.color,
        goal: 4,
        available: counts[cat.key],
        samples: [],
      };
    }
  }

  if (best.cat) {
    best.samples = solutionsFor(best.pool, 14)[best.cat] ?? [];
  } else {
    best.samples = allSolutionsFor(best.pool, 16);
  }

  return best;
}

/** خلط ترتيب الحروف المعروضة */
export function reshuffle(pool: string[]): string[] {
  return [...pool].sort(() => Math.random() - 0.5);
}

/** مقارنة كلمتين بعد التوحيد */
export function sameWord(a: string, b: string): boolean {
  return normalizeArabic(a) === normalizeArabic(b);
}
