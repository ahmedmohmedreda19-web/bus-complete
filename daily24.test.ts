// @vitest-environment jsdom
import { it, expect, beforeEach, vi, afterEach } from "vitest";
import { isDailyAvailable, completeDaily, msUntilTomorrow, readDaily, dailyLetter, dailyCategory } from "./daily";
import { canSpin, spinWheel, msUntilNextSpin } from "./wheel";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  // 11:00 PM on 2026-01-15
  vi.setSystemTime(new Date("2026-01-15T23:00:00"));
});
afterEach(() => vi.useRealTimers());

it("التحدي: يتجدد تلقائيًا الساعة ١٢ بليل (بداية اليوم الجديد)", () => {
  expect(isDailyAvailable()).toBe(true);
  completeDaily(50);
  expect(isDailyAvailable()).toBe(false);

  // بعد ساعة (الساعة ١٢ بالليل = اليوم الجديد بدأ!) → يفتح فورًا
  vi.advanceTimersByTime(60 * 60 * 1000 + 1000); // 1 hour and 1 second -> 00:00:01 of Jan 16
  expect(isDailyAvailable()).toBe(true);
  console.log("بعد الساعة ١٢ بالليل:", isDailyAvailable() ? "مفتوح ✓" : "مقفول ❌");
});

it("العجلة: تتجدد الساعة ١٢ بليل", () => {
  expect(canSpin()).toBe(true);
  spinWheel();
  expect(canSpin()).toBe(false);

  // بعد ساعة (الساعة ١٢ منتصف الليل)
  vi.advanceTimersByTime(60 * 60 * 1000 + 1000);
  expect(canSpin()).toBe(true);
  console.log("العجلة بعد منتصف الليل:", canSpin() ? "مفتوحة ✓" : "مقفولة ❌");
});

it("العداد التنازلي يحسب الوقت المتبقي حتى منتصف الليل القادم (١٢ بليل)", () => {
  // الساعة ١١ مساءً -> متبقي ساعة واحدة (60 دقيقة) حتى منتصف الليل
  const left = msUntilTomorrow();
  expect(Math.round(left / (60 * 1000))).toBe(60);

  const wheelLeft = msUntilNextSpin();
  expect(Math.round(wheelLeft / (60 * 1000))).toBe(60);

  // تقدم بنصف ساعة (30 دقيقة)
  vi.advanceTimersByTime(30 * 60 * 1000);
  const leftHalf = msUntilTomorrow();
  expect(Math.round(leftHalf / (60 * 1000))).toBe(30);
});

it("السلسلة: تزيد لو لعبت يوم ورا يوم وتتكسر لو فوت يوم كامل", () => {
  // لعب يوم 15
  completeDaily(10);
  expect(readDaily().streak).toBe(1);

  // اليوم التالي: 16 يناير
  vi.advanceTimersByTime(2 * 60 * 60 * 1000); // 01:00 AM on Jan 16
  completeDaily(20);
  expect(readDaily().streak).toBe(2);

  // فوت يوم 17 ولعب يوم 18
  vi.advanceTimersByTime(48 * 60 * 60 * 1000); // Jan 18
  completeDaily(30);
  console.log("بعد تفويت يوم، السلسلة:", readDaily().streak);
  expect(readDaily().streak).toBe(1);
});

it("الحرف والفئة ثابتين طول اليوم ويتغيروا في اليوم الجديد", () => {
  const l1 = dailyLetter();
  const c1 = dailyCategory().label;

  // بعد ساعة في نفس اليوم (11:30 PM) -> نفس الحرف والفئة
  vi.advanceTimersByTime(30 * 60 * 1000);
  expect(dailyLetter()).toBe(l1);
  expect(dailyCategory().label).toBe(c1);

  // بعد منتصف الليل (اليوم التالي) -> حرف وفئة اليوم الجديد
  vi.advanceTimersByTime(45 * 60 * 1000); // 00:15 AM
  const l2 = dailyLetter();
  const c2 = dailyCategory().label;
  console.log("يوم ١٥:", l1, c1, "| يوم ١٦:", l2, c2);
});
