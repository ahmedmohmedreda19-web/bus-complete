/* ===== الأصدقاء والدعوات ===== */

import { useEffect, useState } from "react";
import { readAccount } from "./account";
import { readProfile } from "./profile";

// re-export style helper kept local to avoid circular noise

const KEY = "busComplete.friends.v1";
const EVT = "busComplete.friendsChanged";

export interface FriendUser {
  id: string;
  name: string;
  avatar?: string;
  friendCode: string;
  source: "game" | "facebook";
}

export interface FriendRequest {
  id: string;
  from: FriendUser;
  createdAt: number;
  status: "pending" | "accepted" | "declined";
}

export interface FriendsState {
  friends: FriendUser[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

const EMPTY: FriendsState = { friends: [], incoming: [], outgoing: [] };

function notify() {
  try { window.dispatchEvent(new CustomEvent(EVT)); } catch { /* اتجاهل */ }
}

function write(state: FriendsState) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* اتجاهل */ }
  notify();
}

export function readFriends(): FriendsState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as FriendsState;
    return {
      friends: Array.isArray(parsed.friends) ? parsed.friends : [],
      incoming: Array.isArray(parsed.incoming) ? parsed.incoming : [],
      outgoing: Array.isArray(parsed.outgoing) ? parsed.outgoing : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

function meAsFriend(): FriendUser {
  const account = readAccount();
  const profile = readProfile();
  return {
    id: account.uid || `local-${profile.name || "player"}`,
    name: account.name || profile.name || "النجم",
    avatar: account.avatar || profile.avatar || "",
    friendCode: account.friendCode || "------",
    source: account.provider === "facebook" ? "facebook" : "game",
  };
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function sendFriendRequestByCode(codeRaw: string): { ok: boolean; reason?: string } {
  const code = codeRaw.trim().toUpperCase();
  if (code.length < 4) return { ok: false, reason: "invalid-code" };
  const me = meAsFriend();
  if (!me.friendCode || me.friendCode === "------") return { ok: false, reason: "login-required" };
  if (code === me.friendCode) return { ok: false, reason: "self" };

  const state = readFriends();
  if (state.friends.some((f) => f.friendCode === code)) return { ok: false, reason: "already-friends" };
  if (state.outgoing.some((r) => r.from.friendCode === code || r.id.includes(code))) {
    return { ok: false, reason: "already-sent" };
  }

  // في اللعبة الحالية (P2P/محلي): بنسجل الطلب كـ outgoing،
  // ولو الكود معروف محليًا بنحوّله لطلب وارد على نفس الجهاز للاختبار.
  const request: FriendRequest = {
    id: uid(),
    from: me,
    createdAt: Date.now(),
    status: "pending",
  };
  state.outgoing = [request, ...state.outgoing].slice(0, 40);

  // محاكاة استقبال محلي: لو حد بعت نفس الكود قبل كده
  const mirror: FriendRequest = {
    id: uid(),
    from: {
      id: `peer-${code}`,
      name: `صديق ${code.slice(0, 3)}`,
      friendCode: code,
      source: "game",
    },
    createdAt: Date.now(),
    status: "pending",
  };
  // نخزن الطلب الصادر فقط في الحالة الأساسية، والمستخدم يقدر يضيف يدويًا بالقبول لاحقًا
  write(state);

  // إضافة سريعة: لو عايز تختبر القبول، بنضيف الطلب كـ incoming بعلامة خاصة
  // عند إدخال كود صالح في نفس الجهاز (demo).
  const demoIncoming = { ...mirror, from: { ...mirror.from, name: `لاعب ${code}` } };
  const next = readFriends();
  next.incoming = [demoIncoming, ...next.incoming.filter((r) => r.from.friendCode !== code)].slice(0, 40);
  write(next);

  return { ok: true };
}

export function acceptFriendRequest(requestId: string): boolean {
  const state = readFriends();
  const req = state.incoming.find((r) => r.id === requestId);
  if (!req) return false;
  state.incoming = state.incoming.filter((r) => r.id !== requestId);
  if (!state.friends.some((f) => f.friendCode === req.from.friendCode)) {
    state.friends = [{ ...req.from, source: req.from.source || "game" }, ...state.friends].slice(0, 100);
  }
  write(state);
  return true;
}

export function declineFriendRequest(requestId: string): boolean {
  const state = readFriends();
  const before = state.incoming.length;
  state.incoming = state.incoming.filter((r) => r.id !== requestId);
  write(state);
  return state.incoming.length < before;
}

export function removeFriend(friendCode: string): boolean {
  const state = readFriends();
  const before = state.friends.length;
  state.friends = state.friends.filter((f) => f.friendCode !== friendCode);
  write(state);
  return state.friends.length < before;
}

export interface InviteLinks {
  link: string;
  text: string;
  whatsapp: string;
  facebook: string;
  messenger: string;
  telegram: string;
  mail: string;
  instagram: { url: string; note: string; text: string };
}

export function getInviteLinks(opts?: { roomCode?: string }): InviteLinks {
  const origin = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "https://buscomplete.app";
  const account = readAccountSafe();
  const params = new URLSearchParams();
  if (account.friendCode) params.set("friend", account.friendCode);
  if (opts?.roomCode) params.set("room", opts.roomCode);
  const link = `${origin}?${params.toString()}`;
  const text = opts?.roomCode
    ? `خلينا نلعب أتوبيس كومبليت!\n\nكود الغرفة: ${opts.roomCode}\n\n${link}`
    : `تعالى نلعب أتوبيس كومبليت ونضيف بعض 🎮\n\nكود الصداقة بتاعي: ${account.friendCode || "------"}\n\n${link}`;
  return {
    link,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}&quote=${encodeURIComponent(text)}`,
    messenger: `https://www.facebook.com/messages/t/?text=${encodeURIComponent(text)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`,
    mail: `mailto:?subject=${encodeURIComponent("تعالى نلعب أتوبيس كومبليت! 🎮")}&body=${encodeURIComponent(text)}`,
    instagram: {
      url: "https://www.instagram.com/direct/inbox/",
      note: " نسخت النص — افتح إنستجرام والصق الرسالة في أي DM",
      text,
    },
    text,
  };
}

function readAccountSafe() {
  try {
    return readAccount();
  } catch {
    return { friendCode: "" } as { friendCode: string };
  }
}

/** يلتقط رابط الدعوة من عنوان الصفحة */
export function consumeInviteFromUrl(): { friendCode?: string; roomCode?: string } {
  try {
    const url = new URL(window.location.href);
    const friendCode = url.searchParams.get("friend") || undefined;
    const roomCode = url.searchParams.get("room") || undefined;
    if (friendCode || roomCode) {
      url.searchParams.delete("friend");
      url.searchParams.delete("room");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
    return { friendCode: friendCode?.toUpperCase(), roomCode: roomCode?.toUpperCase() };
  } catch {
    return {};
  }
}

export function useFriends(): FriendsState {
  const [state, setState] = useState<FriendsState>(() => readFriends());
  useEffect(() => {
    const onChange = () => setState(readFriends());
    window.addEventListener(EVT, onChange);
    return () => window.removeEventListener(EVT, onChange);
  }, []);
  return state;
}
