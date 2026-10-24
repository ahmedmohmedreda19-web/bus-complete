/* ===== حفظ التقدم محليًا + مزامنة سحابية عند توفر Firebase ===== */

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb, isFirebaseConfigured } from "./firebase";

const CLOUD_KEYS = [
  "busComplete.profile.v1",
  "busComplete.name",
  "busComplete.wallet.v1",
  "busComplete.stats.v1",
  "busComplete.history.v1",
  "busComplete.achievements.v1",
  "busComplete.daily.v1",
  "busComplete.wheel.v1",
  "busComplete.globalBoard.v1",
  "busComplete.customDict.v1",
  "busComplete.friends.v1",
  "busComplete.account.v1",
] as const;

export function exportLocalProgress(): Record<string, string> {
  const data: Record<string, string> = {};
  for (const key of CLOUD_KEYS) {
    try {
      const value = localStorage.getItem(key);
      if (value != null) data[key] = value;
    } catch { /* اتجاهل */ }
  }
  return data;
}

export function importLocalProgress(data: Record<string, string>) {
  for (const [key, value] of Object.entries(data || {})) {
    if (!CLOUD_KEYS.includes(key as typeof CLOUD_KEYS[number])) continue;
    try { localStorage.setItem(key, value); } catch { /* اتجاهل */ }
  }
  // نبّه الواجهة إن البيانات اتغيرت
  try {
    window.dispatchEvent(new CustomEvent("busComplete.profileChanged"));
    window.dispatchEvent(new CustomEvent("busComplete.walletChanged"));
    window.dispatchEvent(new CustomEvent("busComplete.achievementsChanged"));
    window.dispatchEvent(new CustomEvent("busComplete.dailyChanged"));
    window.dispatchEvent(new CustomEvent("busComplete.wheelChanged"));
    window.dispatchEvent(new CustomEvent("busComplete.globalBoardChanged"));
    window.dispatchEvent(new CustomEvent("busComplete.friendsChanged"));
    window.dispatchEvent(new CustomEvent("busComplete.accountChanged"));
  } catch { /* اتجاهل */ }
}

export async function pushProgressToCloud(uid: string): Promise<{ ok: boolean; reason?: string }> {
  if (!isFirebaseConfigured()) return { ok: false, reason: "firebase-not-configured" };
  const db = getFirebaseDb();
  if (!db || !uid) return { ok: false, reason: "no-db" };
  try {
    const payload = exportLocalProgress();
    await setDoc(doc(db, "players", uid), {
      progress: payload,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "push-failed" };
  }
}

export async function pullProgressFromCloud(uid: string): Promise<{ ok: boolean; reason?: string }> {
  if (!isFirebaseConfigured()) return { ok: false, reason: "firebase-not-configured" };
  const db = getFirebaseDb();
  if (!db || !uid) return { ok: false, reason: "no-db" };
  try {
    const snap = await getDoc(doc(db, "players", uid));
    if (!snap.exists()) return { ok: false, reason: "no-cloud-save" };
    const data = snap.data() as { progress?: Record<string, string> };
    if (!data.progress) return { ok: false, reason: "empty-cloud-save" };
    importLocalProgress(data.progress);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "pull-failed" };
  }
}
