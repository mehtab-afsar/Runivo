const CRIMSON = '#E8435A';

interface RunivoLogoProps {
  size?: number;
  /** Show the "runivo" wordmark next to the hex */
  wordmark?: boolean;
  /** Use light-colored wordmark (for dark backgrounds) */
  onDark?: boolean;
  className?: string;
  /** Animate the hex draw-on (for splash/onboarding) */
  animate?: boolean;
}

/**
 * The Runivo logo.
 * Two open polylines forming a split hex — left side faded crimson, right side full crimson.
 */
export function RunivoLogo({ size = 32, wordmark = false, onDark = false, className = '', animate = false }: RunivoLogoProps) {
  if (wordmark) {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <HexSvg size={size} animate={animate} />
        <span style={{
          fontSize: size * 0.72,
          lineHeight: 1,
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontStyle: 'normal',
          fontWeight: 600,
          letterSpacing: '0.01em',
          color: onDark ? 'rgba(255,255,255,0.92)' : '#1A1A1A',
        }}>
          run<span style={{ color: CRIMSON }}>ivo</span>
        </span>
      </div>
    );
  }

  return <HexSvg size={size} animate={animate} className={className} />;
}

function HexSvg({ size, animate = false, className = '' }: { size: number; animate?: boolean; className?: string }) {
  const dashLen = '220';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      style={{ flexShrink: 0 }}
    >
      {/* Left side — faded */}
      <polyline
        points="50,4 10.2,27 10.2,73 50,96"
        stroke={CRIMSON}
        strokeWidth="5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.3"
        strokeDasharray={animate ? dashLen : undefined}
        strokeDashoffset={animate ? dashLen : undefined}
        style={animate ? { animation: 'hexDraw 1s 0.3s cubic-bezier(0.16,1,0.3,1) forwards' } : undefined}
      />
      {/* Right side — full */}
      <polyline
        points="50,4 89.8,27 89.8,73 50,96"
        stroke={CRIMSON}
        strokeWidth="5"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={animate ? dashLen : undefined}
        strokeDashoffset={animate ? dashLen : undefined}
        style={animate ? { animation: 'hexDraw 1s 0.5s cubic-bezier(0.16,1,0.3,1) forwards' } : undefined}
      />
    </svg>
  );
}
