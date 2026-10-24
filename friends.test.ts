// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { loginWithFacebookLocal, readAccount } from "./account";
import {
  acceptFriendRequest,
  getInviteLinks,
  readFriends,
  sendFriendRequestByCode,
} from "./friends";

beforeEach(() => localStorage.clear());

it("تسجيل محلي بيولد كود صداقة", () => {
  const acc = loginWithFacebookLocal({ name: "أحمد" });
  expect(acc.friendCode.length).toBe(6);
  expect(readAccount().name).toBe("أحمد");
});

it("إرسال وقبول طلب صداقة", () => {
  loginWithFacebookLocal({ name: "سارة" });
  const res = sendFriendRequestByCode("FRIEND1");
  expect(res.ok).toBe(true);
  const incoming = readFriends().incoming;
  expect(incoming.length).toBeGreaterThan(0);
  const ok = acceptFriendRequest(incoming[0].id);
  expect(ok).toBe(true);
  expect(readFriends().friends.length).toBe(1);
});

it("روابط الدعوة تتضمن واتساب وفيسبوك", () => {
  loginWithFacebookLocal({ name: "نور" });
  const links = getInviteLinks({ roomCode: "ABCDE" });
  expect(links.whatsapp.includes("wa.me")).toBe(true);
  expect(links.facebook.includes("facebook.com")).toBe(true);
  expect(links.text.includes("ABCDE")).toBe(true);
});
