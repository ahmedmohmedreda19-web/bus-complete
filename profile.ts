/* ===== بروفايل اللاعب: اسم + صورة، محفوظين على الجهاز ===== */

import { useEffect, useState } from "react";

const KEY = "busComplete.profile.v1";
const NAME_KEY = "busComplete.name"; // توافق مع التخزين القديم
const EVT = "busComplete.profileChanged";

/** حجم الصورة المرسلة للاعيبة — صغيرة عشان تعدي في الشبكة بسرعة */
export const AVATAR_PX = 96;
export const AVATAR_MAX_BYTES = 24_000;

export interface Profile {
  name: string;
  avatar: string; // dataURL أو "" لو مفيش صورة
}

const EMPTY: Profile = { name: "", avatar: "" };

export function readProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Profile;
      return { name: (p.name ?? "").slice(0, 16), avatar: p.avatar ?? "" };
    }
    // ترحيل من التخزين القديم (الاسم بس)
    const oldName = localStorage.getItem(NAME_KEY) ?? "";
    return { ...EMPTY, name: oldName.slice(0, 16) };
  } catch {
    return { ...EMPTY };
  }
}

export function saveProfile(p: Partial<Profile>) {
  const cur = readProfile();
  const next: Profile = {
    name: (p.name ?? cur.name).slice(0, 16),
    avatar: p.avatar !== undefined ? p.avatar : cur.avatar,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    localStorage.setItem(NAME_KEY, next.name); // يفضل القديم شغال
  } catch { /* اتجاهل */ }
  try { window.dispatchEvent(new CustomEvent(EVT)); } catch { /* اتجاهل */ }
  return next;
}

export function clearAvatar() {
  saveProfile({ avatar: "" });
}

/** هوك يتابع تغييرات البروفايل */
export function useProfile(): Profile {
  const [p, setP] = useState<Profile>(readProfile);
  useEffect(() => {
    const h = () => setP(readProfile());
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, []);
  return p;
}

/**
 * ضغط صورة المستخدم: قص مربّع من النص + تصغير + JPEG.
 * بيرجع dataURL صغير يقدر يتبعت في رسالة الشبكة.
 */
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) { reject(new Error("مش صورة")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("فشلت القراءة"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("الصورة تالفة"));
      img.onload = () => {
        try {
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;
          const canvas = document.createElement("canvas");
          canvas.width = AVATAR_PX;
          canvas.height = AVATAR_PX;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("مفيش كانفاس")); return; }
          ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
          let q = 0.68;
          let out = canvas.toDataURL("image/jpeg", q);
          while (out.length > AVATAR_MAX_BYTES && q > 0.3) {
            q -= 0.12;
            out = canvas.toDataURL("image/jpeg", q);
          }
          resolve(out);
        } catch (e) { reject(e as Error); }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
