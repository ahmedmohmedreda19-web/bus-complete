// @vitest-environment jsdom
import { expect, it, beforeEach } from "vitest";
import { readWallet, earnGems, buyTitle, buySkin, claimGemMilestone } from "./wallet";
import { TITLES, SKINS } from "../data/shop";

beforeEach(() => localStorage.clear());

it("الجواهر تُكسب بعثرة فعلًا وتبقى محدودة", () => {
  const before = readWallet().gems;
  expect(before).toBe(0);
  // جولة كاملة: منح جوهرة واحدة
  earnGems(1);
  expect(readWallet().gems).toBe(1);
  // ممنوع إعادة منح نفس مستوى السلسلة تواً
  expect(claimGemMilestone(7)).toBe(true);
  expect(claimGemMilestone(7)).toBe(false); // لا يتكرر
  earnGems(3);
  expect(readWallet().gems).toBeGreaterThanOrEqual(4);
});

it("الشتري بالجواهر بيحسم الجواهر مش الجنيه", () => {
  // نجهّز جواهر كافية للعنصرين
  const gemTitle = TITLES.find(t => (t.gemPrice ?? 0) > 0)!;
  const gemSkin = SKINS.find(s => (s.gemPrice ?? 0) > 0)!;
  earnGems((gemTitle.gemPrice ?? 0) + (gemSkin.gemPrice ?? 0));
  const coinsBefore = readWallet().coins;
  
  // شراء اللقب الجوهري
  const t1 = buyTitle(gemTitle.id);
  expect(t1).toBe(true);
  expect(readWallet().coins).toBe(coinsBefore); // الجنيه ما اتنقصش
  
  // شراء السكن الجوهري
  const t2 = buySkin(gemSkin.id);
  expect(t2).toBe(true);
  expect(readWallet().ownedSkins).toContain(gemSkin.id);
});

it("مش بتقدر تشتري جلقب جوهري من غير جواهر كافية", () => {
  const gemTitle = TITLES.find(t => (t.gemPrice ?? 0) > 0)!;
  // صفر جواهر
  expect(readWallet().gems).toBe(0);
  const result = buyTitle(gemTitle.id);
  expect(result).toBe(false);
  expect(readWallet().ownedTitles).not.toContain(gemTitle.id);
});
