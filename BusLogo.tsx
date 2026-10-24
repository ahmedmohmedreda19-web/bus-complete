import { useId } from "react";
import { getSkin } from "../data/shop";

/**
 * لوجو الأتوبيس بشباك بانورامي واحد كبير.
 * صورة اللاعب بتظهر **كاملة** جوه الشباك (من غير قص) بلمسة سينمائية:
 * انعكاس زجاج + لمعة عابرة + اهتزاز خفيف مع حركة الأتوبيس.
 */
export default function BusLogo({
  skinId = "classic",
  avatar = "",
  name = "",
}: {
  skinId?: string;
  avatar?: string;
  name?: string;
}) {
  const skin = getSkin(skinId);
  const uid = useId().replace(/:/g, "");

  // شباك بانورامي كبير
  const win = { x: 44, y: 22, w: 144, h: 62, r: 12 };
  // الصورة مربعة وبتظهر كاملة جوه الشباك
  const pad = 3;
  const photo = { s: win.h - pad * 2, y: win.y + pad };
  const photoX = win.x + (win.w - photo.s) / 2;
  const initial = (name || "").trim().charAt(0);

  return (
    <div className="relative w-56 h-[9.5rem] mx-auto bus-bounce" aria-hidden>
      <svg viewBox="0 0 220 150" className="w-full h-full" style={{ filter: `drop-shadow(0 12px 22px ${skin.glow})` }}>
        <defs>
          <clipPath id={`win-${uid}`}>
            <rect x={win.x} y={win.y} width={win.w} height={win.h} rx={win.r} />
          </clipPath>
          <clipPath id={`photo-${uid}`}>
            <rect x={photoX} y={photo.y} width={photo.s} height={photo.s} rx="9" />
          </clipPath>
          {/* انعكاس الزجاج */}
          <linearGradient id={`glass-${uid}`} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.26" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="70%" stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#141b2e" stopOpacity="0.28" />
          </linearGradient>
          {/* لمعة عابرة */}
          <linearGradient id={`shine-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          {/* داخل الأتوبيس */}
          <linearGradient id={`cabin-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#333d5c" />
            <stop offset="100%" stopColor="#1e2739" />
          </linearGradient>
        </defs>

        {/* دخان */}
        <g>
          <circle cx="16" cy="112" r="7" fill="rgba(255,255,255,.18)" className="smoke-puff" />
          <circle cx="12" cy="116" r="5" fill="rgba(255,255,255,.14)" className="smoke-puff" style={{ animationDelay: ".5s" }} />
          <circle cx="20" cy="108" r="4" fill="rgba(255,255,255,.18)" className="smoke-puff" style={{ animationDelay: "1s" }} />
        </g>

        {/* جسم الأتوبيس */}
        <rect x="24" y="12" width="184" height="92" rx="22" fill={skin.body} />
        <rect x="24" y="88" width="184" height="13" fill={skin.side} />

        {/* الشباك البانورامي */}
        <rect x={win.x} y={win.y} width={win.w} height={win.h} rx={win.r} fill={`url(#cabin-${uid})`} />

        {avatar ? (
          <g clipPath={`url(#win-${uid})`}>
            {/* الصورة كاملة جوه الشباك */}
            <g clipPath={`url(#photo-${uid})`} className="rider-sway">
              <image
                href={avatar}
                x={photoX}
                y={photo.y}
                width={photo.s}
                height={photo.s}
                preserveAspectRatio="xMidYMid meet"
              />
            </g>
            <rect
              x={photoX} y={photo.y} width={photo.s} height={photo.s} rx="9"
              fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="1.2"
            />
            {/* زجاج ولمعة */}
            <rect x={win.x} y={win.y} width={win.w} height={win.h} fill={`url(#glass-${uid})`} />
            <rect
              x={win.x - 34} y={win.y} width="22" height={win.h}
              fill={`url(#shine-${uid})`} className="glass-shine-wide"
            />
          </g>
        ) : initial ? (
          <g clipPath={`url(#win-${uid})`}>
            <text
              x={win.x + win.w / 2}
              y={win.y + win.h / 2 + 12}
              textAnchor="middle"
              className="rider-sway"
              style={{ fontFamily: "Changa, sans-serif", fontWeight: 800, fontSize: 34, fill: skin.body }}
            >
              {initial}
            </text>
            <rect x={win.x} y={win.y} width={win.w} height={win.h} fill={`url(#glass-${uid})`} />
          </g>
        ) : null}

        {/* إطار الشباك */}
        <rect
          x={win.x} y={win.y} width={win.w} height={win.h} rx={win.r}
          fill="none"
          stroke={avatar ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.18)"}
          strokeWidth="1.8"
        />

        {/* أنوار */}
        <circle cx="200" cy="94" r="5" fill="#f2e6c9" />
        <rect x="24" y="92" width="10" height="6" rx="3" fill="#dd8f8f" />

        {/* عجلات */}
        <g className="wheel-spin">
          <circle cx="72" cy="110" r="17" fill="#1b2338" stroke="#4a5578" strokeWidth="4.5" />
          <circle cx="72" cy="110" r="6" fill={skin.body} />
          <path d="M72 93 V127 M55 110 H89" stroke="#4a5578" strokeWidth="3.2" />
        </g>
        <g className="wheel-spin">
          <circle cx="164" cy="110" r="17" fill="#1b2338" stroke="#4a5578" strokeWidth="4.5" />
          <circle cx="164" cy="110" r="6" fill={skin.body} />
          <path d="M164 93 V127 M147 110 H181" stroke="#4a5578" strokeWidth="3.2" />
        </g>
      </svg>
    </div>
  );
}
