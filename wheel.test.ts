// @vitest-environment jsdom
import { it, expect, beforeEach } from "vitest";
import { spinWheel, canSpin, readWheel, PRIZES } from "./wheel";
import { readWallet } from "./wallet";
import { SKINS } from "../data/shop";

beforeEach(() => localStorage.clear());

it("لفة واحدة بس في اليوم", () => {
  expect(canSpin()).toBe(true);
  const r1 = spinWheel();
  expect(r1).toBeTruthy();
  expect(canSpin()).toBe(false);
  expect(spinWheel()).toBeNull();
  console.log("الجايزة:", r1!.prize.label);
});

it("الجايزة بتتطبق فعلاً على المحفظة", () => {
  const before = readWallet();
  const r = spinWheel()!;
  const after = readWallet();
  if (r.prize.kind === "coins" || r.prize.kind === "jackpot") {
    expect(after.coins).toBe(before.coins + (r.amount ?? 0));
  } else if (r.prize.kind === "hint") {
    expect(after.inv.hint).toBe(before.inv.hint + (r.amount ?? 1));
  } else if (r.prize.kind === "time") {
    expect(after.inv.time).toBe(before.inv.time + (r.amount ?? 1));
  } else if (r.prize.kind === "skin") {
    expect(after.ownedSkins.length).toBeGreaterThan(before.ownedSkins.length);
  }
  console.log("طُبقت:", r.prize.kind, r.prize.label);
});

it("توزيع الجوايز منطقي على ٢٠٠٠ لفة", () => {
  const count: Record<string, number> = {};
  for (let i = 0; i < 2000; i++) {
    localStorage.removeItem("busComplete.wheel.v1");
    const r = spinWheel()!;
    count[r.prize.id] = (count[r.prize.id] ?? 0) + 1;
  }
  const pct = (id: string) => Math.round(((count[id] ?? 0) / 2000) * 100);
  console.log("التوزيع:", PRIZES.map((p) => `${p.icon}${pct(p.id)}%`).join(" "));
  // الجاكبوت نادر، والجنيه الصغيرة شائعة
  expect(pct("jack")).toBeLessThan(8);
  expect(pct("c25")).toBeGreaterThan(15);
});

it("السكنات النادرة بتتمنح ومش بتتكرر", () => {
  const rareIds = SKINS.filter((s) => s.rare).map((s) => s.id);
  let granted = 0;
  for (let i = 0; i < 400 && granted < rareIds.length; i++) {
    localStorage.removeItem("busComplete.wheel.v1");
    const r = spinWheel()!;
    if (r.prize.kind === "skin" && r.skinName) granted++;
  }
  const owned = readWallet().ownedSkins.filter((s) => rareIds.includes(s));
  console.log("سكنات نادرة اتكسبت:", owned.length, "من", rareIds.length);
  expect(new Set(owned).size).toBe(owned.length); // مفيش تكرار
});

it("بيعد اللفات", () => {
  spinWheel();
  expect(readWheel().spins).toBe(1);
});
