/* ===== محفظة الجنيه والجواهر والمخزون والمقتنيات ===== */

import { useEffect, useState } from "react";
import { PRICES, TITLES, SKINS } from "../data/shop";

export interface WalletState {
  coins: number;   // الجنيه
  gems: number;    // الجواهر — عملة نادرة لا تُكسب بسهولة
  inv: { hint: number; time: number };
  ownedTitles: string[];
  ownedSkins: string[];
  title: string; // id
  skin: string;  // id
  gifted: boolean;
  gemMilestones: number[]; // مستويات سلسلة الأيام اللي اتحصلت جواهر منها
}

const KEY = "busComplete.wallet.v1";
const EVT = "busComplete.walletChanged";
const GIFT = 50;

function readRaw(): WalletState {
  let s: WalletState = {
    coins: 0, gems: 0, inv: { hint: 1, time: 1 }, ownedTitles: [], ownedSkins: ["classic"],
    title: "", skin: "classic", gifted: false, gemMilestones: [],
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) s = { ...s, ...(JSON.parse(raw) as WalletState) };
  } catch { /* اتجاهل */ }
  if (!s.gifted) {
    s = { ...s, coins: s.coins + GIFT, gifted: true };
    write(s);
  }
  return s;
}

function write(s: WalletState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* اتجاهل */ }
}

function notify() {
  window.dispatchEvent(new CustomEvent(EVT));
}

export function readWallet(): WalletState {
  return readRaw();
}

/** هوك رجعة حيّة بالمحفظة */
export function useWallet(): WalletState {
  const [w, setW] = useState(readRaw);
  useEffect(() => {
    const h = () => setW(readRaw());
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, []);
  return w;
}

/* ---------- كسب ---------- */
export function earn(n: number) {
  if (n <= 0) return;
  const s = readRaw();
  write({ ...s, coins: s.coins + Math.round(n) });
  notify();
}

/**
 * منح جواهر — عملة نادرة قوية.
 * لا تُستخدم في أي مكان إلا حيث تُكسب بجدارة.
 */
export function earnGems(n: number) {
  if (n <= 0) return 0;
  const s = readRaw();
  write({ ...s, gems: Math.min(99, s.gems + Math.round(n)) });
  notify();
  return s.gems;
}

/* ---------- صرف / شراء ---------- */
export function buyHint(): boolean {
  const s = readRaw();
  if (s.coins < PRICES.hint) return false;
  write({ ...s, coins: s.coins - PRICES.hint, inv: { ...s.inv, hint: s.inv.hint + 1 } });
  notify();
  return true;
}

export function buyTime(): boolean {
  const s = readRaw();
  if (s.coins < PRICES.time) return false;
  write({ ...s, coins: s.coins - PRICES.time, inv: { ...s.inv, time: s.inv.time + 1 } });
  notify();
  return true;
}

export function buyTitle(id: string): boolean {
  const t = TITLES.find((x) => x.id === id);
  const s = readRaw();
  // اللقب الجوهري: لا يستخدم الجنيه، يستخدم الجواهر
  if (t?.gemPrice != null && t.gemPrice > 0) {
    if (s.ownedTitles.includes(id) || s.gems < t.gemPrice) return false;
    write({ ...s, gems: s.gems - t.gemPrice, ownedTitles: [...s.ownedTitles, id], title: id });
    notify();
    return true;
  }
  if (!t || t.exclusive || s.ownedTitles.includes(id) || s.coins < t.price) return false;
  write({ ...s, coins: s.coins - t.price, ownedTitles: [...s.ownedTitles, id], title: id });
  notify();
  return true;
}

/** منح سكن مجانًا (جايزة عجلة الحظ) */
export function grantSkin(id: string) {
  const s = readRaw();
  if (s.ownedSkins.includes(id)) return;
  write({ ...s, ownedSkins: [...s.ownedSkins, id] });
  notify();
}

/** إضافة تلميحات مجانًا */
export function addHint(n = 1) {
  const s = readRaw();
  write({ ...s, inv: { ...s.inv, hint: s.inv.hint + n } });
  notify();
}

/** إضافة وقود وقت مجانًا */
export function addTime(n = 1) {
  const s = readRaw();
  write({ ...s, inv: { ...s.inv, time: s.inv.time + n } });
  notify();
}

/** منح لقب مجانًا (جايزة إنجاز) */
export function grantTitle(id: string) {
  const s = readRaw();
  if (s.ownedTitles.includes(id)) return;
  write({ ...s, ownedTitles: [...s.ownedTitles, id] });
  notify();
}

export function equipTitle(id: string) {
  const s = readRaw();
  if (id && !s.ownedTitles.includes(id)) return;
  write({ ...s, title: id });
  notify();
}

export function buySkin(id: string): boolean {
  const sk = SKINS.find((x) => x.id === id);
  const s = readRaw();
  // السكن الجوهري: لا يستخدم الجنيه، يستخدم الجواهر
  if (sk?.gemPrice != null && sk.gemPrice > 0) {
    if (s.ownedSkins.includes(id) || s.gems < sk.gemPrice) return false;
    write({ ...s, gems: s.gems - sk.gemPrice, ownedSkins: [...s.ownedSkins, id], skin: id });
    notify();
    return true;
  }
  if (!sk || s.ownedSkins.includes(id) || s.coins < sk.price) return false;
  write({ ...s, coins: s.coins - sk.price, ownedSkins: [...s.ownedSkins, id], skin: id });
  notify();
  return true;
}

export function equipSkin(id: string) {
  const s = readRaw();
  if (!s.ownedSkins.includes(id)) return;
  write({ ...s, skin: id });
  notify();
}

/* ---------- استخدام المساعدات ---------- */
export function consumeHint(): boolean {
  const s = readRaw();
  if (s.inv.hint <= 0) return false;
  write({ ...s, inv: { ...s.inv, hint: s.inv.hint - 1 } });
  notify();
  return true;
}

export function consumeTime(): boolean {
  const s = readRaw();
  if (s.inv.time <= 0) return false;
  write({ ...s, inv: { ...s.inv, time: s.inv.time - 1 } });
  notify();
  return true;
}

/* ---------- قراءات سريعة ---------- */
export function getTitleLabel(): string {
  const s = readRaw();
  return TITLES.find((t) => t.id === s.title)?.label ?? "";
}

/** حدود الجواهر — لتقارن المستخدم شحة القيمة */
export function gemCount(): number {
  return readRaw().gems;
}

/** علامة مستوى سلسلة الأيام الجوهري لتجنب التكرار */
export function claimGemMilestone(level: number): boolean {
  const s = readRaw();
  if (s.gemMilestones.includes(level)) return false;
  write({ ...s, gemMilestones: [...s.gemMilestones, level] });
  notify();
  return true;
}
