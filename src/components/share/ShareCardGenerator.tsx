import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toPng } from 'html-to-image';
import { haptic } from '../../lib/haptics';

interface ShareCardProps {
  isOpen: boolean;
  onClose: () => void;
  runData: {
    distance: number;
    duration: string;
    pace: string;
    territoriesClaimed: number;
    xpEarned: number;
    date: string;
    timeOfDay: string;
    activityType: string;
    playerName: string;
    playerLevel: number;
    levelTitle: string;
    streakDays: number;
    routePoints?: { lat: number; lng: number }[];
  };
}

type CardTheme = 'dark' | 'cyan' | 'magenta' | 'gold';

// Share card themes stay dark — they're designed for social media sharing
const themes: Record<CardTheme, {
  bg: string;
  accent: string;
  accentLight: string;
  gradient: string;
  textPrimary: string;
  textSecondary: string;
}> = {
  dark: {
    bg: '#0A0A0F',
    accent: '#00B4C6',
    accentLight: 'rgba(0,180,198,0.15)',
    gradient: 'linear-gradient(135deg, #0A0A0F 0%, #12121A 100%)',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.45)',
  },
  cyan: {
    bg: '#041E2B',
    accent: '#00B4C6',
    accentLight: 'rgba(0,180,198,0.12)',
    gradient: 'linear-gradient(135deg, #041E2B 0%, #0A3040 100%)',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.5)',
  },
  magenta: {
    bg: '#1A0A14',
    accent: '#DC267F',
    accentLight: 'rgba(220,38,127,0.12)',
    gradient: 'linear-gradient(135deg, #1A0A14 0%, #2A1020 100%)',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.45)',
  },
  gold: {
    bg: '#141008',
    accent: '#FFD700',
    accentLight: 'rgba(255,215,0,0.1)',
    gradient: 'linear-gradient(135deg, #141008 0%, #201A0C 100%)',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.45)',
  },
};

