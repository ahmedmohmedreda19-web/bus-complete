// @vitest-environment jsdom
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, fireEvent, cleanup } from "@testing-library/react";
import ChainGame from "./ChainGame";

beforeEach(() => { cleanup(); localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it("روح واحدة: أول وقت بيخلص = خسارة فورية ونهاية الدور", () => {
  render(<ChainGame onExit={() => {}} />);
  // مستنيين الوقت يعدي كله (١٢ ثانية)
  for (let i = 0; i < 30; i++) act(() => { vi.advanceTimersByTime(1_000); });
  act(() => { vi.advanceTimersByTime(2_000); });
  const txt = document.body.textContent ?? "";
  console.log("خسر بعد الوقت؟", txt.includes("اتقطعت") || txt.includes("خلص الوقت"));
  console.log("شاشة النتيجة ظهرت؟", txt.includes("نقاطك") || txt.includes("طول السلسلة"));
  // مفيش استمرار — الدور خلص
  expect(txt.includes("نقاطك") || txt.includes("طول السلسلة")).toBe(true);
});

it("روح واحدة: غلطة واحدة = خسارة فورية", () => {
  render(<ChainGame onExit={() => {}} />);
  const input = document.querySelector("input") as HTMLInputElement;
  // كلمة غلط (حروف مش مفهومة)
  fireEvent.change(input, { target: { value: "زقفثخج" } });
  fireEvent.submit(input.closest("form")!);
  act(() => { vi.advanceTimersByTime(2_500); });
  const txt = document.body.textContent ?? "";
  console.log("خسر بعد الغلطة؟", txt.includes("اتقطعت"));
  expect(txt.includes("نقاطك") || txt.includes("طول السلسلة")).toBe(true);
});
