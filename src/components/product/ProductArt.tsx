import { useId } from "react";
import { CakeSlice, Candy, Cookie, Croissant, Milk, Sandwich } from "lucide-react";
import type { DrinkVisual, PackagedIcon, Product, VesselType } from "@/types";
import { cn } from "@/lib/cn";

interface VesselShape {
  body: string;
  rimY: number;
  bottomY: number;
  rimLeft: number;
  rimRight: number;
  handle?: { d: string; width: number };
  saucer?: { cy: number; rx: number };
  transparent: boolean;
}

const VESSELS: Record<VesselType, VesselShape> = {
  demitasse: {
    body: "M38 62 L82 62 L78 85 Q76.5 92 69 92 L51 92 Q43.5 92 42 85 Z",
    rimY: 62,
    bottomY: 92,
    rimLeft: 38,
    rimRight: 82,
    handle: { d: "M80.5 68 q12 -1 10.5 9 q-1.5 7.5 -13 6.5", width: 3.2 },
    saucer: { cy: 94, rx: 31 },
    transparent: false,
  },
  cup: {
    body: "M30 50 L90 50 L84.5 86 Q82.5 95 72 95 L48 95 Q37.5 95 35.5 86 Z",
    rimY: 50,
    bottomY: 95,
    rimLeft: 30,
    rimRight: 90,
    handle: { d: "M87.5 58 q15 -1 13 12 q-2 10.5 -16.5 8.5", width: 3.6 },
    saucer: { cy: 97, rx: 41 },
    transparent: false,
  },
  mug: {
    body: "M33 40 L85 40 L85 90 Q85 99 76 99 L42 99 Q33 99 33 90 Z",
    rimY: 40,
    bottomY: 99,
    rimLeft: 33,
    rimRight: 85,
    handle: { d: "M85 52 q16 0 16 14 q0 14 -16 14", width: 6 },
    transparent: false,
  },
  glass: {
    body: "M40 24 L80 24 L76 97 Q75.5 101 71 101 L49 101 Q44.5 101 44 97 Z",
    rimY: 24,
    bottomY: 101,
    rimLeft: 40,
    rimRight: 80,
    transparent: true,
  },
  iced: {
    body: "M37 22 L83 22 L77.5 98 Q76.8 102 72 102 L48 102 Q43.2 102 42.5 98 Z",
    rimY: 22,
    bottomY: 102,
    rimLeft: 37,
    rimRight: 83,
    transparent: true,
  },
};

interface DrinkArtProps {
  visual: DrinkVisual;
  hot?: boolean;
  animated?: boolean;
  className?: string;
  /** 0–1 fill multiplier for transparent vessels. */
  fill?: number;
}

