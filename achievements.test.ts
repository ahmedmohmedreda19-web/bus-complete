// @vitest-environment jsdom
import { it, expect, beforeEach } from "vitest";
import { checkAchievements, isFlawlessRound, isPerfectRound, noteRound, noteLike, unlockedIds, ACHIEVEMENTS } from "./achievements";
import { bumpStats } from "./storage";
import { readWallet } from "./wallet";

beforeEach(() => { localStorage.clear(); });

it("إنجاز أول ١٠٠ نقطة بيتفتح ويدي جنيه", () => {
  expect(unlockedIds()).toHaveLength(0);
  bumpStats({ score: 120, words: 9, won: false });
  const fresh = checkAchievements();
  const ids = fresh.map((a) => a.id);
  console.log("اتفتح:", ids);
  expect(ids).toContain("first100");
  expect(unlockedIds()).toContain("first100");
  // مايتكررش
  expect(checkAchievements().map((a) => a.id)).not.toContain("first100");
});

it("سلسلة ٥ جولات بدون غلطة + منح اللقب", () => {
  for (let i = 0; i < 5; i++) noteRound({ flawless: true, perfect: false });
  const fresh = checkAchievements();
  const ids = fresh.map((a) => a.id);
  console.log("سلسلة:", ids);
  expect(ids).toContain("flawless5");
  // اللقب الحصري اتمنح
  console.log("ألقابي:", readWallet().ownedTitles);
  expect(readWallet().ownedTitles).toContain("ach_marksman");
});

it("الغلطة بتكسر السلسلة", () => {
  noteRound({ flawless: true, perfect: false });
  noteRound({ flawless: true, perfect: false });
  noteRound({ flawless: false, perfect: false });
  const p = ACHIEVEMENTS.find((a) => a.id === "flawless5")!.progress();
  console.log("بعد الكسر:", p);
  expect(p.now).toBe(0);
});

it("الفوز الأونلاين والإعجابات", () => {
  noteRound({ flawless: false, perfect: false, onlineWin: true });
  expect(checkAchievements().map((a) => a.id)).toContain("onlineWin");
  for (let i = 0; i < 5; i++) noteLike();
  expect(checkAchievements().map((a) => a.id)).toContain("socialLike");
});

it("الجنيه بتتجمع من الإنجازات", () => {
  const before = readWallet().coins;
  bumpStats({ score: 250, words: 9, won: true });
  const fresh = checkAchievements();
  const expected = fresh.reduce((s, a) => s + a.coins, 0);
  console.log("إنجازات:", fresh.length, "| جنيه مكتسبة:", expected);
  expect(readWallet().coins).toBe(before + expected);
});

it("التحدي اليومي بسؤال واحد لا يفتح إنجاز التسع فئات", () => {
  expect(isPerfectRound(1, 1)).toBe(false);
  expect(isPerfectRound(9, 9)).toBe(true);
});

it("الجولة النظيفة لازم يكون فيها ٥ إجابات على الأقل", () => {
  expect(isFlawlessRound(1, 1)).toBe(false);
  expect(isFlawlessRound(5, 5)).toBe(true);
  expect(isFlawlessRound(6, 5)).toBe(false);
});

it("إنجاز المدفع هدفه قابل للتحقيق: ١٥٠ نقطة", () => {
  const cannon = ACHIEVEMENTS.find((a) => a.id === "score200")!;
  expect(cannon.progress().goal).toBe(150);
  bumpStats({ score: 150, words: 9, won: true });
  expect(checkAchievements().map((a) => a.id)).toContain("score200");
});
