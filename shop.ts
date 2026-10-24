/* ===== كتالوج المحل ===== */

export const PRICES = { hint: 30, time: 20 } as const;

export interface TitleItem { id: string; label: string; price: number; desc: string; exclusive?: boolean; gemPrice?: number }

export const TITLES: TitleItem[] = [
  { id: "driver", label: "سوّاق متدرّب", price: 80, desc: "لسه بتلم الطريق" },
  { id: "conductor", label: "كمسري محترف", price: 150, desc: "بيجمع التذاكر والنقاط" },
  { id: "chief", label: "رئيس محطة", price: 300, desc: "الكل بيسلم عليه" },
  { id: "genius", label: "نابغة الكلمات", price: 450, desc: "قاموس بيجري في دمه" },
  { id: "legend", label: "أسطورة الأتوبيس", price: 700, desc: "مفيش حد لحقه أبد" },
  { id: "ach_cannon", label: "مدفع النقاط", price: 0, desc: "حصري لإنجاز المدفع", exclusive: true },
  { id: "ach_marksman", label: "عين الصقر", price: 0, desc: "حصري لخمس جولات بلا غلطة", exclusive: true },
  { id: "ach_week", label: "شعلة الأسبوع", price: 0, desc: "حصري لسلسلة ٧ أيام", exclusive: true },
  { id: "ach_month", label: "حارس الشهر", price: 0, desc: "حصري لسلسلة ٣٠ يوم", exclusive: true },
  { id: "ach_online", label: "بطل الأونلاين", price: 0, desc: "حصري لخمس انتصارات أونلاين", exclusive: true },
  { id: "ach_dictionary", label: "صاحب المعجم", price: 0, desc: "حصري لإضافة ١٠٠ كلمة", exclusive: true },
  { id: "ach_wordsea", label: "بحر الكلام", price: 0, desc: "حصري لكتابة ٥٠٠ كلمة", exclusive: true },
  { id: "ach_veteran", label: "راكب مخضرم", price: 0, desc: "حصري للعب ٢٥ جولة", exclusive: true },
  // ألقاب جوهرية — لا تُشترى إلا بالجواهر (نادرة جدًا وسعرها مرتفع)
  { id: "gem_emperor", label: "إمبراطور الأتوبيس", price: 0, gemPrice: 10, desc: "نادرة جدًا — ملك كل الرحلات", exclusive: true },
  { id: "gem_speaker", label: "نبغ الجُمل", price: 0, gemPrice: 15, desc: "نادرة جدًا — قاموس كامل في شكل لقب", exclusive: true },
  { id: "gem_lord", label: "سيد المحطات", price: 0, gemPrice: 20, desc: "نادرة جدًا — اسم ما ينسمعش كل يوم", exclusive: true },
];

export interface SkinItem { id: string; name: string; price: number; body: string; side: string; glow: string; rare?: boolean; gemPrice?: number }

export const SKINS: SkinItem[] = [
  { id: "classic", name: "الأصفر الكلاسيكي", price: 0, body: "#e8b563", side: "#c99347", glow: "rgba(232,181,99,0.26)" },
  { id: "fire", name: "الأحمر الهادي", price: 150, body: "#dd8f8f", side: "#b96b6b", glow: "rgba(221,143,143,0.26)" },
  { id: "sea", name: "الأخضر المائي", price: 150, body: "#6bc9a0", side: "#4a9d79", glow: "rgba(107,201,160,0.26)" },
  { id: "sky", name: "السماوي البارد", price: 150, body: "#7fb3d5", side: "#5a8dad", glow: "rgba(127,179,213,0.26)" },
  { id: "royal", name: "البنفسجي الملكي", price: 220, body: "#a898d0", side: "#7f6faa", glow: "rgba(168,152,208,0.28)" },
  { id: "pink", name: "البينك الشيك", price: 220, body: "#d998b8", side: "#b57492", glow: "rgba(217,152,184,0.28)" },
  // سكنات نادرة من عجلة الحظ فقط
  { id: "gold", name: "الذهبي الأسطوري", price: 0, body: "#e6c47a", side: "#bf9a4a", glow: "rgba(230,196,122,0.34)", rare: true },
  { id: "galaxy", name: "المجرّة", price: 0, body: "#8f8cc4", side: "#65629c", glow: "rgba(143,140,196,0.32)", rare: true },
  { id: "mint", name: "النعناعي النادر", price: 0, body: "#83d4bb", side: "#57a892", glow: "rgba(131,212,187,0.3)", rare: true },
  { id: "sunset", name: "الغروب الهادي", price: 0, body: "#dda98a", side: "#b57f60", glow: "rgba(221,169,138,0.3)", rare: true },
  // سكنات أسطورية — لا تُشترى إلا بالجواهر (أندر من سكنات العجلة)
  { id: "gem_onix", name: "الأونيكس", price: 0, gemPrice: 12, body: "#3a3444", side: "#1e1b26", glow: "rgba(90,80,110,0.5)", rare: true },
  { id: "gem_aurora", name: "الشفق", price: 0, gemPrice: 18, body: "#7f8ec4", side: "#54689e", glow: "rgba(127,142,196,0.5)", rare: true },
  { id: "gem_platinum", name: "البلاتيني", price: 0, gemPrice: 25, body: "#d8d2c8", side: "#a0988c", glow: "rgba(216,210,200,0.5)", rare: true },
];

export function getSkin(id: string): SkinItem {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}
