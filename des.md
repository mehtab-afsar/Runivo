

# Runivo: The Complete Evolution Roadmap

You've built an impressive foundation. Here's the comprehensive guide to take it from prototype to a premium, addictive product.

---

## Part 1: UI/UX Transformation (The Biggest Impact)

### Design Philosophy: "Dark, Alive, Tactile"

Running apps that feel premium (Nike Run Club, Strava) share traits: **dark themes, bold typography, generous spacing, and the map/data as hero elements.** Your game layer adds a unique dimension — territories should feel like a living, breathing battlefield.

### 1.1 — Establish a Design System First

Before touching any screen, lock down your tokens:

```typescript
// src/styles/tokens.ts
export const tokens = {
  colors: {
    // Dark-first palette
    bg: {
      primary: '#0A0A0F',      // near-black with blue undertone
      secondary: '#12121A',    // cards, sheets
      tertiary: '#1A1A25',     // elevated surfaces
      glass: 'rgba(18, 18, 26, 0.85)',
    },
    // Neon accent system — each territory faction gets a color
    accent: {
      primary: '#00F0FF',      // cyan — your territories
      secondary: '#FF3366',    // magenta — enemy territories
      tertiary: '#FFD700',     // gold — contested/neutral
      success: '#00FF88',      // green — achievements, PRs
      energy: '#FF6B00',       // orange — energy system
    },
    // Glow variants (for borders, shadows, map overlays)
    glow: {
      cyan: '0 0 20px rgba(0, 240, 255, 0.3)',
      magenta: '0 0 20px rgba(255, 51, 102, 0.3)',
      gold: '0 0 20px rgba(255, 215, 0, 0.3)',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#8888A0',
      tertiary: '#555568',
    },
  },
  typography: {
    // Use two font families for contrast
    heading: '"Plus Jakarta Sans", sans-serif',   // geometric, modern
    mono: '"JetBrains Mono", monospace',           // stats, numbers, data
    body: '"Inter", sans-serif',
  },
  spacing: {
    xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', xxl: '48px',
  },
  radius: {
    sm: '8px', md: '12px', lg: '16px', xl: '24px', full: '9999px',
  },
  // Motion timing curves
  motion: {
    bounce: [0.68, -0.55, 0.265, 1.55],
    smooth: [0.4, 0, 0.2, 1],
    snap: [0.2, 0, 0, 1],
  },
} as const;
```

```css
/* src/styles/globals.css — Add to your Tailwind config */
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --bg-primary: 10 10 15;
    --bg-secondary: 18 18 26;
    --bg-tertiary: 26 26 37;
    --accent-cyan: 0 240 255;
    --accent-magenta: 255 51 102;
    --accent-gold: 255 215 0;
    --accent-green: 0 255 136;
    --accent-orange: 255 107 0;
  }

  body {
    @apply bg-[#0A0A0F] text-white antialiased;
    font-family: 'Inter', sans-serif;
    -webkit-tap-highlight-color: transparent;
    overscroll-behavior: none;
  }

  /* Prevent pull-to-refresh on mobile */
  html, body {
    overflow: hidden;
    position: fixed;
    width: 100%;
    height: 100%;
  }

  #root {
    height: 100%;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
}

@layer utilities {
  .text-stat {
    font-family: 'JetBrains Mono', monospace;
    @apply tabular-nums tracking-tight;
  }

  .glass {
    background: rgba(18, 18, 26, 0.85);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .glass-light {
    background: rgba(26, 26, 37, 0.6);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  .glow-cyan {
    box-shadow: 0 0 20px rgba(0, 240, 255, 0.15),
                0 0 60px rgba(0, 240, 255, 0.05);
  }

  .glow-magenta {
    box-shadow: 0 0 20px rgba(255, 51, 102, 0.15),
                0 0 60px rgba(255, 51, 102, 0.05);
  }

  .border-glow {
    border: 1px solid rgba(0, 240, 255, 0.2);
  }

  /* Animated gradient border */
  .gradient-border {
    position: relative;
    background: var(--bg-secondary);
    border-radius: 16px;
  }
  .gradient-border::before {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(135deg, rgba(0,240,255,0.4), rgba(255,51,102,0.4));
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
  }
}
```

### 1.2 — Reusable Premium Components

Build these atomic components that every screen will use:

```tsx
// src/components/ui/StatCard.tsx
// The single most-used component in a running app — stat displays
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'hero' | 'compact';
  glowColor?: 'cyan' | 'magenta' | 'gold' | 'green' | 'orange';
  className?: string;
}

export function StatCard({
  label, value, unit, icon, trend, trendValue,
  variant = 'default', glowColor, className
}: StatCardProps) {
  const glowMap = {
    cyan: 'shadow-[0_0_30px_rgba(0,240,255,0.1)] border-cyan-500/20',
    magenta: 'shadow-[0_0_30px_rgba(255,51,102,0.1)] border-pink-500/20',
    gold: 'shadow-[0_0_30px_rgba(255,215,0,0.1)] border-yellow-500/20',
    green: 'shadow-[0_0_30px_rgba(0,255,136,0.1)] border-green-500/20',
    orange: 'shadow-[0_0_30px_rgba(255,107,0,0.1)] border-orange-500/20',
  };

  if (variant === 'hero') {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          'flex flex-col items-center justify-center py-6',
          className
        )}
      >
        <span className="text-[11px] uppercase tracking-[0.15em] text-white/40 font-medium mb-2">
          {label}
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-stat text-5xl font-bold text-white leading-none">
            {value}
          </span>
          {unit && (
            <span className="text-stat text-lg text-white/50 font-medium">
              {unit}
            </span>
          )}
        </div>
      </motion.div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex flex-col items-center py-3', className)}>
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/35 mb-1">
          {label}
        </span>
        <span className="text-stat text-xl font-semibold text-white">
          {value}
          {unit && <span className="text-sm text-white/50 ml-0.5">{unit}</span>}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      className={cn(
        'glass rounded-2xl p-4 flex flex-col gap-2',
        glowColor && glowMap[glowColor],
        'border border-white/[0.04]',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.15em] text-white/40 font-medium">
          {label}
        </span>
        {icon && <span className="text-white/30">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-stat text-2xl font-bold text-white">
          {value}
        </span>
        {unit && (
          <span className="text-stat text-sm text-white/40">{unit}</span>
        )}
      </div>
      {trend && trendValue && (
        <div className={cn(
          'flex items-center gap-1 text-xs font-medium',
          trend === 'up' && 'text-emerald-400',
          trend === 'down' && 'text-red-400',
          trend === 'neutral' && 'text-white/40',
        )}>
          {trend === 'up' && '↑'}
          {trend === 'down' && '↓'}
          {trendValue}
        </div>
      )}
    </motion.div>
  );
}
```

