interface Props {
  size?: number;
  color?: string;
  opacity?: number;
}

export function HexWatermark({ size = 200, color = '#0A0A0A', opacity = 0.05 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ opacity }} fill="none">
      <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" stroke={color} strokeWidth="2" />
    </svg>
  );
}
