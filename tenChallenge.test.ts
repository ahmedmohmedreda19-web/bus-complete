// @vitest-environment jsdom
import { it, expect } from "vitest";
import { pickTenChallenge, TEN_GOAL } from "./TenChallenge";
import { countWordsFor, countWordsForLetter, ELIGIBLE_LETTERS, CATS } from "../data/lexicon";

it("تحدي العشر كلمات دايمًا قابل للحل", () => {
  for (let i = 0; i < 40; i++) {
    const c = pickTenChallenge();
    expect(c.available).toBeGreaterThanOrEqual(TEN_GOAL);
    expect(countWordsFor(c.cat, c.letter)).toBe(c.available);
  }
  const sample = pickTenChallenge();
  console.log("مثال:", sample.label, "بحرف", sample.letter, "| متاح:", sample.available);
});

it("عدّاد الكلمات لكل حرف صحيح", () => {
  for (const l of ELIGIBLE_LETTERS.slice(0, 5)) {
    const sum = CATS.reduce((n, c) => n + countWordsFor(c.key, l), 0);
    expect(countWordsForLetter(l)).toBe(sum);
  }
  const top = ELIGIBLE_LETTERS
    .map((l) => ({ l, n: countWordsForLetter(l) }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);
  console.log("أغنى الحروف:", top.map((t) => `${t.l}=${t.n}`).join(" "));
  expect(top[0].n).toBeGreaterThan(20);
});
