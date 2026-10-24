// @vitest-environment jsdom
import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import LuckyWheel from "./LuckyWheel";
import { canSpin, spinWheel, readWheel } from "../lib/wheel";

beforeEach(() => { cleanup(); localStorage.clear(); vi.useFakeTimers({ shouldAdvanceTime: false }); });
afterEach(() => { vi.useRealTimers(); });

it("العجلة الجديدة – اللفة متاحة وبتلف وتُظهر الجايزة", () => {
  // تأكد إن اللفة متاحة قبل فتح الشاشة
  expect(canSpin()).toBe(true);

  render(<LuckyWheel onClose={() => {}} />);

  // نتأكد إن فيه زرار لف
  const spinBtn = screen.getAllByRole("button").find((b) => b.textContent?.includes("لِف")) as HTMLButtonElement | undefined;
  expect(spinBtn).toBeTruthy();
  expect(spinBtn?.disabled).toBe(false);

  // محاكاة الضغط
  fireEvent.click(spinBtn!);

  // لازم تغيّر حالة spinning
  expect(screen.getByText(/بتلف/)).toBeTruthy();

  // نتقدم بالوقت الكامل للدوران (4.2 ثانية + tick)
  vi.advanceTimersByTime(4600);

  // لازم يظهر نتيجة
  const bodyText = document.body.textContent ?? "";
  expect(bodyText.includes("٢٥ جنيه") || bodyText.includes("تلميح") || bodyText.includes("٦٠ جنيه") || bodyText.includes("وقود وقت")
    || bodyText.includes("١٢٠ جنيه") || bodyText.includes("٢ تلميح") || bodyText.includes("سكن") || bodyText.includes("الجاكبوت")).toBe(true);

  // وبعد ما خلصت، اللفة لليوم اتقفلت
  expect(canSpin()).toBe(false);
  expect(readWheel().spins).toBe(1);
});

it("اللفة تتجدد يوميًا عند منتصف الليل", () => {
  // لعب النهارده
  const r1 = spinWheel();
  expect(r1).toBeTruthy();
  expect(canSpin()).toBe(false);

  // عدّ وقت لمنتصف الليل (بداية اليوم الجديد)
  vi.setSystemTime(new Date(Date.now() + 24 * 60 * 60 * 1000));
  expect(canSpin()).toBe(true);
});
