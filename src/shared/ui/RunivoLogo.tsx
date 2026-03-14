interface RunivoLogoProps {
  size?: number;
  /** Show the "runivo" wordmark next to the hex */
  wordmark?: boolean;
  /** Use light-colored wordmark (for dark/teal backgrounds) */
  onDark?: boolean;
  className?: string;
}

/**
 * The Runivo logo.
 * Pointy-top hexagon with:
 *   - Subtle teal fill
 *   - Right 3 edges = full teal (dark side)
 *   - Left 3 edges = faded teal (light side)
 *   - Small GPS dot at center
 *   - Inner hex outline for depth
 */
export function RunivoLogo({ size = 32, wordmark = false, onDark = false, className = '' }: RunivoLogoProps) {
  if (wordmark) {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <HexSvg size={size} />
        <span style={{
          fontSize: size * 0.72,
          lineHeight: 1,
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontStyle: 'italic',
          fontWeight: 600,
          letterSpacing: '0.01em',
          color: onDark ? 'rgba(255,255,255,0.92)' : '#0F172A',
        }}>
          Run<span style={{ color: '#0891B2' }}>ivo</span>
        </span>
      </div>
    );
  }

  return <HexSvg size={size} className={className} />;
}

// Pointy-top hexagon vertices (r=44, center 50,50):
// Top=50,6  TR=88.1,28  BR=88.1,72  Bot=50,94  BL=11.9,72  TL=11.9,28
// Inner hex vertices (r=24, center 50,50):
// Top=50,26  TR=70.8,38  BR=70.8,62  Bot=50,74  BL=29.2,62  TL=29.2,38
function HexSvg({ size, className = '' }: { size: number; className?: string }) {
  const sw = 7;   // outer stroke width
  const isw = 2;  // inner stroke width

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      style={{ flexShrink: 0 }}
    >
      {/* Subtle background fill */}
      <path
        d="M 50,6 L 88.1,28 L 88.1,72 L 50,94 L 11.9,72 L 11.9,28 Z"
        fill="#0891B2"
        opacity={0.07}
      />

      {/* Inner hex — depth layer */}
      <path
        d="M 50,26 L 70.8,38 L 70.8,62 L 50,74 L 29.2,62 L 29.2,38 Z"
        stroke="#0891B2"
        strokeWidth={isw}
        strokeLinejoin="round"
        opacity={0.18}
      />

      {/* Light side — left 3 edges: Bot → BL → TL → Top */}
      <path
        d="M 50,94 L 11.9,72 L 11.9,28 L 50,6"
        stroke="#0891B2"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.32}
      />

      {/* Dark side — right 3 edges: Top → TR → BR → Bot */}
      <path
        d="M 50,6 L 88.1,28 L 88.1,72 L 50,94"
        stroke="#0891B2"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* GPS center dot */}
      <circle cx="50" cy="50" r="4.5" fill="#0891B2" opacity={0.6} />
      <circle cx="50" cy="50" r="2" fill="#0891B2" />
    </svg>
  );
}
