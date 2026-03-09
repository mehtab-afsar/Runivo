interface RunivoLogoProps {
  size?: number;
  /** Show the "runivo" wordmark next to the hex */
  wordmark?: boolean;
  className?: string;
}

/**
 * The Runivo hollow-hexagon logo.
 * Right 3 edges = full teal (dark side).
 * Left 3 edges = faded teal (light side).
 * No fill — stroke only.
 */
export function RunivoLogo({ size = 32, wordmark = false, className = '' }: RunivoLogoProps) {
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
          color: '#0F172A',
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
function HexSvg({ size, className = '' }: { size: number; className?: string }) {
  const sw = 7; // stroke width in viewBox units

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      style={{ flexShrink: 0 }}
    >
      {/* Dark side — right 3 edges: Top → TR → BR → Bot */}
      <path
        d="M 50,6 L 88.1,28 L 88.1,72 L 50,94"
        stroke="#0891B2"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Light side — left 3 edges: Bot → BL → TL → Top */}
      <path
        d="M 50,94 L 11.9,72 L 11.9,28 L 50,6"
        stroke="#0891B2"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.28}
      />
    </svg>
  );
}
