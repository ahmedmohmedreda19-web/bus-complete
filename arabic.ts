/* ===== محرك معالجة النص العربي ===== */

/** توحيد النص: إزالة التشكيل والتطويل، توحيد الهمزات والألفات والياءات والتاء المربوطة */
export function normalizeArabic(input: string): string {
  return input
    .replace(/[ً-ْٰـ٪]/g, "") // تشكيل + تطويل
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ء/g, "")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** إزالة "ال" التعريف من البداية (في اللعبة لا تُحتسب) */
export function stripAl(text: string): string {
  return text.length > 3 && text.startsWith("ال") ? text.slice(2) : text;
}

/** الحرف الأول المُحتسب في اللعبة */
export function firstLetterOf(input: string): string {
  const n = stripAl(normalizeArabic(input));
  return n.charAt(0);
}

/** هل النص عربي خالص (حروف ومسافات فقط)؟ */
export function isArabicText(input: string): boolean {
  return /^[؀-ۿ\s]+$/.test(input);
}

/** كلمة "معقولة" تصلح للاحتساب حتى لو خارج القاموس */
export function isPlausibleWord(normalized: string): boolean {
  const t = normalized.replace(/\s/g, "");
  if (t.length < 2 || t.length > 22) return false;
  if (/^(.)\1{2,}$/.test(t)) return false; // بببب
  if (t.split(" ").length > 3) return false;
  return /^[ابتثجحخدذرزسشصضطظعغفقكلمنهوي\s]+$/.test(t);
}

/** مسافة ليفنشتاين لتصحيح الأخطاء الإملائية */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (!la) return lb;
  if (!lb) return la;
  if (Math.abs(la - lb) > 2) return 3;
  let prev = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    let cur = i;
    let prevDiag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= lb; j++) {
      const tmp = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, cur + 1, prevDiag + cost);
      cur = prev[j];
      prevDiag = tmp;
    }
  }
  return prev[lb];
}

/** حد التصحيح المقبول حسب طول الكلمة (متحفظ — عشان كلمة تانية ما تتحولش لكلمة تالتة) */
export function correctionThreshold(len: number): number {
  if (len <= 5) return 1;
  if (len <= 7) return 2;
  return 3;
}
