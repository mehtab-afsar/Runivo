export function HexagonLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <polygon
        points="16,2 28,9 28,23 16,30 4,23 4,9"
        stroke="#C8391A"
        strokeWidth="1.5"
        fill="none"
      />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontSize="13"
        fill="#FFFFFF"
        fontStyle="italic"
      >
        R
      </text>
    </svg>
  );
}