```tsx
// src/components/ui/BottomSheet.tsx
// Critical mobile pattern — replace all modals with bottom sheets
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { useRef, useEffect, ReactNode } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  snapPoints?: number[];  // percentages: [0.3, 0.6, 0.95]
  initialSnap?: number;
  title?: string;
  handle?: boolean;
}

export function BottomSheet({
  isOpen, onClose, children,
  snapPoints = [0.4, 0.85],
  initialSnap = 0,
  title,
  handle = true,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  const snapPositions = snapPoints.map(p => windowHeight * (1 - p));
  const initialY = snapPositions[initialSnap];

  const overlayOpacity = useTransform(
    y,
    [snapPositions[snapPositions.length - 1], windowHeight],
    [0.6, 0]
  );

  const handleDragEnd = (_: any, info: PanInfo) => {
    const currentY = y.get();
    const velocity = info.velocity.y;

    // Dismiss if swiped down fast or past threshold
    if (velocity > 500 || currentY > windowHeight * 0.75) {
      onClose();
      return;
    }

    // Snap to nearest snap point
    let closestSnap = snapPositions[0];
    let minDist = Infinity;
    for (const snap of snapPositions) {
      const dist = Math.abs(currentY - snap);
      if (dist < minDist) {
        minDist = dist;
        closestSnap = snap;
      }
    }
    // Animate to snap would be handled by the motion component
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-40"
        style={{ opacity: overlayOpacity }}
      />

      {/* Sheet */}
      <motion.div
        ref={sheetRef}
        initial={{ y: windowHeight }}
        animate={{ y: initialY }}
        exit={{ y: windowHeight }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        drag="y"
        dragConstraints={{
          top: snapPositions[snapPositions.length - 1],
          bottom: windowHeight,
        }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ y }}
        className="fixed left-0 right-0 bottom-0 z-50 flex flex-col
                   bg-[#12121A] rounded-t-3xl overflow-hidden
                   border-t border-white/[0.06]"
        // set max height
        style={{
          y,
          height: `${snapPoints[snapPoints.length - 1] * 100}vh`,
        }}
      >
        {/* Handle */}
        {handle && (
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>
        )}

        {/* Title */}
        {title && (
          <div className="px-6 py-3 border-b border-white/[0.04]">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-safe">
          {children}
        </div>
      </motion.div>
    </>
  );
}
```

```tsx
// src/components/ui/AnimatedCounter.tsx
// Numbers that animate when they change — essential for stat updates during runs
import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  decimals?: number;
  className?: string;
  duration?: number;
}

export function AnimatedCounter({
  value, decimals = 0, className = '', duration = 0.8
}: AnimatedCounterProps) {
  const spring = useSpring(0, {
    stiffness: 100,
    damping: 30,
    duration: duration * 1000,
  });

  const display = useTransform(spring, (v) => v.toFixed(decimals));
  const [displayValue, setDisplayValue] = useState(value.toFixed(decimals));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useEffect(() => {
    const unsubscribe = display.on('change', (v) => setDisplayValue(v));
    return unsubscribe;
  }, [display]);

  return (
    <motion.span className={className}>
      {displayValue}
    </motion.span>
  );
}
```

```tsx
// src/components/ui/TerritoryHex.tsx
// Animated hexagon for territory display
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type TerritoryStatus = 'owned' | 'enemy' | 'neutral' | 'contested' | 'claiming';

interface TerritoryHexProps {
  status: TerritoryStatus;
  size?: number;
  label?: string;
  defenseLevel?: number; // 0-100
  onClick?: () => void;
}

const statusColors: Record<TerritoryStatus, { fill: string; stroke: string; glow: string }> = {
  owned: {
    fill: 'rgba(0, 240, 255, 0.15)',
    stroke: 'rgba(0, 240, 255, 0.6)',
    glow: '0 0 20px rgba(0, 240, 255, 0.3)',
  },
  enemy: {
    fill: 'rgba(255, 51, 102, 0.15)',
    stroke: 'rgba(255, 51, 102, 0.6)',
    glow: '0 0 20px rgba(255, 51, 102, 0.3)',
  },
  neutral: {
    fill: 'rgba(255, 255, 255, 0.05)',
    stroke: 'rgba(255, 255, 255, 0.15)',
    glow: 'none',
  },
  contested: {
    fill: 'rgba(255, 215, 0, 0.15)',
    stroke: 'rgba(255, 215, 0, 0.6)',
    glow: '0 0 20px rgba(255, 215, 0, 0.3)',
  },
  claiming: {
    fill: 'rgba(0, 255, 136, 0.15)',
    stroke: 'rgba(0, 255, 136, 0.6)',
    glow: '0 0 20px rgba(0, 255, 136, 0.3)',
  },
};

export function TerritoryHex({ status, size = 60, label, defenseLevel, onClick }: TerritoryHexProps) {
  const colors = statusColors[status];

  return (
    <motion.div
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className="relative cursor-pointer"
      style={{ width: size, height: size * 1.15 }}
    >
      <svg viewBox="0 0 100 115" className="w-full h-full">
        {/* Glow filter */}
        <defs>
          <filter id={`glow-${status}`}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Hex shape */}
        <motion.polygon
          points="50,2 95,28 95,87 50,113 5,87 5,28"
          fill={colors.fill}
          stroke={colors.stroke}
          strokeWidth="2"
          filter={status !== 'neutral' ? `url(#glow-${status})` : undefined}
          animate={status === 'contested' ? {
            opacity: [0.5, 1, 0.5],
            strokeWidth: [2, 3, 2],
          } : status === 'claiming' ? {
            fillOpacity: [0.1, 0.3, 0.1],
          } : undefined}
          transition={{ duration: 2, repeat: Infinity }}
        />

        {/* Defense level indicator */}
        {defenseLevel !== undefined && (
          <motion.polygon
            points="50,2 95,28 95,87 50,113 5,87 5,28"
            fill="none"
            stroke={colors.stroke}
            strokeWidth="3"
            strokeDasharray={`${defenseLevel * 3.4} 340`}
            strokeLinecap="round"
            opacity={0.8}
          />
        )}
      </svg>

      {label && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-bold text-white/80">{label}</span>
        </div>
      )}
    </motion.div>
  );
}
```

### 1.3 — Screen-by-Screen UI Overhaul

**Active Run Screen (Your Most Critical Screen):**

```tsx
// src/components/pages/ActiveRun.tsx — Redesigned
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import maplibregl from 'maplibre-gl';
import { AnimatedCounter } from '../ui/AnimatedCounter';

// The key insight: during an active run, LESS is more.
// Show only what matters. Make it glanceable in 0.5 seconds.

