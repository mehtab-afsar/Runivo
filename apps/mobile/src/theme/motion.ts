export const Spring = {
  snappy: { damping: 18, stiffness: 260 },
  bouncy: { damping: 14, stiffness: 180 },
  gentle: { damping: 22, stiffness: 200 },
} as const;

export const Timing = {
  fast:   200,
  normal: 300,
  slow:   500,
} as const;
