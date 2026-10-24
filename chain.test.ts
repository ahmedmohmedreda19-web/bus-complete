// @vitest-environment jsdom
import { it, expect } from "vitest";
import { judgeChain, lastLetterOf, anyWordStartingWith, countAnyStartingWith, ELIGIBLE_LETTERS } from "../data/lexicon";
import { normalizeArabic } from "./arabic";

it("المثال المطلوب: أحمد ← دولاب ← برتقال ← ليمون", () => {
  const chain = ["احمد", "دولاب", "برتقال", "ليمون"];
  let need = "ا";
  for (const w of chain) {
    const v: any = judgeChain(w, need);
    expect(v.t).not.toBe("bad");
    need = lastLetterOf(w);
  }
  expect(need).toBe("ن");
});

it("السلسلة تقدر تكمل ٣٠ خطوة من غير ما تقف", () => {
  const used = new Set<string>();
  let letter = "م";
  let steps = 0;
  for (let i = 0; i < 30; i++) {
    const w = anyWordStartingWith(letter, used);
    if (!w) break;
    used.add(normalizeArabic(w));
    const next = lastLetterOf(w);
    // لو الحرف الجاي مسدود، اللعبة بتلف لحرف تاني (زي الكود)
    letter = countAnyStartingWith(next, used) >= 2 && ELIGIBLE_LETTERS.includes(next) ? next : "ا";
    steps++;
  }
  console.log("عدد الخطوات:", steps);
  expect(steps).toBe(30);
});

it("الكلمة اللي مش موجودة بترفض", () => {
  expect(judgeChain("زقفثهخ", "ز").t).toBe("bad");
});

it("الحرف الغلط بيترفض", () => {
  const v: any = judgeChain("محمد", "ب");
  expect(v.t).toBe("bad");
  expect(v.reason).toBe("letter");
});

it("أي فئة تنفع في السلسلة", () => {
  // كلها بحرف م من فئات مختلفة
  expect(judgeChain("محمد", "م").t).toBe("exact");   // ولد
  expect(judgeChain("مفتاح", "م").t).toBe("exact");  // جماد
  expect(judgeChain("موز", "م").t).toBe("exact");    // نبات
});
