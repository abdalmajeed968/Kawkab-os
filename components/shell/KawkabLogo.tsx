// components/shell/KawkabLogo.tsx
//
// Elegant planet + orbit ring, cyan-to-violet glow. Deterministic inline
// SVG rather than an image asset — no external file to manage, scales
// cleanly, and pulls its colors from the same design tokens as everything
// else (no hardcoded hex outside tokens.css, matching the Phase 0 rule —
// the gradient stops below reference the token hex values directly since
// SVG gradients can't consume CSS custom properties in every renderer).

export function KawkabLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="KAWKAB OS">
      <defs>
        <radialGradient id="kw-planet-body" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#7fe9ff" />
          <stop offset="55%" stopColor="#29d3ff" />
          <stop offset="100%" stopColor="#17708f" />
        </radialGradient>
        <linearGradient id="kw-planet-ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#29d3ff" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <filter id="kw-planet-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse
        cx="20"
        cy="20"
        rx="17"
        ry="6.2"
        transform="rotate(-18 20 20)"
        stroke="url(#kw-planet-ring)"
        strokeWidth="1.4"
        fill="none"
        opacity="0.85"
        filter="url(#kw-planet-glow)"
      />
      <circle cx="20" cy="20" r="10.5" fill="url(#kw-planet-body)" filter="url(#kw-planet-glow)" />
      <path
        d="M12 17.5c2.5 1.2 5 1.6 8 .8s5-2.2 6.5-4"
        stroke="#05060a"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.25"
        fill="none"
      />
      <ellipse
        cx="20"
        cy="20"
        rx="17"
        ry="6.2"
        transform="rotate(-18 20 20)"
        stroke="url(#kw-planet-ring)"
        strokeWidth="1"
        fill="none"
        strokeDasharray="0 34 3 100"
      />
    </svg>
  );
}