export default function ActiveRun() {
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // Run state
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [pace, setPace] = useState('0:00');
  const [coords, setCoords] = useState<[number, number][]>([]);

  // Territory state
  const [currentZone, setCurrentZone] = useState<'owned' | 'enemy' | 'neutral' | null>(null);
  const [claimProgress, setClaimProgress] = useState(0);
  const [territoriesClaimed, setTerritoriesClaimed] = useState(0);

  // UI state
  const [showStats, setShowStats] = useState(true);
  const [showMapControls, setShowMapControls] = useState(false);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Zone color indicator at top of screen
  const zoneGradient = {
    owned: 'from-cyan-500/20 via-transparent',
    enemy: 'from-pink-500/20 via-transparent',
    neutral: 'from-white/5 via-transparent',
  };

  return (
    <div className="fixed inset-0 bg-black">
      {/* === MAP (Full Screen) === */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* === TERRITORY ZONE INDICATOR === */}
      {/* Subtle gradient at top shows what zone you're in */}
      <AnimatePresence mode="wait">
        {currentZone && (
          <motion.div
            key={currentZone}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b ${zoneGradient[currentZone]} pointer-events-none z-10`}
          />
        )}
      </AnimatePresence>

      {/* === CLAIM PROGRESS BAR === */}
      {/* Shows when actively claiming a territory */}
      <AnimatePresence>
        {claimProgress > 0 && claimProgress < 100 && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="absolute top-[env(safe-area-inset-top)] left-4 right-4 z-20"
          >
            <div className="glass rounded-2xl p-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-medium text-white/60">
                    Claiming Territory
                  </span>
                  <span className="text-stat text-xs text-cyan-400">
                    {claimProgress}%
                  </span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-cyan-400 to-cyan-300 rounded-full"
                    style={{ width: `${claimProgress}%` }}
                    transition={{ type: 'spring', stiffness: 50 }}
                  />
                </div>
              </div>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-8 h-8 rounded-full border-2 border-cyan-400/30 border-t-cyan-400"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === MAIN STATS PANEL === */}
      {/* Swipe up/down to show/hide. Glanceable. */}
      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute bottom-0 left-0 right-0 z-20"
          >
            <div className="glass rounded-t-3xl border-t border-white/[0.06] pb-safe">
              {/* Handle for dragging */}
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-8 h-1 rounded-full bg-white/20" />
              </div>

              {/* Primary stat: Distance (biggest, most glanceable) */}
              <div className="text-center pt-2 pb-4">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-stat text-6xl font-bold text-white tracking-tight">
                    <AnimatedCounter value={distance} decimals={2} />
                  </span>
                  <span className="text-stat text-xl text-white/40 font-medium">km</span>
                </div>
              </div>

              {/* Secondary stats row */}
              <div className="flex items-center justify-around px-6 pb-4 border-b border-white/[0.04]">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/35 mb-1">
                    Time
                  </span>
                  <span className="text-stat text-2xl font-semibold text-white">
                    {formatTime(elapsed)}
                  </span>
                </div>
                <div className="w-px h-10 bg-white/[0.06]" />
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/35 mb-1">
                    Pace
                  </span>
                  <span className="text-stat text-2xl font-semibold text-white">
                    {pace}
                    <span className="text-sm text-white/40 ml-1">/km</span>
                  </span>
                </div>
                <div className="w-px h-10 bg-white/[0.06]" />
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/35 mb-1">
                    Zones
                  </span>
                  <span className="text-stat text-2xl font-semibold text-cyan-400">
                    {territoriesClaimed}
                  </span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-6 py-5 px-6">
                {!isRunning ? (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsRunning(true)}
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-500
                               flex items-center justify-center
                               shadow-[0_0_40px_rgba(0,240,255,0.3)]"
                  >
                    <svg width="28" height="32" viewBox="0 0 28 32" fill="white">
                      <path d="M2 0L28 16L2 32V0Z" />
                    </svg>
                  </motion.button>
                ) : (
                  <>
                    {/* Lock/End button */}
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onLongPress={() => {
                        // Long press to end — prevent accidental taps
                        navigate(`/run-summary/new`, {
                          state: { distance, elapsed, pace, coords, territoriesClaimed }
                        });
                      }}
                      className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30
                                 flex items-center justify-center"
                    >
                      <div className="w-5 h-5 rounded-sm bg-red-400" />
                    </motion.button>

                    {/* Pause/Resume */}
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setIsPaused(!isPaused)}
                      className={`w-20 h-20 rounded-full flex items-center justify-center
                        ${isPaused
                          ? 'bg-gradient-to-br from-cyan-400 to-cyan-500 shadow-[0_0_40px_rgba(0,240,255,0.3)]'
                          : 'bg-white/10 border border-white/20'
                        }`}
                    >
                      {isPaused ? (
                        <svg width="28" height="32" viewBox="0 0 28 32" fill="white">
                          <path d="M2 0L28 16L2 32V0Z" />
                        </svg>
                      ) : (
                        <div className="flex gap-2">
                          <div className="w-3 h-7 bg-white rounded-sm" />
                          <div className="w-3 h-7 bg-white rounded-sm" />
                        </div>
                      )}
                    </motion.button>

                    {/* Map recenter */}
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      className="w-14 h-14 rounded-full bg-white/5 border border-white/10
                                 flex items-center justify-center"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                      </svg>
                    </motion.button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === TERRITORY CLAIMED TOAST === */}
      {/* Appears briefly when you claim a new territory */}
      <AnimatePresence>
        {/* Controlled by a state variable, shown for 3 seconds */}
        {false && ( // Replace with actual state
          <motion.div
            initial={{ y: -100, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -100, opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', damping: 20 }}
            className="absolute top-20 left-6 right-6 z-30"
          >
            <div className="glass rounded-2xl p-4 flex items-center gap-3 glow-cyan border border-cyan-500/20">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <span className="text-2xl">🏴</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">Territory Claimed!</p>
                <p className="text-xs text-white/50">Connaught Place · Zone #847</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-stat text-sm font-bold text-cyan-400">+50 XP</span>
                <span className="text-stat text-xs text-yellow-400">+10 🪙</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

**Run Summary Screen — The "Share-Worthy" Moment:**

```tsx
// src/components/pages/RunSummary.tsx
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { StatCard } from '../ui/StatCard';

export default function RunSummary() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const achievements = [
    { icon: '🏴', label: 'Territories Claimed', value: state?.territoriesClaimed || 3 },
    { icon: '⚔️', label: 'Enemy Zones Captured', value: 1 },
    { icon: '🔥', label: 'Longest Streak', value: '4 days' },
  ];

  const stagger = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Map preview with route */}
      <div className="relative h-[35vh] bg-[#12121A]">
        {/* Map would render here showing the route */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0A0A0F]" />

        {/* Close button */}
        <button
          onClick={() => navigate('/home')}
          className="absolute top-[env(safe-area-inset-top)] right-4 mt-4
                     w-10 h-10 rounded-full glass flex items-center justify-center"
        >
          <span className="text-white/60">✕</span>
        </button>
      </div>

      {/* Content */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="px-5 -mt-8 relative z-10 pb-32"
      >
        {/* Title */}
        <motion.div variants={item} className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">
            Evening Conquest Run 🏴
          </h1>
          <p className="text-sm text-white/40">
            Today · 6:30 PM · Connaught Place area
          </p>
        </motion.div>

        {/* Hero stats grid */}
        <motion.div variants={item} className="grid grid-cols-3 gap-3 mb-6">
          <StatCard
            label="Distance"
            value={(state?.distance || 5.23).toFixed(2)}
            unit="km"
            variant="default"
            glowColor="cyan"
          />
          <StatCard
            label="Duration"
            value={state?.elapsed ? formatTime(state.elapsed) : '28:14'}
            variant="default"
          />
          <StatCard
            label="Avg Pace"
            value={state?.pace || '5:24'}
            unit="/km"
            variant="default"
          />
        </motion.div>

        {/* Territory Results */}
        <motion.div variants={item} className="mb-6">
          <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-medium mb-3 px-1">
            Territory Results
          </h3>
          <div className="glass rounded-2xl overflow-hidden border border-white/[0.04]">
            {achievements.map((a, i) => (
              <div
                key={i}
                className={`flex items-center gap-4 p-4 ${
                  i < achievements.length - 1 ? 'border-b border-white/[0.04]' : ''
                }`}
              >
                <span className="text-2xl">{a.icon}</span>
                <span className="flex-1 text-sm text-white/70">{a.label}</span>
                <span className="text-stat text-lg font-bold text-white">{a.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* XP & Rewards */}
        <motion.div variants={item} className="mb-6">
          <div className="gradient-border p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-white/60">XP Earned</span>
              <span className="text-stat text-xl font-bold text-cyan-400">+320 XP</span>
            </div>
            {/* XP bar */}
            <div className="relative h-2 bg-white/10 rounded-full overflow-hidden mb-2">
              <motion.div
                initial={{ width: '30%' }}
                animate={{ width: '65%' }}
                transition={{ duration: 1.5, delay: 0.5, ease: [0.4, 0, 0.2, 1] }}
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-cyan-400 to-cyan-300 rounded-full"
              />
            </div>
            <div className="flex justify-between text-xs text-white/40">
              <span>Level 12</span>
              <span>2,400 / 3,500 XP</span>
              <span>Level 13</span>
            </div>
          </div>
        </motion.div>

        {/* Action buttons */}
        <motion.div variants={item} className="flex gap-3">
          <button className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10
                            text-sm font-semibold text-white/80 active:scale-[0.98] transition">
            Save Run
          </button>
          <button className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-cyan-400
                            text-sm font-semibold text-black active:scale-[0.98] transition
                            shadow-[0_0_30px_rgba(0,240,255,0.3)]">
            Share Conquest
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
```

### 1.4 — Critical UX Patterns You're Missing

```tsx
// src/components/ui/HapticButton.tsx
// Wrapper that triggers haptic feedback on mobile
export function haptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light') {
  if (!navigator.vibrate) return;
  const patterns = {
    light: [10],
    medium: [20],
    heavy: [30],
    success: [10, 50, 10],
    error: [30, 50, 30, 50, 30],
  };
  navigator.vibrate(patterns[type]);
}
```

```tsx
// src/components/ui/PullToRefresh.tsx — Custom pull-to-refresh
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { useRef, useState, ReactNode } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [refreshing, setRefreshing] = useState(false);
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 80], [0, 1]);
  const scale = useTransform(y, [0, 80], [0.5, 1]);
  const rotate = useTransform(y, [0, 80], [0, 180]);

  return (
    <div className="relative overflow-hidden h-full">
      {/* Refresh indicator */}
      <motion.div
        style={{ opacity, scale }}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-10
                   w-10 h-10 rounded-full glass flex items-center justify-center"
      >
        <motion.div
          style={{ rotate }}
          animate={refreshing ? { rotate: 360 } : {}}
          transition={refreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="rgba(0,240,255,0.8)" strokeWidth="2">
            <path d="M1 4v6h6M23 20v-6h-6" />
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
          </svg>
        </motion.div>
      </motion.div>

      {/* Scrollable content */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.5}
        style={{ y }}
        onDragEnd={async (_, info) => {
          if (info.offset.y > 80 && !refreshing) {
            setRefreshing(true);
            await onRefresh();
            setRefreshing(false);
          }
        }}
        className="h-full overflow-y-auto"
      >
        {children}
      </motion.div>
    </div>
  );
}
```

```tsx
// Skeleton loading states — NEVER show blank screens
export function StatCardSkeleton() {
  return (
    <div className="glass rounded-2xl p-4 animate-pulse">
      <div className="h-3 w-16 bg-white/10 rounded mb-3" />
      <div className="h-7 w-24 bg-white/10 rounded" />
    </div>
  );
}

export function FeedCardSkeleton() {
  return (
    <div className="glass rounded-2xl p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-white/10" />
        <div className="flex-1">
          <div className="h-3 w-28 bg-white/10 rounded mb-2" />
          <div className="h-2 w-20 bg-white/10 rounded" />
        </div>
      </div>
      <div className="h-32 bg-white/10 rounded-xl mb-3" />
      <div className="flex gap-4">
        <div className="h-3 w-16 bg-white/10 rounded" />
        <div className="h-3 w-16 bg-white/10 rounded" />
      </div>
    </div>
  );
}
```

### 1.5 — Page Transitions

```tsx
// src/components/layout/PageTransition.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

---

## Part 2: Game Design — The Rules That Make It Addictive

### 2.1 — Territory System (Using H3 Hexagonal Grid)

Install Uber's H3 library. This is the industry standard for hexagonal spatial indexing.

```bash
npm install h3-js
```

```typescript
// src/game/territory.ts
import { latLngToCell, cellToBoundary, gridDisk, cellToLatLng } from 'h3-js';

// Resolution 9 → hexagons ~174m across (perfect for city blocks)
// Resolution 8 → ~460m (better for suburbs/rural)
const HEX_RESOLUTION = 9;

export interface Territory {
  hexId: string;
  center: [number, number]; // [lat, lng]
  boundary: [number, number][]; // polygon vertices
  owner: string | null; // playerId
  ownerClub: string | null; // clubId
  defensePoints: number; // 0-100, decays over time
  claimedAt: number; // timestamp
  lastFortifiedAt: number;
  dailyIncome: number; // coins per day
  adjacentOwned: number; // count of adjacent hexes owned by same player
  tier: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

// Convert a GPS position to the hex it falls in
export function getHexAtPosition(lat: number, lng: number): string {
  return latLngToCell(lat, lng, HEX_RESOLUTION);
}

// Get the polygon boundary for rendering on map
export function getHexBoundary(hexId: string): [number, number][] {
  return cellToBoundary(hexId);
}

// Get all neighbors (ring of 1 = 6 adjacent hexes)
export function getAdjacentHexes(hexId: string): string[] {
  return gridDisk(hexId, 1).filter(h => h !== hexId);
}

// Get all hexes within N rings (for "area of influence")
export function getHexesInRadius(hexId: string, rings: number): string[] {
  return gridDisk(hexId, rings);
}

// Calculate territory tier based on real-world POI density
// (In production, use Overpass/Google Places API)
export function calculateTerritoryTier(hexId: string): Territory['tier'] {
  // Placeholder — in production, query POI density
  const center = cellToLatLng(hexId);
  // More central locations = higher tier
  // Parks, landmarks, stadiums = legendary
  // Shopping areas = epic
  // Residential = common
  return 'common';
}
```

### 2.2 — Core Game Loop: Claim → Defend → Fortify → Expand

```typescript
// src/game/actions.ts

export interface ClaimResult {
  success: boolean;
  hexId: string;
  xpEarned: number;
  coinsEarned: number;
  newDefenseLevel: number;
  message: string;
  territoryTier: string;
}

export interface GameConfig {
  // Claiming
  CLAIM_NEUTRAL_TIME_SEC: 30;         // seconds running in hex to claim neutral
  CLAIM_ENEMY_BASE_TIME_SEC: 120;     // base time to flip an enemy hex
  CLAIM_ENEMY_PER_DEFENSE_SEC: 2;     // +2 sec per defense point
  MIN_SPEED_MPS: 1.0;                 // must be moving at least 1 m/s (walking pace)
  MAX_SPEED_MPS: 12.0;                // above this = probably in a car, doesn't count
  
  // Defense
  INITIAL_DEFENSE: 50;                // starting defense of newly claimed hex
  MAX_DEFENSE: 100;
  DEFENSE_DECAY_PER_HOUR: 0.5;        // defense decays slowly
  ADJACENT_BONUS_DEFENSE: 5;          // +5 per adjacent owned hex (max +30)
  CLUB_MEMBER_BONUS: 10;              // +10 if club member in adjacent hex
  FORTIFY_DEFENSE_PER_KM: 10;         // running 1km in your own territory = +10 defense
  
  // Income
  BASE_INCOME_PER_HEX_PER_DAY: 5;    // 5 coins per owned hex per day
  TIER_MULTIPLIER: {                   // multiplied by tier
    common: 1, uncommon: 1.5, rare: 2, epic: 3, legendary: 5
  };
  CONTIGUOUS_BONUS_PERCENT: 10;       // +10% income per connected hex (max +100%)
  
  // XP Rewards
  XP_CLAIM_NEUTRAL: 20;
  XP_CLAIM_ENEMY: 50;
  XP_PER_KM_RUN: 30;
  XP_FORTIFY: 10;
  XP_DEFEND_SUCCESSFUL: 40;
  
  // Energy (for special actions only, basic running is free)
  MAX_ENERGY: 100;
  ENERGY_REGEN_PER_HOUR: 10;
  ENERGY_COST_SHIELD: 30;             // deploy a temporary shield on your hex
  ENERGY_COST_BOOST: 20;              // 2x capture speed for 5 min
  ENERGY_COST_SCAN: 10;               // reveal enemy defense levels nearby
  
  // Speed bonuses
  SPEED_BONUS_THRESHOLD_MPS: 3.5;     // running faster than ~4:45/km
  SPEED_BONUS_MULTIPLIER: 1.5;        // 1.5x capture speed
  
  // Limits
  MAX_TERRITORIES_BASE: 20;           // free tier
  MAX_TERRITORIES_PREMIUM: 100;       // paid tier
  TERRITORY_CAP_PER_LEVEL: 2;         // +2 max territories per player level
}

export const GAME_CONFIG: GameConfig = {
  CLAIM_NEUTRAL_TIME_SEC: 30,
  CLAIM_ENEMY_BASE_TIME_SEC: 120,
  CLAIM_ENEMY_PER_DEFENSE_SEC: 2,
  MIN_SPEED_MPS: 1.0,
  MAX_SPEED_MPS: 12.0,
  INITIAL_DEFENSE: 50,
  MAX_DEFENSE: 100,
  DEFENSE_DECAY_PER_HOUR: 0.5,
  ADJACENT_BONUS_DEFENSE: 5,
  CLUB_MEMBER_BONUS: 10,
  FORTIFY_DEFENSE_PER_KM: 10,
  BASE_INCOME_PER_HEX_PER_DAY: 5,
  TIER_MULTIPLIER: { common: 1, uncommon: 1.5, rare: 2, epic: 3, legendary: 5 },
  CONTIGUOUS_BONUS_PERCENT: 10,
  XP_CLAIM_NEUTRAL: 20,
  XP_CLAIM_ENEMY: 50,
  XP_PER_KM_RUN: 30,
  XP_FORTIFY: 10,
  XP_DEFEND_SUCCESSFUL: 40,
  MAX_ENERGY: 100,
  ENERGY_REGEN_PER_HOUR: 10,
  ENERGY_COST_SHIELD: 30,
  ENERGY_COST_BOOST: 20,
  ENERGY_COST_SCAN: 10,
  SPEED_BONUS_THRESHOLD_MPS: 3.5,
  SPEED_BONUS_MULTIPLIER: 1.5,
  MAX_TERRITORIES_BASE: 20,
  MAX_TERRITORIES_PREMIUM: 100,
  TERRITORY_CAP_PER_LEVEL: 2,
} as const;
```

```typescript
// src/game/claimEngine.ts
// The core claiming logic — runs during active tracking

import { getHexAtPosition, getAdjacentHexes } from './territory';
import { GAME_CONFIG } from './actions';

interface ClaimState {
  currentHexId: string | null;
  timeInCurrentHex: number;      // seconds spent in this hex
  distanceInCurrentHex: number;  // meters run inside this hex
  claimProgress: number;         // 0-100 percentage
  isClaimable: boolean;
  requiredTime: number;          // seconds needed to claim
}

export class ClaimEngine {
  private state: ClaimState = {
    currentHexId: null,
    timeInCurrentHex: 0,
    distanceInCurrentHex: 0,
    claimProgress: 0,
    isClaimable: false,
    requiredTime: 0,
  };

  private playerTerritories: Set<string>;
  private allTerritories: Map<string, { owner: string; defense: number }>;

  constructor(
    playerTerritories: Set<string>,
    allTerritories: Map<string, { owner: string; defense: number }>
  ) {
    this.playerTerritories = playerTerritories;
    this.allTerritories = allTerritories;
  }

  // Called every GPS update (typically every 1-3 seconds)
  update(lat: number, lng: number, speedMps: number, deltaTimeSec: number): {
    hexChanged: boolean;
    claimProgress: number;
    claimed: boolean;
    hexId: string;
    event?: 'entered_own' | 'entered_enemy' | 'entered_neutral' | 'claimed' | 'fortified';
  } {
    const hexId = getHexAtPosition(lat, lng);
    let hexChanged = false;
    let claimed = false;
    let event: string | undefined;

    // Validate speed (anti-cheat)
    const validSpeed = speedMps >= GAME_CONFIG.MIN_SPEED_MPS
                    && speedMps <= GAME_CONFIG.MAX_SPEED_MPS;

    // Hex changed?
    if (hexId !== this.state.currentHexId) {
      hexChanged = true;
      this.state.currentHexId = hexId;
      this.state.timeInCurrentHex = 0;
      this.state.distanceInCurrentHex = 0;
      this.state.claimProgress = 0;

      // Determine what kind of territory we entered
      if (this.playerTerritories.has(hexId)) {
        event = 'entered_own';
        this.state.isClaimable = false; // already owned, but can fortify
      } else if (this.allTerritories.has(hexId)) {
        event = 'entered_enemy';
        const enemy = this.allTerritories.get(hexId)!;
        this.state.isClaimable = true;
        this.state.requiredTime = GAME_CONFIG.CLAIM_ENEMY_BASE_TIME_SEC
          + (enemy.defense * GAME_CONFIG.CLAIM_ENEMY_PER_DEFENSE_SEC);
      } else {
        event = 'entered_neutral';
        this.state.isClaimable = true;
        this.state.requiredTime = GAME_CONFIG.CLAIM_NEUTRAL_TIME_SEC;
      }
    }

    // Accumulate time if moving at valid speed
    if (validSpeed) {
      this.state.timeInCurrentHex += deltaTimeSec;
      this.state.distanceInCurrentHex += speedMps * deltaTimeSec;

      // Speed bonus
      const speedMultiplier = speedMps >= GAME_CONFIG.SPEED_BONUS_THRESHOLD_MPS
        ? GAME_CONFIG.SPEED_BONUS_MULTIPLIER : 1.0;

      // Update claim progress
      if (this.state.isClaimable && this.state.requiredTime > 0) {
        const effectiveTime = this.state.timeInCurrentHex * speedMultiplier;
        this.state.claimProgress = Math.min(100,
          (effectiveTime / this.state.requiredTime) * 100
        );

        // Claimed!
        if (this.state.claimProgress >= 100) {
          claimed = true;
          event = 'claimed';
          this.state.isClaimable = false;
          this.playerTerritories.add(hexId);

          // Update allTerritories
          this.allTerritories.set(hexId, {
            owner: 'player', // replace with actual player ID
            defense: GAME_CONFIG.INITIAL_DEFENSE,
          });
        }
      }

      // Fortify own territory
      if (this.playerTerritories.has(hexId) && !this.state.isClaimable) {
        const fortifyPoints = (this.state.distanceInCurrentHex / 1000) * GAME_CONFIG.FORTIFY_DEFENSE_PER_KM;
        if (fortifyPoints > 0) {
          const current = this.allTerritories.get(hexId);
          if (current && current.defense < GAME_CONFIG.MAX_DEFENSE) {
            current.defense = Math.min(GAME_CONFIG.MAX_DEFENSE, current.defense + fortifyPoints);
            event = 'fortified';
          }
        }
      }
    }

    return {
      hexChanged,
      claimProgress: this.state.claimProgress,
      claimed,
      hexId,
      event: event as any,
    };
  }

  getState(): ClaimState {
    return { ...this.state };
  }
}
```

### 2.3 — Progression & League System

```typescript
// src/game/progression.ts

export interface PlayerLevel {
  level: number;
  title: string;
  xpRequired: number;       // total XP to reach this level
  maxTerritories: number;
  unlocksAt: string[];       // features unlocked
}

export const LEVEL_TABLE: PlayerLevel[] = [
  { level: 1,  title: 'Scout',           xpRequired: 0,       maxTerritories: 5,  unlocksAt: ['Basic claiming'] },
  { level: 2,  title: 'Pathfinder',      xpRequired: 200,     maxTerritories: 7,  unlocksAt: ['Profile customization'] },
  { level: 3,  title: 'Trailblazer',     xpRequired: 500,     maxTerritories: 9,  unlocksAt: ['Club joining'] },
  { level: 5,  title: 'Ranger',          xpRequired: 1200,    maxTerritories: 13, unlocksAt: ['Territory shields', 'Scan ability'] },
  { level: 8,  title: 'Captain',         xpRequired: 3000,    maxTerritories: 18, unlocksAt: ['Club creation', 'Boost ability'] },
  { level: 10, title: 'Commander',       xpRequired: 5000,    maxTerritories: 22, unlocksAt: ['Territory tier visibility'] },
  { level: 15, title: 'Warlord',         xpRequired: 12000,   maxTerritories: 32, unlocksAt: ['Alliance system'] },
  { level: 20, title: 'Conqueror',       xpRequired: 25000,   maxTerritories: 45, unlocksAt: ['Territory monuments'] },
  { level: 30, title: 'Emperor',         xpRequired: 60000,   maxTerritories: 65, unlocksAt: ['Custom hex colors'] },
  { level: 50, title: 'Legend',          xpRequired: 150000,  maxTerritories: 100,unlocksAt: ['Legendary territory aura'] },
];

// Seasonal League
export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'champion';

export interface SeasonLeague {
  tier: LeagueTier;
  division: 1 | 2 | 3; // each tier has 3 divisions
  points: number;
  rank: number; // within division
}

export const LEAGUE_CONFIG: Record<LeagueTier, {
  minPoints: number;
  color: string;
  perks: string[];
}> = {
  bronze:   { minPoints: 0,    color: '#CD7F32', perks: [] },
  silver:   { minPoints: 500,  color: '#C0C0C0', perks: ['5% income bonus'] },
  gold:     { minPoints: 1500, color: '#FFD700', perks: ['10% income bonus', 'Gold hex border'] },
  platinum: { minPoints: 3500, color: '#E5E4E2', perks: ['15% income bonus', 'Platinum avatar frame'] },
  diamond:  { minPoints: 7000, color: '#B9F2FF', perks: ['20% income bonus', 'Diamond hex aura'] },
  champion: { minPoints: 15000,color: '#FF4500', perks: ['25% income bonus', 'Champion crown', 'City leaderboard'] },
};

// League points earned from:
// - Claiming territories: 10-50 points based on tier
// - Defending territory from attack: 20 points
// - Running distance: 5 points per km
// - Club territory contribution: 3 points per hex
// Seasons last 4 weeks. Points reset but rewards are permanent.
```

### 2.4 — Events System (What Makes Players Come Back)

```typescript
// src/game/events.ts

export type EventType =
  | 'territory_war'      // Club vs Club, fixed time window
  | 'king_of_hill'       // Hold a specific landmark hex the longest
  | 'gold_rush'          // Bonus income from all territories for 1 hour
  | 'dark_zone'          // Random hexes become "dark" — 3x XP but no map visible
  | 'brand_challenge'    // Sponsored: run through branded zones
  | 'conqueror_sprint'   // First to claim 10 hexes in 30 min
  | 'survival'           // Your territories decay 5x faster — can you maintain them?
  | 'power_hour';        // All XP doubled for 1 hour

export interface GameEvent {
  id: string;
  type: EventType;
  name: string;
  description: string;
  startTime: number;
  endTime: number;
  rewards: {
    xp: number;
    coins: number;
    gems?: number;
    cosmetic?: string;  // unique avatar frame, hex skin, etc.
  };
  requirements?: {
    minLevel: number;
    clubRequired?: boolean;
  };
  leaderboard?: {
    playerId: string;
    score: number;
    rank: number;
  }[];
}

// Example weekly event schedule:
// Monday:    Power Hour (7-8 PM local)
// Tuesday:   Conqueror Sprint (6-7 PM)
// Wednesday: Brand Challenge (all day)
// Thursday:  Dark Zone (random 2-hour window)
// Friday:    Gold Rush (6-8 PM)
// Saturday:  Territory War (2-5 PM)
// Sunday:    King of the Hill (all day, specific landmark)
```

### 2.5 — Anti-Cheat Fundamentals

```typescript
// src/game/validation.ts
// Client-side validation (server must re-validate everything)

export interface GPSPoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy: number;
  speed: number | null;
}

export function validateRunPath(points: GPSPoint[]): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (points.length < 10) {
    issues.push('Too few GPS points');
    return { valid: false, issues };
  }

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    // Time delta check
    const dt = (curr.timestamp - prev.timestamp) / 1000; // seconds
    if (dt <= 0) {
      issues.push(`Invalid timestamp sequence at point ${i}`);
      continue;
    }

    // Distance check (haversine)
    const dist = haversine(prev.lat, prev.lng, curr.lat, curr.lng);
    const speed = dist / dt; // m/s

    // Teleportation check (> 15 m/s = 54 km/h — impossible on foot)
    if (speed > 15) {
      issues.push(`Impossible speed ${speed.toFixed(1)} m/s at point ${i}`);
    }

    // GPS accuracy check
    if (curr.accuracy > 50) {
      issues.push(`Poor GPS accuracy ${curr.accuracy}m at point ${i}`);
    }
  }

  // Route smoothness check — sudden direction changes at high speed are suspicious
  // Elevation consistency check — if available
  // Timestamp regularity — should be roughly every 1-5 seconds

  return {
    valid: issues.length === 0,
    issues,
  };
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

---

## Part 3: Feature Priority Matrix

### Tier 1 — Ship These First (Weeks 1-4)
| Feature | Why |
|---------|-----|
| **H3 territory overlay on active run map** | Core differentiator — users must SEE territories while running |
| **Claim animation + feedback** | The "moment of delight" — haptic + visual + sound when you claim a hex |
| **Post-run territory summary** | Show exactly which hexes you claimed, how many you fortified |
| **Territory map page (full)** | Zoomable map showing all territories: yours, enemies, neutral |
| **Offline-first run data storage** | IndexedDB for runs — GPS data MUST survive app crashes/closed |
| **Dark mode polish** | Apply the design system consistently across all screens |
| **Bottom sheet refactor** | Replace all modals/drawers with proper bottom sheets |

### Tier 2 — Engagement Loop (Weeks 5-8)
| Feature | Why |
|---------|-----|
| **Daily missions** | "Claim 3 territories today" / "Run through 2 enemy zones" / "Fortify 5 hexes" |
| **Streak system** | Consecutive daily run streak — multiplier for XP/coins |
| **Level-up celebrations** | Full-screen animation when leveling up |
| **Achievement system (real)** | Actually track and award achievements based on real data |
| **Push notifications** | "Your territory at Connaught Place is under attack!" |
| **Share card generation** | Canvas/SVG export of run summary as a shareable image |

### Tier 3 — Social & Competition (Weeks 9-14)
| Feature | Why |
|---------|-----|
| **Backend + Auth** | Supabase or Firebase — needed for everything below |
| **Real leaderboards** | City, neighborhood, global — updated in real-time |
| **Clubs (functional)** | Pool territories, club wars, shared defense |
| **Territory attack notifications** | Real-time: someone is running through your territory |
| **Weekly events** | Rotate event types — keep people coming back |
| **Real social feed** | Show friend activity, territory changes, achievements |

### Tier 4 — Monetization & Growth (Weeks 15+)
| Feature | Why |
|---------|-----|
| **Premium subscription tiers** | More territory capacity, cosmetics, detailed analytics |
| **Cosmetic shop** | Hex skins, avatar frames, trail effects (non-P2W) |
| **Brand zone partnerships** | Brands sponsor specific hexes/zones — real revenue |
| **Referral system** | Invite friends, both get XP/territory boosts |
| **City expansion** | Launch in new cities with localized landmarks |

---

## Part 4: Technical Architecture Recommendations

### 4.1 — Convert to PWA / Capacitor

Your React web app needs to feel native. Two options:

```bash
# Option A: Capacitor (recommended — access native APIs)
npm install @capacitor/core @capacitor/cli
npx cap init Runivo com.runivo.app
npx cap add android
npx cap add ios

# Install native plugins
npm install @capacitor/geolocation    # Better GPS than web API
npm install @capacitor/haptics        # Real haptic feedback
npm install @capacitor/push-notifications
npm install @capacitor/status-bar
npm install @capacitor/splash-screen
npm install @capacitor/app            # Background/foreground events
npm install @capacitor/preferences    # Better than localStorage
```

```typescript
// src/native/geolocation.ts
// Capacitor geolocation — more reliable than browser API
import { Geolocation } from '@capacitor/geolocation';

export async function startTracking(
  callback: (lat: number, lng: number, speed: number, accuracy: number) => void
): Promise<string> {
  const watchId = await Geolocation.watchPosition(
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    },
    (position, err) => {
      if (err) return;
      if (position) {
        callback(
          position.coords.latitude,
          position.coords.longitude,
          position.coords.speed ?? 0,
          position.coords.accuracy
        );
      }
    }
  );
  return watchId;
}

export async function stopTracking(watchId: string) {
  await Geolocation.clearWatch({ id: watchId });
}
```

### 4.2 — Offline-First Data with IndexedDB

```typescript
// src/data/runStorage.ts
import { openDB, IDBPDatabase } from 'idb';

interface StoredRun {
  id: string;
  startTime: number;
  endTime: number;
  activityType: string;
  gpsPoints: { lat: number; lng: number; timestamp: number; speed: number; accuracy: number }[];
  totalDistance: number;
  totalTime: number;
  avgPace: string;
  territoriesClaimed: string[];
  territoriesFortified: string[];
  xpEarned: number;
  coinsEarned: number;
  synced: boolean;  // false until sent to server
}

async function getDB(): Promise<IDBPDatabase> {
  return openDB('runivo-db', 1, {
    upgrade(db) {
      // Runs store
      const runStore = db.createObjectStore('runs', { keyPath: 'id' });
      runStore.createIndex('startTime', 'startTime');
      runStore.createIndex('synced', 'synced');

      // Territories cache
      db.createObjectStore('territories', { keyPath: 'hexId' });

      // Pending actions (for offline territory claims)
      db.createObjectStore('pendingActions', { keyPath: 'id', autoIncrement: true });
    },
  });
}

export async function saveRun(run: StoredRun): Promise<void> {
  const db = await getDB();
  await db.put('runs', run);
}

export async function getRuns(): Promise<StoredRun[]> {
  const db = await getDB();
  return db.getAllFromIndex('runs', 'startTime');
}

export async function getUnsyncedRuns(): Promise<StoredRun[]> {
  const db = await getDB();
  return db.getAllFromIndex('runs', 'synced', false);
}

export async function savePendingAction(action: {
  type: 'claim' | 'fortify';
  hexId: string;
  timestamp: number;
  gpsProof: { lat: number; lng: number }[];
}): Promise<void> {
  const db = await getDB();
  await db.add('pendingActions', action);
}
```

### 4.3 — Map Territory Rendering

```typescript
// src/map/territoryLayer.ts
// Render H3 hexagons on MapLibre GL

import maplibregl from 'maplibre-gl';
import { cellToBoundary } from 'h3-js';

export function addTerritoryLayer(
  map: maplibregl.Map,
  territories: Map<string, { owner: string; defense: number; tier: string }>
) {
  // Convert H3 cells to GeoJSON
  const features = Array.from(territories.entries()).map(([hexId, data]) => {
    const boundary = cellToBoundary(hexId, true); // true = GeoJSON format [lng, lat]
    return {
      type: 'Feature' as const,
      properties: {
        hexId,
        owner: data.owner,
        defense: data.defense,
        tier: data.tier,
        isOwned: data.owner === 'currentPlayerId', // replace with real check
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [boundary.map(([lat, lng]) => [lng, lat])],
      },
    };
  });

  const geojson = {
    type: 'FeatureCollection' as const,
    features,
  };

  // Add source
  if (map.getSource('territories')) {
    (map.getSource('territories') as maplibregl.GeoJSONSource).setData(geojson);
    return;
  }

  map.addSource('territories', {
    type: 'geojson',
    data: geojson,
  });

  // Fill layer
  map.addLayer({
    id: 'territory-fills',
    type: 'fill',
    source: 'territories',
    paint: {
      'fill-color': [
        'case',
        ['get', 'isOwned'], 'rgba(0, 240, 255, 0.15)',  // cyan for owned
        'rgba(255, 51, 102, 0.15)',                       // magenta for enemy
      ],
      'fill-opacity': [
        'interpolate', ['linear'], ['get', 'defense'],
        0, 0.05,
        100, 0.3,
      ],
    },
  });

  // Border layer
  map.addLayer({
    id: 'territory-borders',
    type: 'line',
    source: 'territories',
    paint: {
      'line-color': [
        'case',
        ['get', 'isOwned'], 'rgba(0, 240, 255, 0.5)',
        'rgba(255, 51, 102, 0.5)',
      ],
      'line-width': 2,
      'line-opacity': 0.7,
    },
  });

  // Add pulsing animation for contested territories
  // (done via updating opacity in requestAnimationFrame)
}

// Animate territory claim — expand from center with particle effect
export function animateClaimHex(map: maplibregl.Map, hexId: string) {
  const boundary = cellToBoundary(hexId, true);
  
  // Create a temporary source/layer that pulses
  const animId = `claim-anim-${hexId}`;
  
  map.addSource(animId, {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [boundary.map(([lat, lng]) => [lng, lat])],
      },
    },
  });

  map.addLayer({
    id: animId,
    type: 'fill',
    source: animId,
    paint: {
      'fill-color': 'rgba(0, 240, 255, 0.6)',
      'fill-opacity': 0.8,
    },
  });

  // Animate fade out over 2 seconds
  let opacity = 0.8;
  const interval = setInterval(() => {
    opacity -= 0.04;
    if (opacity <= 0) {
      clearInterval(interval);
      map.removeLayer(animId);
      map.removeSource(animId);
      return;
    }
    map.setPaintProperty(animId, 'fill-opacity', opacity);
  }, 50);
}
```

### 4.4 — Backend (When Ready — Use Supabase)

```sql
-- Supabase schema sketch

-- Players
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  level INT DEFAULT 1,
  xp INT DEFAULT 0,
  coins INT DEFAULT 0,
  gems INT DEFAULT 0,
  energy INT DEFAULT 100,
  last_energy_regen TIMESTAMPTZ DEFAULT NOW(),
  subscription_tier TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Territories
CREATE TABLE territories (
  hex_id TEXT PRIMARY KEY,  -- H3 hex ID
  owner_id UUID REFERENCES players(id),
  club_id UUID REFERENCES clubs(id),
  defense INT DEFAULT 50,
  tier TEXT DEFAULT 'common',
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  last_fortified_at TIMESTAMPTZ DEFAULT NOW(),
  daily_income DECIMAL DEFAULT 5.0
);

-- Enable PostGIS for spatial queries
CREATE INDEX idx_territories_owner ON territories(owner_id);

-- Runs
CREATE TABLE runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id),
  activity_type TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  distance_meters DECIMAL NOT NULL,
  duration_seconds INT NOT NULL,
  avg_pace TEXT,
  gps_path JSONB, -- compressed GPS points
  territories_claimed TEXT[], -- array of hex IDs
  xp_earned INT DEFAULT 0,
  coins_earned INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Real-time territory updates via Supabase Realtime
