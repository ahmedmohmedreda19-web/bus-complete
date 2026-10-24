/* ===== أنواع وصلة الحروف أونلاين (نظام الأدوار) ===== */

export const CHAIN_TURN_MS = 15_000;   // وقت الدور
export const CHAIN_MIN_MS = 7_000;     // أقل وقت
export const CHAIN_STEP_MS = 500;      // بيقل كل دورة كاملة
export const CHAIN_LIVES = 1;          // روح واحدة: أول غلطة أو وقت = خروج فوري

export interface ChainPlayer {
  id: string;
  name: string;
  avatar?: string;
  alive: boolean;
  lives: number;
  score: number;
  words: number;
}

export interface ChainState {
  letter: string;          // الحرف المطلوب دلوقتي
  lastWord: string;        // آخر كلمة اتقالت
  lastBy: string;          // مين قالها
  turnId: string;          // دور مين دلوقتي
  deadline: number;        // نهاية الدور
  turnMs: number;          // مدة الدور الحالية
  players: ChainPlayer[];
  history: { word: string; by: string }[];
  round: number;
  over: boolean;
}
