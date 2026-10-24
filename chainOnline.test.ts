// @vitest-environment jsdom
import { it, expect, vi, beforeEach, afterEach } from "vitest";

const claimed = new Map<string, any>();
vi.mock("peerjs", () => {
  class FakePeer {
    id: string; open = false; private hs: Record<string, Function[]> = {};
    constructor(id?: string) {
      this.id = id ?? "g-" + Math.random().toString(36).slice(2, 7);
      setTimeout(() => {
        if (id && claimed.has(id)) { this.emit("error", { type: "unavailable-id" }); return; }
        if (id) claimed.set(id, this);
        this.open = true; this.emit("open", this.id);
      }, 3);
    }
    on(e: string, cb: Function) { (this.hs[e] ??= []).push(cb); }
    emit(e: string, ...a: any[]) { (this.hs[e] ?? []).forEach((f) => f(...a)); }
    connect(target: string) {
      const conn: any = { peer: this.id, hs: {} as any,
        on(e: string, cb: Function) { (this.hs[e] ??= []).push(cb); },
        emit(e: string, ...a: any[]) { (this.hs[e] ?? []).forEach((f: Function) => f(...a)); },
        send(_d: any) {}, close() {} };
      setTimeout(() => {
        const host = claimed.get(target);
        if (!host) { this.emit("error", { type: "peer-unavailable" }); return; }
        const hostSide: any = { peer: this.id, hs: {} as any,
          on(e: string, cb: Function) { (this.hs[e] ??= []).push(cb); },
          emit(e: string, ...a: any[]) { (this.hs[e] ?? []).forEach((f: Function) => f(...a)); },
          send(d: any) { conn.emit("data", d); }, close() {} };
        conn.send = (d: any) => hostSide.emit("data", d);
        host.emit("connection", hostSide);
        conn.emit("open");
      }, 3);
      return conn;
    }
    destroy() { for (const [k, v] of claimed) if (v === this) claimed.delete(k); }
    reconnect() {}
  }
  return { default: FakePeer };
});

import { createRoom, joinRoom } from "./online";
import type { ChainState } from "../lib/chainTypes";

beforeEach(() => { claimed.clear(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

it("الأدوار بتلف بين اللاعيبة والسلسلة بتكمل", async () => {
  let hostState: ChainState | null = null;
  let guestState: ChainState | null = null;

  const host = createRoom("مضيف", { onChainState: (s) => { hostState = s; } });
  await vi.advanceTimersByTimeAsync(30);
  const code = (host as any).code;
  const guest = joinRoom(code, "ضيف", { onChainState: (s) => { guestState = s; } });
  await vi.advanceTimersByTimeAsync(60);

  host.startChain();
  await vi.advanceTimersByTimeAsync(20);
  expect(hostState).toBeTruthy();
  expect(guestState).toBeTruthy();
  console.log("لاعيبة:", hostState!.players.map((p) => p.name).join(" و"));
  console.log("حرف البداية:", hostState!.letter, "| الدور لـ:", hostState!.players.find(p => p.id === hostState!.turnId)?.name);

  // اللي دوره يجاوب صح
  const firstTurn = hostState!.turnId;
  const isHostTurn = firstTurn === (host as any).peer.id;
  const word = { "ا": "احمد", "ب": "بلال", "م": "محمد", "س": "سمير", "ك": "كتاب", "ت": "تفاح", "ن": "نمر", "ج": "جمل", "ح": "حصان", "د": "دب", "ر": "رمان", "ز": "زرافة", "ش": "شمس", "ص": "صقر", "ط": "طاولة", "ع": "عنب", "غ": "غزال", "ف": "فيل", "ق": "قلم", "ل": "ليمون", "و": "وردة", "خ": "خيار", "ذ": "ذرة" }[hostState!.letter] ?? "احمد";
  if (isHostTurn) host.hostChainWord(word); else (guest as any).sendChainWord(word);
  await vi.advanceTimersByTimeAsync(40);

  console.log("بعد الكلمة:", hostState!.lastWord, "| الحرف الجاي:", hostState!.letter);
  expect(hostState!.history.length).toBe(1);
  // الدور اتنقل للاعب التاني
  expect(hostState!.turnId).not.toBe(firstTurn);
  host.destroy(); guest.destroy();
});

it("اللي وقته يخلص بيخسر روح", async () => {
  let st: ChainState | null = null;
  const host = createRoom("مضيف", { onChainState: (s) => { st = s; } });
  await vi.advanceTimersByTimeAsync(30);
  const guest = joinRoom((host as any).code, "ضيف", {});
  await vi.advanceTimersByTimeAsync(60);

  host.startChain();
  await vi.advanceTimersByTimeAsync(20);
  const before = st!.players.find((p) => p.id === st!.turnId)!.lives;
  // نسيب الوقت يعدي
  await vi.advanceTimersByTimeAsync(16_000);
  const target = st!.players.find((p) => p.lives < before);
  console.log("خسر روح:", target?.name, "| الأرواح:", target?.lives);
  expect(target).toBeTruthy();
  host.destroy(); guest.destroy();
});
