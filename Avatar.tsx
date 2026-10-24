/** صورة اللاعب — بتقع على أول حرف من اسمه لو مفيش صورة */
export default function Avatar({
  src, name, size = 40, ring = false, className = "",
}: {
  src?: string;
  name?: string;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const letter = (name ?? "").trim().charAt(0) || "؟";
  // لون ثابت مشتق من الاسم
  const hues = ["#e8b563", "#6bc9a0", "#7fb3d5", "#d998b8", "#a898d0", "#ff8f6b"];
  let h = 0;
  for (let i = 0; i < (name ?? "").length; i++) h = (h * 31 + (name ?? "").charCodeAt(i)) % 997;
  const bg = hues[h % hues.length];

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 ${ring ? "ring-2 ring-amber-300/70" : "ring-1 ring-white/15"} ${className}`}
      style={{ width: size, height: size, background: src ? "#1b2338" : `${bg}2e` }}
      aria-label={name}
    >
      {src ? (
        <img src={src} alt={name ?? "لاعب"} className="w-full h-full object-cover" draggable={false} />
      ) : (
        <span className="font-display font-extrabold leading-none" style={{ color: bg, fontSize: size * 0.44 }}>
          {letter}
        </span>
      )}
    </span>
  );
}
