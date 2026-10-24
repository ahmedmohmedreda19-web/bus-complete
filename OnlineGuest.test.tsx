// @vitest-environment jsdom
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act, cleanup, screen } from "@testing-library/react";

// ===== محاكاة طبقة الشبكة بالكامل =====
let handlers: import("../net/online").RoomHandlers;
let sentJoins: string[] = [];

vi.mock("../net/online", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../net/online")>();
  return {
    ...orig,
    joinRoom: (_code: string, name: string, h: import("../net/online").RoomHandlers) => {
      handlers = h;
      sentJoins.push(name);
      const room = {
        myId: "guest-1",
        hostId: "buscomplete-room-AAAAA",
        destroy: () => {},
        sendLock: () => {},
        sendStop: () => {},
      };
      // بعد شوية: المضيف يرد بhello
      setTimeout(() => {
        h.onPlayers?.([
          { id: "buscomplete-room-AAAAA", name: "المضيف", title: "", connected: true, count: 0 },
          { id: "guest-1", name, connected: true, count: 0 },
        ]);
      }, 10);
      return room;
    },
    createRoom: () => { throw new Error("مش المفروض"); },
  };
});

import Online from "./Online";
import type { NetResults } from "../net/online";
import { CATS, judge } from "../data/lexicon";
import { loadStats } from "../lib/storage";

beforeEach(() => { cleanup(); localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

function buildResults(): NetResults {
  const answers = Object.fromEntries(CATS.map((c) => [c.key, null])) as NetResults["rows"][0]["answers"];
  answers.boy = { text: "محمد", verdict: judge("boy", "محمد", "م") };
  return {
    letter: "م", round: 1,
    rows: [
      { id: "guest-1", name: "ضيف", connected: true, stopped: true, roundPts: 10, bonus: 30, total: 40, answers },
      { id: "buscomplete-room-AAAAA", name: "المضيف", connected: true, stopped: false, roundPts: 30, bonus: 0, total: 30, answers },
    ],
  };
}

it("رحلة الضيف كاملة: دخول → لعب → مراجعة → نتايج", () => {
  const errors: string[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => { errors.push(String(a[0]).slice(0, 300)); };

  render(<Online initialName="ضيف" muted onToggleMute={() => {}} onNameUsed={() => {}} onExit={() => {}} />);

  // كتابة الكود والانضمام
  const codeInput = document.querySelector("input[placeholder='ABCDE']") as HTMLInputElement;
  fireEvent.change(codeInput, { target: { value: "AAAAA" } });
  const joinBtn = screen.getAllByRole("button").find((b) => b.textContent?.includes("ادخل"))!;
  fireEvent.click(joinBtn);
  act(() => { vi.advanceTimersByTime(50); });

  console.log("after join:", document.body.textContent?.includes("المضيف") || document.body.textContent?.includes("الركّابة"));

  // المضيف يبدأ الجولة
  act(() => { handlers.onStart?.("م", 1); });
  act(() => { vi.advanceTimersByTime(100); });
  const inputs = Array.from(document.querySelectorAll("form input")) as HTMLInputElement[];
  console.log("in play? inputs:", inputs.length);

  // كتابة واعتماد إجابة مثل المستخدم الحقيقي
  if (inputs.length) {
    fireEvent.change(inputs[0], { target: { value: "محمد" } });
    fireEvent.submit(inputs[0].closest("form")!);
    act(() => { vi.advanceTimersByTime(900); });
  }
  console.log("after ENTER ok:", document.body.textContent!.length > 100);

  // عدّاد المتحكم المضيف
  for (let t = 70000; t > 1000; t -= 10000) act(() => { handlers.onTick?.(t); });
  console.log("ticks ok:", document.body.textContent!.length > 100);

  // وقت انتهاء → مرحلة المراجعة
  act(() => { handlers.onTick?.(0); });
  act(() => { handlers.onReviewing?.(); });
  act(() => { vi.advanceTimersByTime(300); });
  console.log("reviewing screen:", document.body.textContent?.includes("المضيف بيصحّح"));

  // بث النتائج
  act(() => { handlers.onResults?.(buildResults()); });
  act(() => { vi.advanceTimersByTime(300); });
  console.log("results screen:", document.body.textContent?.includes("نتايج الجولة"), "| len:", document.body.textContent?.length);
  expect(loadStats().games).toBe(1);
  // إعادة نفس الرسالة بعد reconnect ما تزودش الإحصائيات أو الجنيه مرتين.
  act(() => { handlers.onResults?.(buildResults()); });
  expect(loadStats().games).toBe(1);

  // ===== الجولة التانية =====
  act(() => { handlers.onStart?.("ب", 2); });
  act(() => { vi.advanceTimersByTime(200); });
  const inputs2 = Array.from(document.querySelectorAll("form input")) as HTMLInputElement[];
  console.log("round2 inputs:", inputs2.length);
  if (inputs2.length) {
    fireEvent.change(inputs2[0], { target: { value: "باسل" } });
    fireEvent.submit(inputs2[0].closest("form")!);
    act(() => { vi.advanceTimersByTime(900); });
    console.log("round2 ENTER ok:", document.body.textContent!.length > 100, "| b:", document.body.textContent?.includes("باسل"));
  }
  // تقدم اللاعبين التانيين + عد الجولة
  act(() => { handlers.onProgress?.("buscomplete-room-AAAAA", 5); });
  act(() => { handlers.onTick?.(60000); });
  console.log("round2 ticks ok:", document.body.textContent!.length > 100);

  console.log("REACT ERRORS:", errors.slice(0, 3));
  console.error = orig;
  expect(errors.length).toBe(0);
});
