// @vitest-environment jsdom
import { it, expect } from "vitest";
import { makeQuestion, blitzPoints, BLITZ_MS } from "./blitz";
import { countWordsFor, judge } from "../data/lexicon";

it("كل سؤال ليه إجابات في القاموس", () => {
  let prev;
  for (let i = 1; i <= 60; i++) {
    const q = makeQuestion(i, prev);
    expect(countWordsFor(q.cat, q.letter)).toBeGreaterThanOrEqual(6);
    if (prev) expect(`${q.cat}|${q.letter}`).not.toBe(`${prev.cat}|${prev.letter}`);
    prev = q;
  }
  const s = makeQuestion(1);
  console.log("مثال:", s.label, "بحرف", s.letter, "| متاح:", countWordsFor(s.cat, s.letter));
});

it("النقاط بتقل مع بطء الإجابة", () => {
  const fast = blitzPoints(BLITZ_MS);
  const mid = blitzPoints(BLITZ_MS / 2);
  const slow = blitzPoints(200);
  console.log("سريع:", fast, "| نص:", mid, "| بطيء:", slow);
  expect(fast).toBe(10);
  expect(mid).toBeLessThan(fast);
  expect(slow).toBeGreaterThanOrEqual(4);
});

it("الحكم على إجابة السؤال شغال", () => {
  const q = { cat: "boy" as const, letter: "م" };
  expect(judge(q.cat, "محمد", q.letter).t).toBe("exact");
  expect(judge(q.cat, "سعيد", q.letter).t).toBe("bad");
});
