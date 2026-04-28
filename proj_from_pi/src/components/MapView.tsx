/**
 * MapView — stylised dark Almaty street grid.
 * Pure CSS/SVG, no external map library.
 * Renders a simplified block of Абай / Байзақов area.
 */

interface MapViewProps {
  children?: React.ReactNode
}

export default function MapView({ children }: MapViewProps) {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#12141a' }}>
      {/* Street grid SVG */}
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        style={{ opacity: 0.85 }}
      >
        <defs>
          {/* City block texture */}
          <pattern id="grid" width="120" height="120" patternUnits="userSpaceOnUse">
            <rect width="120" height="120" fill="#12141a" />
            {/* block fill */}
            <rect x="8" y="8" width="104" height="104" fill="#181b24" rx="2" />
          </pattern>

          <pattern id="streets" width="120" height="120" patternUnits="userSpaceOnUse">
            {/* horizontal street */}
            <rect x="0" y="0" width="120" height="8" fill="#1e2130" />
            {/* vertical street */}
            <rect x="0" y="0" width="8" height="120" fill="#1e2130" />
            {/* road dashes */}
            <line x1="60" y1="0" x2="60" y2="4" stroke="#2a2f42" strokeWidth="1" strokeDasharray="3,5" />
            <line x1="0" y1="60" x2="4" y2="60" stroke="#2a2f42" strokeWidth="1" strokeDasharray="3,5" />
          </pattern>
        </defs>

        {/* Base grid */}
        <rect width="100%" height="100%" fill="url(#grid)" />
        <rect width="100%" height="100%" fill="url(#streets)" />

        {/* Major arteries — Абай ave (horizontal) */}
        <rect x="0" y="42%" width="100%" height="18" fill="#1a1e2e" />
        <rect x="0" y="42%" width="100%" height="2" fill="#252a3e" />
        <rect x="0" y="calc(42% + 16px)" width="100%" height="2" fill="#252a3e" />
        {/* Centre line dashes */}
        <line x1="0" y1="51%" x2="100%" y2="51%" stroke="#2e3450" strokeWidth="1" strokeDasharray="16,12" />

        {/* Байзақов st (vertical) */}
        <rect x="38%" y="0" width="18" height="100%" fill="#1a1e2e" />
        <rect x="38%" y="0" width="2" height="100%" fill="#252a3e" />
        <rect x="calc(38% + 16px)" y="0" width="2" height="100%" fill="#252a3e" />
        <line x1="47%" y1="0" x2="47%" y2="100%" stroke="#2e3450" strokeWidth="1" strokeDasharray="16,12" />

        {/* Minor side streets */}
        <rect x="0" y="22%" width="100%" height="7" fill="#171a27" />
        <rect x="0" y="68%" width="100%" height="7" fill="#171a27" />
        <rect x="18%" y="0" width="7" height="100%" fill="#171a27" />
        <rect x="62%" y="0" width="7" height="100%" fill="#171a27" />
        <rect x="80%" y="0" width="7" height="100%" fill="#171a27" />

        {/* Green park patch */}
        <rect x="62%" y="22%" width="18%" height="18%" fill="#141f18" rx="4" />
        <rect x="62%" y="22%" width="18%" height="18%" fill="#1a2e1e" rx="4" fillOpacity="0.6" />

        {/* Water body (Есентай river) */}
        <ellipse cx="80%" cy="70%" rx="8%" ry="4%" fill="#131d2a" />
        <ellipse cx="80%" cy="70%" rx="7%" ry="3%" fill="#152236" />

        {/* Street name labels */}
        <text x="50%" y="41%" textAnchor="middle" fill="#3a4060" fontSize="9" fontFamily="sans-serif" letterSpacing="2">
          АБАЙ ДАҢҒЫЛЫ
        </text>
        <text x="37%" y="25%" textAnchor="middle" fill="#3a4060" fontSize="8" fontFamily="sans-serif" letterSpacing="1"
          transform="rotate(-90 37% 25%) translate(0 -6)">
          БАЙЗАҚОВ
        </text>
        <text x="74%" y="31%" textAnchor="middle" fill="#213020" fontSize="8" fontFamily="sans-serif">
          ПАРК
        </text>
      </svg>

      {/* Subtle radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 50%, transparent 40%, rgba(10,12,18,0.7) 100%)',
        }}
      />

      {/* Slot for parking pin + panel */}
      {children}
    </div>
  )
}
