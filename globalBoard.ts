/* ===== لوحة الشرف المشتركة =====
 * اللعبة من غير سيرفر، فالأرقام القياسية بتنتشر بين اللاعيبة:
 * كل ما تلعب أونلاين، جهازك بيبادل أفضل الأرقام مع الغرفة،
 * والمضيف بيدمجها ويوزّعها على الكل — فالرقم القوي بينتشر في الشبكة.
 */

import { useEffect, useState } from "react";

const KEY = "busComplete.globalBoard.v1";
const EVT = "busComplete.globalBoardChanged";
export const BOARD_EVENT = EVT;
export const BOARD_MAX = 30;

export type BoardMode = "solo" | "daily" | "online" | "ten" | "blitz" | "chain" | "scramble";

export interface BoardRecord {
  id: string;        // معرّف فريد للرقم (يمنع التكرار عند الدمج)
  name: string;
  avatar?: string;
  score: number;
  mode: BoardMode;
  at: number;        // وقت التسجيل
}

export const MODE_LABEL: Record<BoardMode, string> = {
  solo: "فردي",
  daily: "تحدي يومي",
  online: "أونلاين",
  ten: "عشر كلمات",
  blitz: "خمس ثواني",
  chain: "وصلة الحروف",
  scramble: "حروف متلغبطة",
};

function read(): BoardRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as BoardRecord[]) : [];
    return Array.isArray(arr) ? arr.filter(valid) : [];
  } catch { return []; }
}

function valid(r: unknown): r is BoardRecord {
  const x = r as BoardRecord;
  return !!x && typeof x.id === "string" && typeof x.name === "string"
    && typeof x.score === "number" && Number.isFinite(x.score)
    && x.score >= 0 && x.score < 100_000 && typeof x.at === "number";
}

function write(list: BoardRecord[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, BOARD_MAX))); } catch { /* اتجاهل */ }
  try { window.dispatchEvent(new CustomEvent(EVT)); } catch { /* اتجاهل */ }
}

/** ترتيب: الأعلى نقاطًا، والأقدم أولًا عند التساوي */
function sortBoard(list: BoardRecord[]): BoardRecord[] {
  return [...list].sort((a, b) => b.score - a.score || a.at - b.at);
}

export function loadBoard(): BoardRecord[] {
  return sortBoard(read());
}

/**
 * دمج أرقام جاية من لاعيبة تانية مع اللي عندنا.
 * بنشيل التكرار بالـid، وبنسيب أفضل رقم لكل لاعب.
 */
export function mergeBoard(incoming: BoardRecord[]): BoardRecord[] {
  const mine = read();
  const byId = new Map<string, BoardRecord>();
  for (const r of [...mine, ...(Array.isArray(incoming) ? incoming.filter(valid) : [])]) {
    const prev = byId.get(r.id);
    if (!prev || r.score > prev.score) byId.set(r.id, { ...r, name: r.name.slice(0, 16) });
  }
  // أفضل رقم لكل لاعب في كل طور (عشان محدش يغرق اللوحة)
  const bestPer = new Map<string, BoardRecord>();
  for (const r of byId.values()) {
    const k = `${r.name}|${r.mode}`;
    const prev = bestPer.get(k);
    if (!prev || r.score > prev.score) bestPer.set(k, r);
  }
  const merged = sortBoard([...bestPer.values()]).slice(0, BOARD_MAX);
  write(merged);
  return merged;
}

/** تسجيل رقم جديد — بيرجع الترتيب (‎-1 لو مدخلش اللوحة) */
export function submitRecord(p: { name: string; avatar?: string; score: number; mode: BoardMode }): number {
  if (!p.score || p.score <= 0) return -1;
  const rec: BoardRecord = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: (p.name || "النجم").slice(0, 16),
    avatar: p.avatar ? p.avatar.slice(0, 40_000) : undefined,
    score: Math.round(p.score),
    mode: p.mode,
    at: Date.now(),
  };
  const merged = mergeBoard([rec]);
  return merged.findIndex((r) => r.id === rec.id);
}

/** الأرقام اللي بنبعتها للاعيبة التانيين (من غير صور عشان الحجم) */
export function boardForShare(limit = 15): BoardRecord[] {
  return loadBoard().slice(0, limit).map((r) => ({ ...r, avatar: undefined }));
}

/** هوك متابعة اللوحة */
export function useBoard(): BoardRecord[] {
  const [list, setList] = useState<BoardRecord[]>(() => loadBoard());
  useEffect(() => {
    const h = () => setList(loadBoard());
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, []);
  return list;
}