export function ShareCardGenerator({ isOpen, onClose, runData }: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [selectedTheme, setSelectedTheme] = useState<CardTheme>('dark');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const theme = themes[selectedTheme];

  const generateImage = useCallback(async () => {
    if (!cardRef.current) return;
    setGenerating(true);
    haptic('medium');

    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        width: 1080,
        height: 1920,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        },
      });

      if (navigator.share && navigator.canShare) {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], `runivo-${Date.now()}.png`, {
          type: 'image/png',
        });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'My Runivo Conquest',
            text: `${runData.distance.toFixed(2)} km | ${runData.territoriesClaimed} territories claimed`,
          });
          haptic('success');
          setGenerated(true);
          return;
        }
      }

      const link = document.createElement('a');
      link.download = `runivo-run-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      haptic('success');
      setGenerated(true);
    } catch (err) {
      console.error('Share failed:', err);
      haptic('error');
    } finally {
      setGenerating(false);
    }
  }, [runData]);

  const renderMiniRoute = () => {
    if (!runData.routePoints || runData.routePoints.length < 2) {
      return null;
    }

    const points = runData.routePoints;
    const lats = points.map(p => p.lat);
    const lngs = points.map(p => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const padding = 40;
    const width = 1000;
    const height = 500;

    const scaleX = (maxLng - minLng) > 0
      ? (width - padding * 2) / (maxLng - minLng)
      : 1;
    const scaleY = (maxLat - minLat) > 0
      ? (height - padding * 2) / (maxLat - minLat)
      : 1;
    const scale = Math.min(scaleX, scaleY);

    const pathData = points
      .map((p, i) => {
        const x = padding + (p.lng - minLng) * scale;
        const y = height - padding - (p.lat - minLat) * scale;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          <filter id="route-glow">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d={pathData}
          fill="none"
          stroke={theme.accent}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.3"
          filter="url(#route-glow)"
        />
        <path
          d={pathData}
          fill="none"
          stroke={theme.accent}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={padding + (points[0].lng - minLng) * scale}
          cy={height - padding - (points[0].lat - minLat) * scale}
          r="6"
          fill="#00FF88"
        />
        <circle
          cx={padding + (points[points.length - 1].lng - minLng) * scale}
          cy={height - padding - (points[points.length - 1].lat - minLat) * scale}
          r="6"
          fill={theme.accent}
        />
      </svg>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 250 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[92vh] flex flex-col
                       bg-white rounded-t-3xl border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
          >
            <div className="flex justify-center pt-3 pb-2 shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            <div className="px-6 pb-4 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Share Conquest</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <span className="text-gray-400 text-sm">{'✕'}</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-safe">
              <div className="flex justify-center mb-5">
                <div
                  style={{
                    width: '270px',
                    height: '480px',
                    overflow: 'hidden',
                    borderRadius: '20px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                  }}
                >
                  <div
                    style={{
                      width: '1080px',
                      height: '1920px',
                      transform: 'scale(0.25)',
                      transformOrigin: 'top left',
                    }}
                  >
                    {/* === THE ACTUAL SHARE CARD (stays dark for social media) === */}
                    <div
                      ref={cardRef}
                      style={{
                        width: '1080px',
                        height: '1920px',
                        background: theme.gradient,
                        position: 'relative',
                        overflow: 'hidden',
                        fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          opacity: 0.03,
                          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='70' viewBox='0 0 60 70' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 17.5V52.5L30 70L0 52.5V17.5L30 0Z' fill='none' stroke='white' stroke-width='1'/%3E%3C/svg%3E")`,
                          backgroundSize: '60px 70px',
                        }}
                      />

                      <div
                        style={{
                          height: '6px',
                          background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
                        }}
                      />

                      <div
                        style={{
                          flex: '0 0 auto',
                          height: '600px',
                          padding: '60px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                        }}
                      >
                        {renderMiniRoute() || (
                          <div
                            style={{
                              width: '200px',
                              height: '200px',
                              borderRadius: '50%',
                              background: theme.accentLight,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '80px',
                            }}
                          >
                            {'🏃'}
                          </div>
                        )}
                      </div>

                      <div style={{ flex: 1, padding: '0 80px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ marginBottom: '40px' }}>
                          <div
                            style={{
                              fontSize: '28px',
                              color: theme.textSecondary,
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase' as const,
                              fontWeight: 500,
                            }}
                          >
                            {runData.date} {'·'} {runData.timeOfDay}
                          </div>
                        </div>

                        <div style={{ marginBottom: '60px' }}>
                          <div
                            style={{
                              fontSize: '180px',
                              fontWeight: 800,
                              color: theme.textPrimary,
                              lineHeight: 0.9,
                              letterSpacing: '-0.03em',
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {runData.distance.toFixed(2)}
                          </div>
                          <div
                            style={{
                              fontSize: '48px',
                              fontWeight: 600,
                              color: theme.textSecondary,
                              marginTop: '8px',
                              letterSpacing: '0.15em',
                              textTransform: 'uppercase' as const,
                            }}
                          >
                            kilometers
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            gap: '60px',
                            marginBottom: '60px',
                          }}
                        >
                          {[
                            { label: 'DURATION', value: runData.duration },
                            { label: 'AVG PACE', value: `${runData.pace}/km` },
                            { label: 'ZONES', value: String(runData.territoriesClaimed) },
                          ].map((stat, i) => (
                            <div key={i}>
                              <div
                                style={{
                                  fontSize: '22px',
                                  color: theme.textSecondary,
                                  letterSpacing: '0.2em',
                                  marginBottom: '12px',
                                  fontWeight: 500,
                                }}
                              >
                                {stat.label}
                              </div>
                              <div
                                style={{
                                  fontSize: '56px',
                                  fontWeight: 700,
                                  color: theme.textPrimary,
                                  fontFamily: "'JetBrains Mono', monospace",
                                }}
                              >
                                {stat.value}
                              </div>
                            </div>
                          ))}
                        </div>

                        {runData.territoriesClaimed > 0 && (
                          <div
                            style={{
                              background: theme.accentLight,
                              borderRadius: '24px',
                              padding: '32px 40px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '24px',
                              marginBottom: '60px',
                              border: `2px solid ${theme.accent}33`,
                            }}
                          >
                            <span style={{ fontSize: '48px' }}>{'🏴'}</span>
                            <div>
                              <div
                                style={{
                                  fontSize: '36px',
                                  fontWeight: 700,
                                  color: theme.accent,
                                  fontFamily: "'JetBrains Mono', monospace",
                                }}
                              >
                                {runData.territoriesClaimed} Territories Claimed
                              </div>
                              <div
                                style={{
                                  fontSize: '24px',
                                  color: theme.textSecondary,
                                  marginTop: '4px',
                                }}
                              >
                                +{runData.xpEarned} XP earned
                              </div>
                            </div>
                          </div>
                        )}

                        <div style={{ flex: 1 }} />

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingBottom: '80px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div
                              style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '16px',
                                background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}88)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '28px',
                                fontWeight: 800,
                                color: '#000',
                              }}
                            >
                              {runData.playerName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div
                                style={{
                                  fontSize: '30px',
                                  fontWeight: 700,
                                  color: theme.textPrimary,
                                }}
                              >
                                {runData.playerName}
                              </div>
                              <div
                                style={{
                                  fontSize: '22px',
                                  color: theme.accent,
                                  fontWeight: 500,
                                }}
                              >
                                Lv.{runData.playerLevel} {runData.levelTitle}
                                {runData.streakDays > 1 &&
                                  ` · ${runData.streakDays} day streak`}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' as const }}>
                            <div
                              style={{
                                fontSize: '36px',
                                fontWeight: 800,
                                color: theme.textPrimary,
                                letterSpacing: '0.05em',
                              }}
                            >
                              RUNIVO
                            </div>
                            <div
                              style={{
                                fontSize: '18px',
                                color: theme.textSecondary,
                                letterSpacing: '0.2em',
                                textTransform: 'uppercase' as const,
                              }}
                            >
                              {'Run · Capture · Conquer'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <span className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-medium block mb-3">
                  Theme
                </span>
                <div className="flex gap-3">
                  {(Object.keys(themes) as CardTheme[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setSelectedTheme(t);
                        haptic('light');
                      }}
                      className={`flex-1 h-12 rounded-xl border-2 transition-all ${
                        selectedTheme === t
                          ? 'border-teal-400 scale-105'
                          : 'border-gray-200'
                      }`}
                      style={{ background: themes[t].gradient }}
                    >
                      <div
                        className="w-3 h-3 rounded-full mx-auto"
                        style={{ background: themes[t].accent }}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={generateImage}
                disabled={generating}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600
                           text-base font-bold text-white
                           shadow-[0_4px_20px_rgba(0,180,198,0.3)]
                           disabled:opacity-50 disabled:cursor-not-allowed
                           mb-3"
              >
                {generating ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    />
                    Generating...
                  </span>
                ) : generated ? (
                  'Shared!'
                ) : (
                  'Share to Story'
                )}
              </motion.button>

              <button
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-gray-100 border border-gray-200
                           text-sm font-semibold text-gray-500 mb-6"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
