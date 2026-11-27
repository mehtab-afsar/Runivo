import Link from 'next/link';

/**
 * The Runivo mark: a closed amber hexagon outline, pointy top, round joins. Same geometry
 * as the app (apps/mobile/src/shared/components/RunivoMark.tsx, `inline`): it fills its box.
 */
export function HexagonMark({ size = 28, color = 'var(--amber)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <path d="M32 4 56.2 18v28L32 60 7.8 46V18Z" stroke={color} strokeWidth="7" strokeLinejoin="round" />
    </svg>
  );
}

/** Mark + "runivo" wordmark (Outfit bold, lowercase), linking home. */
export function Logo({ size = 26, href = '/' }: { size?: number; href?: string | null }) {
  const inner = (
    <>
      <HexagonMark size={size} />
      <span className="wordmark" style={{ fontSize: Math.round(size * 0.92) }}>runivo</span>
    </>
  );
  return href === null
    ? <span className="logo">{inner}</span>
    : <Link href={href} className="logo" aria-label="Runivo home">{inner}</Link>;
}
