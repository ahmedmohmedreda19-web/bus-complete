// @vitest-environment jsdom
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act, cleanup, screen } from "@testing-library/react";

// ===== محاكاة غرفة المضيف =====
let handlers: import("../net/online").RoomHandlers;
let finalized: unknown = null;

vi.mock("../net/online", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../net/online")>();
  const fakeHost = {
    __fakeHost: true,
    myId: "host-1",
    destroy: () => {},
    startRound: () => { handlers.onStart?.("م", 1); },
    hostLock: () => {},
    hostStop: () => {},
    getReview: () => ({
      letter: "م", round: 1,
      rows: [
        {
          id: "guest-1", name: "ضيف", title: "", connected: true, stopped: true, stopBonus: 22,
          answers: Object.fromEntries(CATS.map((c) => [c.key, null])) as never,
        },
      ],
    }),
    finalizeReview: (o: unknown) => {
      finalized = o;
      const answers = Object.fromEntries(CATS.map((c) => [c.key, null])) as never;
      handlers.onResults?.({
        letter: "م", round: 1,
        rows: [
          { id: "guest-1", name: "ضيف", connected: true, stopped: true, roundPts: 12, bonus: 0, total: 12, answers },
          { id: "host-1", name: "أنا", connected: true, stopped: false, roundPts: 30, bonus: 0, total: 30, answers },
        ],
      });
    },
  };
  return {
    ...orig,
    createRoom: (name: string, h: import("../net/online").RoomHandlers) => {
      handlers = h;
      setTimeout(() => {
        h.onCode?.("AAAAA");
        h.onPlayers?.([
          { id: "host-1", name, connected: true, count: 0 },
          { id: "guest-1", name: "ضيف", connected: true, count: 1 },
        ]);
      }, 10);
      return fakeHost;
    },
    joinRoom: () => { throw new Error("مش المفروض"); },
    isHost: (r: unknown) => Boolean((r as { __fakeHost?: boolean })?.__fakeHost),
  };
});

import Online from "./Online";
import { CATS } from "../data/lexicon";

beforeEach(() => { cleanup(); localStorage.clear(); vi.useFakeTimers(); finalized = null; });
afterEach(() => { vi.useRealTimers(); });

it("رحلة المضيف: بدء → لعب → تصحيح → نتايج", () => {
  const errors: string[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => { errors.push(String(a[0]).slice(0, 400)); };

  render(<Online initialName="أنا" muted onToggleMute={() => {}} onNameUsed={() => {}} onExit={() => {}} />);

  // اعمل غرفة
  const createBtn = screen.getAllByRole("button").find((b) => b.textContent?.includes("اعمل غرفة"))!;
  fireEvent.click(createBtn);
  act(() => { vi.advanceTimersByTime(50); });
  console.log("lobby:", document.body.textContent?.includes("الركّابة"));

  // ابدأ
  const startBtn = screen.getAllByRole("button").find((b) => b.textContent?.includes("ابدأ"))!;
  fireEvent.click(startBtn);
  act(() => { vi.advanceTimersByTime(200); });
  console.log("in play:", document.querySelectorAll("form input").length);

  // المضيف يكتب ويعتمد
  const inputs = Array.from(document.querySelectorAll("form input")) as HTMLInputElement[];
  fireEvent.change(inputs[0], { target: { value: "محمد" } });
  fireEvent.submit(inputs[0].closest("form")!);
  act(() => { vi.advanceTimersByTime(800); });
  console.log("host lock ok:", document.body.textContent!.length > 100);

  // انتهاء الجولة → مراجعة
  act(() => { handlers.onTick?.(0); });
  act(() => { handlers.onReviewing?.(); });
  act(() => { vi.advanceTimersByTime(300); });
  console.log("review screen:", document.body.textContent?.includes("صحح زي الحكَم"));

  // عدّل إجابة (صح) ثم اعرض
  const yesBtns = screen.getAllByRole("button").filter((b) => b.getAttribute("aria-label") === "صح");
  console.log("yes btns:", yesBtns.length);
  if (yesBtns[0]) { fireEvent.click(yesBtns[0]); }
  const finalizeBtn = screen.getAllByRole("button").find((b) => b.textContent?.includes("اعرض النتايج"))!;
  fireEvent.click(finalizeBtn);
  act(() => { vi.advanceTimersByTime(300); });
  console.log("results screen:", document.body.textContent?.includes("نتايج الجولة"), "| finalized:", finalized !== null);

  console.log("REACT ERRORS:", errors.slice(0, 3));
  console.error = orig;
  expect(errors.length).toBe(0);
});
