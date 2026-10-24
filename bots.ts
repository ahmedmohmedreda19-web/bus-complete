/* ===== بوتات المنافسة في الوضع الفردي ===== */

import { CATS, judge, suggest, type CatKey, type Verdict } from "../data/lexicon";

export interface BotAnswer {
  text: string;
  verdict: Verdict | null;
}

export interface BotResult {
  id: string;
  name: string;
  title: string;
  isBot: true;
  stopped: boolean;
  roundPts: number;
  bonus: number;
  total: number;
  answers: Record<CatKey, BotAnswer | null>;
}

interface PlannedAnswer {
  cat: CatKey;
  at: number; // وقت القفل بالمللي ثانية من بداية الجولة
  word: string;
  verdict: Verdict | null;
}

const BOT_NAMES = ["نور", "سما", "آدم", "لينا", "مريم", "يوسف", "هدى", "زياد", "جنى", "عمر", "رامي", "هند", "شهد", "كريم"];
const BOT_TITLES = ["كمسري محترف", "نابغة الكلمات", "سوّاق متدرّب", "رئيس محطة"];

export class BotSim {
  id = `bot-${Math.random().toString(36).slice(2, 9)}`;
  name: string;
  title: string;
  private initialPlan: PlannedAnswer[] = [];
  private plan: PlannedAnswer[] = [];
  private done: PlannedAnswer[] = [];
  stopped = false;
  private stopRemMs = 0;

  constructor(letter: string, name: string, title: string, skill: number) {
    this.name = name;
    this.title = title;
    // بناء خطة الإجابات: البوت بيجاوب نسبة من الفئات حسب مهارته
    let t = 1500 + Math.random() * 3500;
    for (const c of CATS) {
      if (Math.random() >= skill) continue; // هيسيب الفئة دي فاضية زي البشر
      let word = suggest(c.key, letter);
      if (!word) continue;
      let verdict: Verdict | null;
      if (word.length >= 4 && Math.random() < 0.14) {
        // غلطة إملائية متعمدة → القاموس بيصلحها ويديله ٨
        word = this.typo(word);
        const v = judge(c.key, word, letter);
        if (v.t === "bad") continue;
        verdict = v;
      } else {
        const v = judge(c.key, word, letter);
        if (v.t === "bad") continue;
        verdict = v;
      }
      this.initialPlan.push({ cat: c.key, at: t, word, verdict });
      t += 1200 + Math.random() * 3800;
    }
    this.plan = [...this.initialPlan];
  }

  private typo(w: string): string {
    const i = 1 + Math.floor(Math.random() * (w.length - 2));
    if (Math.random() < 0.5) return w.slice(0, i) + w[i - 1] + w.slice(i); // تكرار حرف
    return w.slice(0, i) + w.slice(i + 1); // حذف حرف
  }

  count(): number {
    return this.done.length;
  }

  /** تقدّم الزمن: قفل الإجابات اللي حان وقتها */
  advance(nowMs: number, roundMs: number) {
    while (this.plan.length && this.plan[0].at <= nowMs) {
      this.done.push(this.plan.shift()!);
    }
    // خلص كل إجاباته → وقّف الأتوبيس وخذ بونص السرعة
    if (!this.stopped && this.plan.length === 0 && this.done.length > 0) {
      this.stopped = true;
      this.stopRemMs = Math.max(0, roundMs - nowMs);
    }
  }

  reset() {
    this.plan = [...this.initialPlan];
    this.done = [];
    this.stopped = false;
    this.stopRemMs = 0;
  }

  result(): BotResult {
    const answers = {} as Record<CatKey, BotAnswer | null>;
    for (const c of CATS) answers[c.key] = null;
    let pts = 0;
    for (const d of this.done) {
      answers[d.cat] = { text: d.word, verdict: d.verdict };
      if (d.verdict && d.verdict.t !== "bad") pts += d.verdict.pts;
    }
    const bonus = this.stopped && this.done.length === CATS.length ? Math.ceil(this.stopRemMs / 1000) : 0;
    return {
      id: this.id, name: this.name, title: this.title, isBot: true as const,
      stopped: this.stopped, roundPts: pts, bonus, total: pts + bonus, answers,
    };
  }
}

/** توليد فريق البوتات لحرف الجولة */
export function createBots(letter: string, count = 3): BotSim[] {
  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  const bots: BotSim[] = [];
  for (let i = 0; i < count; i++) {
    const skill = 0.55 + Math.random() * 0.35; // 55% - 90% من الفئات
    const title = BOT_TITLES[Math.floor(Math.random() * BOT_TITLES.length)];
    bots.push(new BotSim(letter, names[i], title, skill));
  }
  return bots;
}
