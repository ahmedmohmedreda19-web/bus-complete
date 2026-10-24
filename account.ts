/* ===== حساب اللاعب: فيسبوك + حفظ تقدم + كود صديق ===== */

import { useEffect, useState } from "react";
import {
  FacebookAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "./firebase";
import { saveProfile, readProfile } from "./profile";
import { pullProgressFromCloud, pushProgressToCloud } from "./cloudSave";

const KEY = "busComplete.account.v1";
const EVT = "busComplete.accountChanged";

export interface AccountState {
  uid: string;
  name: string;
  email: string;
  avatar: string;
  provider: "facebook" | "local";
  friendCode: string;
  linkedAt: number;
}

const EMPTY: AccountState = {
  uid: "",
  name: "",
  email: "",
  avatar: "",
  provider: "local",
  friendCode: "",
  linkedAt: 0,
};

function notify() {
  try { window.dispatchEvent(new CustomEvent(EVT)); } catch { /* اتجاهل */ }
}

function write(account: AccountState) {
  try { localStorage.setItem(KEY, JSON.stringify(account)); } catch { /* اتجاهل */ }
  notify();
}

export function readAccount(): AccountState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as AccountState) };
  } catch {
    return { ...EMPTY };
  }
}

export function isLoggedIn(account = readAccount()): boolean {
  return Boolean(account.uid);
}

/** كود صديق قصير وواضح */
export function makeFriendCode(seed = ""): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let base = 0;
  for (let i = 0; i < seed.length; i++) base = (base * 33 + seed.charCodeAt(i)) >>> 0;
  if (!base) base = Math.floor(Math.random() * 1_000_000_000);
  let out = "";
  let n = base || Date.now();
  for (let i = 0; i < 6; i++) {
    out += alphabet[n % alphabet.length];
    n = Math.floor(n / alphabet.length) + ((i + 1) * 17);
  }
  return out;
}

function applyAccountToProfile(account: AccountState) {
  const profile = readProfile();
  saveProfile({
    name: account.name || profile.name || "النجم",
    avatar: account.avatar || profile.avatar || "",
  });
}

function accountFromUser(user: User): AccountState {
  return {
    uid: user.uid,
    name: (user.displayName || "لاعب فيسبوك").slice(0, 16),
    email: user.email || "",
    avatar: user.photoURL || "",
    provider: "facebook",
    friendCode: makeFriendCode(user.uid),
    linkedAt: Date.now(),
  };
}

/** تسجيل دخول فيسبوك الحقيقي عبر Firebase */
export async function loginWithFacebook(): Promise<{ ok: boolean; account?: AccountState; reason?: string }> {
  if (!isFirebaseConfigured()) {
    return { ok: false, reason: "firebase-not-configured" };
  }
  const auth = getFirebaseAuth();
  if (!auth) return { ok: false, reason: "no-auth" };
  try {
    const provider = new FacebookAuthProvider();
    provider.addScope("public_profile");
    provider.addScope("email");
    const result = await signInWithPopup(auth, provider);
    const account = accountFromUser(result.user);
    // احتفظ بالكود القديم لو موجود لنفس الحساب
    const prev = readAccount();
    if (prev.uid === account.uid && prev.friendCode) account.friendCode = prev.friendCode;
    write(account);
    applyAccountToProfile(account);
    await pullProgressFromCloud(account.uid);
    await pushProgressToCloud(account.uid);
    return { ok: true, account };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "login-failed" };
  }
}

/**
 * تسجيل محلي مرتبط بالفيس (لما Firebase مش متظبط).
 * بيحفظ التقدم محليًا وبيولد كود صديق ثابت.
 */
export function loginWithFacebookLocal(input?: { name?: string; avatar?: string }): AccountState {
  const profile = readProfile();
  const prev = readAccount();
  const seed = prev.uid || `fb-local-${Date.now().toString(36)}`;
  const account: AccountState = {
    uid: seed.startsWith("fb-") ? seed : `fb-${seed}`,
    name: (input?.name || profile.name || "لاعب فيسبوك").slice(0, 16),
    email: "",
    avatar: input?.avatar || profile.avatar || "",
    provider: "facebook",
    friendCode: prev.friendCode || makeFriendCode(seed),
    linkedAt: Date.now(),
  };
  write(account);
  applyAccountToProfile(account);
  return account;
}

export async function logoutAccount(): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
  } catch { /* اتجاهل */ }
  write({ ...EMPTY });
  notify();
}

export async function syncProgressNow(): Promise<{ ok: boolean; reason?: string }> {
  const account = readAccount();
  if (!account.uid) return { ok: false, reason: "not-logged-in" };
  if (!isFirebaseConfigured()) return { ok: false, reason: "firebase-not-configured" };
  const pushed = await pushProgressToCloud(account.uid);
  return pushed;
}

export function useAccount() {
  const [account, setAccount] = useState<AccountState>(() => readAccount());
  useEffect(() => {
    const onChange = () => setAccount(readAccount());
    window.addEventListener(EVT, onChange);
    const auth = getFirebaseAuth();
    let unsub = () => {};
    if (auth) {
      unsub = onAuthStateChanged(auth, (user) => {
        if (!user) return;
        const next = accountFromUser(user);
        const prev = readAccount();
        if (prev.uid === next.uid && prev.friendCode) next.friendCode = prev.friendCode;
        write(next);
        applyAccountToProfile(next);
      });
    }
    return () => {
      window.removeEventListener(EVT, onChange);
      unsub();
    };
  }, []);
  return account;
}
