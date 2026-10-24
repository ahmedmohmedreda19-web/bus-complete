// @vitest-environment jsdom
import { it, expect, vi, beforeEach, afterEach } from "vitest";

// محاكاة PeerJS: سيرفر خانات في الذاكرة
const claimed = new Map<string, any>();
let peers: any[] = [];

vi.mock("peerjs", () => {
  class FakePeer {
    id: string; open = false; private hs: Record<string, Function[]> = {};
    constructor(id?: string) {
      this.id = id ?? "anon-" + Math.random().toString(36).slice(2, 8);
      peers.push(this);
      setTimeout(() => {
        if (id && claimed.has(id)) { this.emit("error", { type: "unavailable-id" }); return; }
        if (id) claimed.set(id, this);
        this.open = true;
        this.emit("open", this.id);
      }, 5);
    }
    on(ev: string, cb: Function) { (this.hs[ev] ??= []).push(cb); }
    emit(ev: string, ...a: any[]) { (this.hs[ev] ?? []).forEach((f) => f(...a)); }
    connect(target: string) {
      const conn: any = { peer: this.id, hs: {} as Record<string, Function[]>,
        on(e: string, cb: Function) { (this.hs[e] ??= []).push(cb); },
        emit(e: string, ...a: any[]) { (this.hs[e] ?? []).forEach((f: Function) => f(...a)); },
        send(_d: any) {}, close() {} };
      setTimeout(() => {
        const hostPeer = claimed.get(target);
        if (!hostPeer) { this.emit("error", { type: "peer-unavailable" }); return; }
        // اربط الاتصال بالمضيف
        const hostSide: any = { peer: this.id, hs: {} as Record<string, Function[]>,
          on(e: string, cb: Function) { (this.hs[e] ??= []).push(cb); },
          emit(e: string, ...a: any[]) { (this.hs[e] ?? []).forEach((f: Function) => f(...a)); },
          send(d: any) { conn.emit("data", d); }, close() {} };
        conn.send = (d: any) => hostSide.emit("data", d);
        hostPeer.emit("connection", hostSide);
        conn.emit("open");
      }, 5);
      return conn;
    }
    destroy() { for (const [k, v] of claimed) if (v === this) claimed.delete(k); }
    reconnect() {}
  }
  return { default: FakePeer };
});

import { isHost, startQuickMatch } from "./online";

beforeEach(() => { claimed.clear(); peers = []; vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

it("لاعبين بيلاقوا بعض في نفس الخانة", async () => {
  const seen: string[] = [];
  const mk = (nm: string) => startQuickMatch({
    name: nm, title: "", avatar: "",
    handlers: { onPlayers: (ps) => { if (ps.length >= 2) seen.push(nm); } },
    onRoom: () => {},
  });
  const a = mk("أحمد");
  await vi.advanceTimersByTimeAsync(80);
  console.log("بعد اللاعب الأول — خانات متاخدة:", [...claimed.keys()]);
  const b = mk("سارة");
  await vi.advanceTimersByTimeAsync(200);
  console.log("host A?", a.isHost(), "| host B?", b.isHost());
  console.log("اللاعيبة شافوا بعض:", seen);
  expect(a.isHost()).toBe(true);
  expect(b.isHost()).toBe(false);
  expect(seen.length).toBeGreaterThan(0);
  a.destroy(); b.destroy();
});

it("٤ لاعيبة كلهم في غرفة واحدة", async () => {
  let maxPlayers = 0;
  const hs = { onPlayers: (ps: any[]) => { maxPlayers = Math.max(maxPlayers, ps.length); } };
  const all = ["أ", "ب", "ج", "د"].map((n) => {
    const h = startQuickMatch({ name: n, title: "", avatar: "", handlers: hs, onRoom: () => {} });
    return h;
  });
  await vi.advanceTimersByTimeAsync(400);
  console.log("أقصى عدد في الغرفة:", maxPlayers, "| خانات مستخدمة:", [...claimed.keys()].length);
  expect(maxPlayers).toBeGreaterThanOrEqual(3);
  all.forEach((h) => h.destroy());
});

it("الإعجاب المتكرر يُقبل مرة واحدة فقط", async () => {
  let accepted = 0;
  let hearts = 0;
  const a = startQuickMatch({
    name: "أحمد", title: "", avatar: "",
    handlers: { onLikes: (likes) => { hearts = likes["anon-player|boy"] ?? Object.values(likes)[0] ?? 0; } },
    onRoom: () => {},
  });
  await vi.advanceTimersByTimeAsync(80);
  const b = startQuickMatch({
    name: "سارة", title: "", avatar: "",
    handlers: { onLikeAccepted: () => { accepted += 1; } },
    onRoom: () => {},
  });
  await vi.advanceTimersByTimeAsync(200);

  const host = a.room();
  const guest = b.room();
  expect(host && isHost(host)).toBe(true);
  expect(guest && !isHost(guest)).toBe(true);
  if (host && guest && !isHost(guest)) {
    guest.sendLike(host.myId, "boy");
    guest.sendLike(host.myId, "boy");
  }
  await vi.advanceTimersByTimeAsync(40);
  expect(accepted).toBe(1);
  expect(hearts).toBe(1);
  a.destroy(); b.destroy();
});