/** A drink drawn from its recipe layers — no stock photography. */
export function DrinkArt({ visual, hot = true, animated = false, className, fill = 1 }: DrinkArtProps) {
  const uid = useId().replace(/:/g, "");
  const v = VESSELS[visual.vessel];
  const innerTop = v.rimY + (v.transparent ? 8 : 0);
  const innerH = v.bottomY - innerTop;

  const stacked = visual.layers.reduce<Array<{ y: number; h: number; color: string }>>((acc, layer) => {
    const h = layer.ratio * innerH * fill;
    const below = acc.length ? acc[acc.length - 1].y : v.bottomY;
    return [...acc, { y: below - h, h, color: layer.color }];
  }, []);
  const cursor = stacked.length ? stacked[stacked.length - 1].y : v.bottomY;
  const layers = stacked.map((l, i) => <rect key={i} x={0} y={l.y} width={120} height={l.h + 0.6} fill={l.color} />);
  const foamH = visual.foam ? innerH * 0.1 * fill : 0;
  const surfaceColor = visual.foam ?? visual.layers[visual.layers.length - 1]?.color ?? "#3b2216";

  return (
    <svg viewBox="0 0 120 120" className={cn("overflow-visible", className)} aria-hidden>
      <defs>
        <radialGradient id={`glow-${uid}`} cx="50%" cy="85%" r="55%">
          <stop offset="0%" stopColor={visual.accent} stopOpacity="0.38" />
          <stop offset="100%" stopColor={visual.accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`ceramic-${uid}`} x1="0" x2="1">
          <stop offset="0%" stopColor="#d9d1c2" />
          <stop offset="35%" stopColor="#f4eee3" />
          <stop offset="70%" stopColor="#e2dace" />
          <stop offset="100%" stopColor="#a69d8e" />
        </linearGradient>
        <linearGradient id={`glass-${uid}`} x1="0" x2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="20%" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="80%" stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.14" />
        </linearGradient>
        <clipPath id={`clip-${uid}`}>
          <path d={v.body} />
        </clipPath>
      </defs>

      <ellipse cx="60" cy="104" rx="46" ry="16" fill={`url(#glow-${uid})`} />
      <ellipse cx="60" cy={(v.saucer?.cy ?? v.bottomY) + 4} rx={v.saucer ? v.saucer.rx - 4 : 26} ry="3.5" fill="#000" opacity="0.55" />

      {v.saucer && (
        <g>
          <ellipse cx="60" cy={v.saucer.cy} rx={v.saucer.rx} ry="5.5" fill="#cfc6b6" />
          <ellipse cx="60" cy={v.saucer.cy - 1} rx={v.saucer.rx - 6} ry="3.4" fill="#e9e2d5" />
        </g>
      )}

      {v.handle && !v.transparent && (
        <path d={v.handle.d} fill="none" stroke="#d8d0c1" strokeWidth={v.handle.width} strokeLinecap="round" />
      )}

      {v.transparent ? (
        <g>
          <g clipPath={`url(#clip-${uid})`}>
            {layers}
            {visual.foam && <rect x={0} y={cursor - foamH} width={120} height={foamH + 0.6} fill={visual.foam} />}
            {visual.garnish === "ice" && fill > 0.2 && (
              <g opacity="0.75">
                <rect x="47" y={cursor - foamH + 4} width="12" height="11" rx="2.5" fill="#ffffff" fillOpacity="0.32" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.6" transform={`rotate(-12 53 ${cursor})`} />
                <rect x="61" y={cursor - foamH + 9} width="11" height="10" rx="2.5" fill="#ffffff" fillOpacity="0.28" stroke="#fff" strokeOpacity="0.45" strokeWidth="0.6" transform={`rotate(14 66 ${cursor + 10})`} />
                <rect x="52" y={cursor - foamH + 20} width="10" height="9" rx="2" fill="#ffffff" fillOpacity="0.22" />
              </g>
            )}
          </g>
          <path d={v.body} fill={`url(#glass-${uid})`} stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1" />
          <line x1={v.rimLeft + 4} y1={v.rimY + 6} x2={v.rimLeft + 7.5} y2={v.bottomY - 8} stroke="#fff" strokeOpacity="0.25" strokeWidth="1.6" strokeLinecap="round" />
          {visual.vessel === "iced" && <line x1="70" y1="6" x2="63" y2="70" stroke={visual.accent} strokeWidth="3" strokeLinecap="round" opacity="0.9" />}
          {visual.garnish === "lemon" && (
            <g transform={`translate(${v.rimRight - 6} ${v.rimY + 2})`}>
              <circle r="9" fill="#f2d24b" stroke="#e7b92c" strokeWidth="1.5" />
              <path d="M0 -7 V7 M-7 0 H7 M-5 -5 L5 5 M5 -5 L-5 5" stroke="#fff4b8" strokeWidth="0.8" />
            </g>
          )}
        </g>
      ) : (
        <g>
          <path d={v.body} fill={`url(#ceramic-${uid})`} />
          <ellipse cx="60" cy={v.rimY} rx={(v.rimRight - v.rimLeft) / 2} ry="4.6" fill="#cbc2b3" />
          <ellipse cx="60" cy={v.rimY + 0.6} rx={(v.rimRight - v.rimLeft) / 2 - 2.4} ry="3.4" fill={surfaceColor} />
          {visual.foam && visual.layers.length > 1 && (
            <path
              d={`M${60 - 7} ${v.rimY - 0.4} q7 -3.4 7 1.2 q0 -4.6 7 -1.2 q-3 3.2 -7 4 q-4 -0.8 -7 -4 z`}
              fill={visual.layers[visual.layers.length - 1].color}
              opacity="0.55"
            />
          )}
          {visual.garnish === "cocoa" && (
            <g fill="#3a1d10" opacity="0.7">
              <circle cx="52" cy={v.rimY + 0.5} r="0.9" />
              <circle cx="58" cy={v.rimY - 0.8} r="0.7" />
              <circle cx="64" cy={v.rimY + 1} r="0.9" />
              <circle cx="69" cy={v.rimY} r="0.6" />
              <circle cx="56" cy={v.rimY + 1.6} r="0.6" />
            </g>
          )}
          {visual.garnish === "spice" && (
            <g transform={`translate(${v.rimRight - 4} ${v.saucer ? v.saucer.cy - 3 : v.bottomY})`}>
              <path d="M0 -5 L1.4 -1.4 L5 0 L1.4 1.4 L0 5 L-1.4 1.4 L-5 0 L-1.4 -1.4 Z" fill="#7b4a26" />
            </g>
          )}
          {visual.garnish === "leaf" && (
            <path d={`M${v.rimRight + 2} ${(v.saucer?.cy ?? v.bottomY) - 4} q8 -10 16 -2 q-8 8 -16 2 z`} fill="#8fae3e" />
          )}
          <path d={v.body} fill="none" stroke="#000" strokeOpacity="0.08" />
        </g>
      )}

      {hot && (
        <g opacity="0.85" className={animated ? undefined : "hidden"}>
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M${52 + i * 8} ${v.rimY - 6} q-4 -6 0 -12 q4 -6 0 -12`}
              fill="none"
              stroke="#f2ebdd"
              strokeOpacity="0.35"
              strokeWidth="2"
              strokeLinecap="round"
              className="anim-steam"
              style={{ animationDelay: `${i * 0.7}s`, transformBox: "fill-box", transformOrigin: "center bottom" }}
            />
          ))}
        </g>
      )}
    </svg>
  );
}

const PACKAGED_ICONS: Record<PackagedIcon, typeof Milk> = {
  water: Milk,
  chocolate: Candy,
  cookie: Cookie,
  croissant: Croissant,
  muffin: CakeSlice,
  sandwich: Sandwich,
};

export function PackagedArt({ icon, accent, className }: { icon: PackagedIcon; accent: string; className?: string }) {
  const Icon = PACKAGED_ICONS[icon];
  return (
    <div className={cn("relative flex items-center justify-center", className)} aria-hidden>
      <div className="absolute inset-[18%] rounded-full blur-2xl" style={{ background: accent, opacity: 0.22 }} />
      <div
        className="relative flex aspect-square w-[58%] items-center justify-center rounded-[22%] border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.01] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_18px_30px_-12px_rgba(0,0,0,0.9)]"
      >
        <Icon className="size-[46%]" strokeWidth={1.4} style={{ color: accent }} />
      </div>
    </div>
  );
}

export function ProductArt({ product, className, animated = false }: { product: Product; className?: string; animated?: boolean }) {
  if (product.kind === "packaged_item") return <PackagedArt icon={product.icon} accent={product.accent} className={className} />;
  return <DrinkArt visual={product.visual} hot={product.temperature === "hot"} animated={animated} className={className} />;
}
