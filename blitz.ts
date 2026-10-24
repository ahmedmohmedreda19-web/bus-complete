/* ===== تحدي الخمس ثواني: سؤال سريع كل ٥ ثواني ===== */

import { CATS, ELIGIBLE_LETTERS, countWordsFor, type CatKey } from "../data/lexicon";

export const BLITZ_MS = 5_000;      // مهلة السؤال
export const BLITZ_LIVES = 3;       // عدد الأرواح في الفردي
export const BLITZ_GAP_MS = 1_400;  // راحة بين الأسئلة

export interface BlitzQuestion {
  cat: CatKey;
  label: string;
  color: string;
  letter: string;
  round: number;
}

/** سؤال عشوائي مضمون إن القاموس فيه إجابات ليه */
export function makeQuestion(round: number, prev?: BlitzQuestion): BlitzQuestion {
  for (let i = 0; i < 60; i++) {
    const c = CATS[Math.floor(Math.random() * CATS.length)];
    const l = ELIGIBLE_LETTERS[Math.floor(Math.random() * ELIGIBLE_LETTERS.length)];
    if (countWordsFor(c.key, l) < 6) continue;
    if (prev && prev.cat === c.key && prev.letter === l) continue;
    return { cat: c.key, label: c.label, color: c.color, letter: l, round };
  }
  const c = CATS[0];
  return { cat: c.key, label: c.label, color: c.color, letter: ELIGIBLE_LETTERS[0], round };
}

/** نقاط السؤال: أسرع = أكتر (١٠ لأقصى سرعة، ٤ كحد أدنى) */
export function blitzPoints(msLeft: number): number {
  const ratio = Math.max(0, Math.min(1, msLeft / BLITZ_MS));
  return 4 + Math.round(ratio * 6);
}

/** صف اللاعب في التحدي */
export interface BlitzRow {
  id: string;
  name: string;
  avatar?: string;
  alive: boolean;
  score: number;
  streak: number;
  answered: boolean;
  lastWord?: string;
  lastOk?: boolean;
}
