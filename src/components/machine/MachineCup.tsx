import { useId } from "react";
import type { DrinkVisual } from "@/types";

/** Clear disposable cup that visibly fills with a drink's layers. */
export function MachineCup({ visual, fill, hot }: { visual: DrinkVisual; fill: number; hot: boolean }) {
  const uid = useId().replace(/:/g, "");
  const top = 8;
  const bottom = 93;
  const innerH = bottom - top;
  const ratioSum = visual.layers.reduce((s, l) => s + l.ratio, 0) + (visual.foam ? 0.1 : 0);
  const scale = (0.86 / Math.max(ratioSum, 0.01)) * fill;

  const stacked = visual.layers.reduce<Array<{ y: number; h: number; color: string }>>((acc, layer) => {
    const h = layer.ratio * innerH * scale;
    const below = acc.length ? acc[acc.length - 1].y : bottom;
    return [...acc, { y: below - h, h, color: layer.color }];
  }, []);
  const surface = stacked.length ? stacked[stacked.length - 1].y : bottom;
  const foamH = visual.foam ? 0.1 * innerH * scale : 0;

  return (
    <svg viewBox="0 0 70 100" className="h-full w-full overflow-visible" aria-hidden>
      <defs>
        <clipPath id={`cup-${uid}`}>
          <path d="M5 6 L65 6 L57.5 92 Q57 96 53 96 L17 96 Q13 96 12.5 92 Z" />
        </clipPath>
        <linearGradient id={`cupglass-${uid}`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.25" stopColor="#fff" stopOpacity="0.05" />
          <stop offset="0.8" stopColor="#fff" stopOpacity="0.03" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.16" />
        </linearGradient>
      </defs>
      <ellipse cx="35" cy="97" rx="24" ry="3" fill="#000" opacity="0.6" />
      <g clipPath={`url(#cup-${uid})`}>
        {stacked.map((l, i) => (
          <rect key={i} x="0" y={l.y} width="70" height={l.h + 0.5} fill={l.color} />
        ))}
        {foamH > 0 && <rect x="0" y={surface - foamH} width="70" height={foamH + 0.5} fill={visual.foam} />}
        {visual.garnish === "ice" && fill > 0.3 && (
          <g fill="#fff" fillOpacity="0.25" stroke="#fff" strokeOpacity="0.4" strokeWidth="0.5">
            <rect x="20" y={surface - foamH + 3} width="11" height="10" rx="2" transform={`rotate(-10 25 ${surface})`} />
            <rect x="36" y={surface - foamH + 7} width="10" height="9" rx="2" transform={`rotate(12 41 ${surface})`} />
          </g>
        )}
      </g>
      <path d="M5 6 L65 6 L57.5 92 Q57 96 53 96 L17 96 Q13 96 12.5 92 Z" fill={`url(#cupglass-${uid})`} stroke="#fff" strokeOpacity="0.45" strokeWidth="0.9" />
      <ellipse cx="35" cy="6" rx="30" ry="2.6" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.9" />
      <rect x="15" y="40" width="40" height="9" fill="#0c0c0e" fillOpacity="0.75" />
      <text x="35" y="46.6" textAnchor="middle" fontSize="5" fontFamily="ui-monospace, monospace" letterSpacing="1.2" fill="#f2ebdd">
        BREW.OS
      </text>
      <line x1="9" y1="12" x2="15" y2="86" stroke="#fff" strokeOpacity="0.3" strokeWidth="1.4" strokeLinecap="round" />
      {hot && fill > 0.45 && (
        <g>
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M${26 + i * 9} 0 q-4 -6 0 -12 q4 -6 0 -12`}
              fill="none"
              stroke="#f2ebdd"
              strokeOpacity="0.32"
              strokeWidth="2"
              strokeLinecap="round"
              className="anim-steam"
              style={{ animationDelay: `${i * 0.6}s`, transformBox: "fill-box", transformOrigin: "center bottom" }}
            />
          ))}
        </g>
      )}
    </svg>
  );
}
