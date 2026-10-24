// @vitest-environment jsdom
import { it, expect } from "vitest";
import { makeScramble } from "./scramble";
import { judgeScramble, solutionsFor, allSolutionsFor, canBuildFrom } from "../data/lexicon";

it("كل جولة فيها حلول أكتر من الهدف سواء كانت فئة محددة أو مفتوحة", () => {
  let sawCategory = false;
  let sawAny = false;

  for (let i = 0; i < 40; i++) {
    const r = makeScramble();
    expect(r.available).toBeGreaterThanOrEqual(r.goal);
    expect(r.pool.length).toBeGreaterThanOrEqual(8);
    if (r.mode === "category") sawCategory = true;
    if (r.mode === "any") sawAny = true;
  }
  expect(sawCategory).toBe(true);
  expect(sawAny).toBe(true);
  const s = makeScramble();
  console.log("مثال:", s.label, `(${s.mode})`, "|", s.pool.join(" "), "| هدف:", s.goal, "| حلول:", s.available);
});

it("الحلول المقترحة بتعدي الحكم فعلاً", () => {
  for (let i = 0; i < 15; i++) {
    const r = makeScramble();
    const sols = r.cat ? (solutionsFor(r.pool, 5)[r.cat] ?? []) : allSolutionsFor(r.pool, 5);
    expect(sols.length).toBeGreaterThan(0);
    for (const w of sols) {
      const v = judgeScramble(r.cat, w, r.pool);
      expect(v.t).toBe("exact");
    }
  }
});

it("الوضع المفتوح (cat = null) يقبل أي كلمة في القاموس من الحروف المتاحة", () => {
  const pool = ["ا", "ل", "م", "ح", "د", "ر", "ب", "س", "ن", "ي"];
  // ولد
  expect(judgeScramble(null, "احمد", pool).t).toBe("exact");
  // جماد
  expect(judgeScramble(null, "حبل", pool).t).toBe("exact");
  // أكلة
  expect(judgeScramble(null, "بلح", pool).t).toBe("exact");
  // مش كلمة في القاموس
  expect(judgeScramble(null, "دحلمس", pool).t).toBe("bad");
});

it("الكلمة اللي حروفها مش متاحة بترفض", () => {
  const pool = ["ا", "ل", "م", "ح", "د"];
  expect(canBuildFrom("احمد", pool)).toBe(true);
  expect(canBuildFrom("محمد", pool)).toBe(false); // ميمين والمتاح ميم واحدة
  const v: any = judgeScramble("boy", "محمد", pool);
  expect(v.t).toBe("bad");
  expect(v.reason).toBe("letter");
});

it("الكلمة الصح من الفئة الغلط بترفض في وضع الفئة فقط", () => {
  const pool = ["ا", "ل", "م", "ح", "د", "ر", "ب", "س", "ن"];
  // احمد اسم ولد مش أكلة
  expect(judgeScramble("food", "احمد", pool).t).toBe("bad");
  // لكن في الوضع المفتوح بتتقبل
  expect(judgeScramble(null, "احمد", pool).t).toBe("exact");
});

it("عدد الحروف مضاعف بيسمح بتكرار الحرف", () => {
  expect(canBuildFrom("امال", ["ا", "م", "ا", "ل"])).toBe(true);
  expect(canBuildFrom("امال", ["ا", "م", "ل"])).toBe(false);
});