-- Subscribe to: territories table changes where hex is near player's location
```

---

## Part 5: Immediate Action Items (Start Tomorrow)

Here's your exact next-steps checklist:

```
WEEK 1: Visual Foundation
□ Install Plus Jakarta Sans + JetBrains Mono fonts
□ Apply dark theme tokens globally (tailwind.config.ts)
□ Build StatCard, BottomSheet, AnimatedCounter components
□ Refactor ActiveRun screen to new design
□ Add skeleton loading states to all list views
□ Add haptic feedback to all buttons

WEEK 2: Territory Visualization
□ npm install h3-js
□ Build getHexAtPosition() and render hexes on MapLibre
□ Show territory overlay during active run
□ Color-code: your hexes (cyan), enemy (magenta), neutral (dim)
□ Add claim progress bar to active run UI
□ Show "Territory Claimed!" toast with animation

WEEK 3: Game Loop
□ Implement ClaimEngine class
□ Connect to active run GPS tracking
□ Show territories claimed in run summary
□ Build territory detail bottom sheet (tap a hex → see defense, income, history)
□ Implement defense decay (timer-based)
□ Add XP + level system with progress bar

WEEK 4: Persistence & Polish
□ Set up IndexedDB for runs + territory cache
□ Implement run history page with real data
□ Build share card (canvas export of run map + stats)
□ Page transitions everywhere
□ Splash screen + app icon
□ Test on real Android/iOS device via Capacitor
```

---

## Part 6: What Will Make Runivo Win

The territory mechanic only works if it creates **real emotional stakes**. Here are the design principles that will make this addictive:

1. **Loss Aversion > Gain**: Notifications saying "Your territory is being attacked!" drive more engagement than "You could claim a new zone!" The decay mechanic ensures people MUST run regularly to maintain their empire.

2. **Visible Progress on the Map**: When a player opens the app and sees their cyan hexagons spreading across their neighborhood, that visual ownership is profoundly satisfying. The map IS the game.

3. **Social Proof**: Seeing that a rival club owns the park you run through every morning creates real motivation to go reclaim it. Leaderboards should be hyperlocal — your neighborhood, your block.

4. **Effort-Proportional Reward**: Running farther and faster should always feel better — speed bonuses, more hexes covered, higher defense. Never let someone claim territory from a car.

5. **Weekly Reset Events**: Territory Wars every Saturday prevent stale ownership. Everything is contestable. Even the biggest empire can fall if you don't show up.

6. **The Share Moment**: The run summary with a map showing your newly-claimed territories, overlaid on the city map, with your stats — that's what people will screenshot and share. Make it beautiful.

The app that gets runners to think "I need to go run through that block before someone takes it" has won. Every design and engineering decision should serve that feeling.