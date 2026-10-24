// @vitest-environment jsdom
import { it, expect, beforeEach } from "vitest";
import { submitRecord, mergeBoard, loadBoard, boardForShare, BOARD_MAX } from "./globalBoard";

beforeEach(() => localStorage.clear());

it("الرقم الأعلى بيطلع فوق", () => {
  submitRecord({ name: "أحمد", score: 50, mode: "solo" });
  submitRecord({ name: "سارة", score: 120, mode: "solo" });
  submitRecord({ name: "علي", score: 80, mode: "solo" });
  const b = loadBoard();
  console.log("الترتيب:", b.map((r) => `${r.name}=${r.score}`).join(" "));
  expect(b[0].name).toBe("سارة");
  expect(b[0].score).toBe(120);
});

it("رقم جديد من لاعب تاني بينضم للوحة (نشر)", () => {
  submitRecord({ name: "أنا", score: 60, mode: "solo" });
  // وصلني رقم من صاحبي أونلاين
  const merged = mergeBoard([
    { id: "x1", name: "خالد", score: 200, mode: "online", at: Date.now() },
  ]);
  console.log("بعد الدمج:", merged.map((r) => `${r.name}=${r.score}`).join(" "));
  expect(merged[0].name).toBe("خالد");
  expect(merged.length).toBe(2);
});

it("مفيش تكرار لنفس الرقم لو اتبعت مرتين", () => {
  const rec = { id: "same", name: "منى", score: 90, mode: "solo" as const, at: Date.now() };
  mergeBoard([rec]);
  mergeBoard([rec]);
  mergeBoard([rec]);
  expect(loadBoard().filter((r) => r.id === "same").length).toBe(1);
});

it("أفضل رقم للاعب بس في كل طور", () => {
  submitRecord({ name: "زياد", score: 40, mode: "solo" });
  submitRecord({ name: "زياد", score: 95, mode: "solo" });
  submitRecord({ name: "زياد", score: 70, mode: "blitz" });
  const b = loadBoard();
  const solo = b.filter((r) => r.name === "زياد" && r.mode === "solo");
  console.log("أرقام زياد:", b.filter(r => r.name === "زياد").map((r) => `${r.mode}=${r.score}`).join(" "));
  expect(solo.length).toBe(1);
  expect(solo[0].score).toBe(95);
  expect(b.filter((r) => r.name === "زياد").length).toBe(2); // فردي + بليتز
});

it("اللوحة مش بتكبر أكتر من الحد", () => {
  for (let i = 0; i < 60; i++) submitRecord({ name: `لاعب${i}`, score: i + 1, mode: "solo" });
  expect(loadBoard().length).toBeLessThanOrEqual(BOARD_MAX);
  expect(loadBoard()[0].score).toBe(60);
});

it("النسخة المُرسلة من غير صور", () => {
  submitRecord({ name: "نور", avatar: "data:image/jpeg;base64,AAAA", score: 30, mode: "ten" });
  expect(boardForShare()[0].avatar).toBeUndefined();
});

it("بيرفض الأرقام التالفة", () => {
  submitRecord({ name: "صح", score: 10, mode: "solo" });
  mergeBoard([{ id: "bad", name: "غش", score: 999_999, mode: "solo", at: Date.now() } as never]);
  expect(loadBoard().some((r) => r.name === "غش")).toBe(false);
});
