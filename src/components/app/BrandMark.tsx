export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="bm-shell" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2a31" />
          <stop offset="1" stopColor="#111114" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="url(#bm-shell)" stroke="rgba(255,255,255,0.12)" />
      <path d="M10 13 h12 l-1.6 8.4 a3 3 0 0 1 -3 2.6 h-2.8 a3 3 0 0 1 -3 -2.6 z" fill="#f2ebdd" />
      <path d="M11.2 13 h9.6" stroke="#7a4b2e" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="16" cy="8" r="1.6" fill="#c8f33c" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="font-semibold tracking-[0.08em]">BREW</span>
      <span className="text-lime">.</span>
      <span className="font-semibold tracking-[0.08em]">OS</span>
    </span>
  );
}
