// @vitest-environment jsdom
import { it, expect, beforeEach } from "vitest";
import { loginWithFacebookLocal } from "./account";
import { getInviteLinks } from "./friends";

beforeEach(() => localStorage.clear());

it("روابط المشاركة شاملة لكل المنصات", () => {
  loginWithFacebookLocal({ name: "نور" });
  const links = getInviteLinks({ roomCode: "XYZ12" });

  expect(links.whatsapp.includes("wa.me")).toBe(true);
  expect(links.messenger.includes("messages")).toBe(true);
  expect(links.telegram.includes("t.me")).toBe(true);
  expect(links.mail.startsWith("mailto:")).toBe(true);
  expect(links.instagram.url.includes("instagram.com")).toBe(true);
  expect(links.text.includes("XYZ12")).toBe(true);
});
