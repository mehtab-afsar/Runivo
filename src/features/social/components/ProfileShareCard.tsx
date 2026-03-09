import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toPng } from 'html-to-image';
import QRCode from 'qrcode';
import { haptic } from '@shared/lib/haptics';

interface ProfileShareCardProps {
  isOpen: boolean;
  onClose: () => void;
  profile: {
    username: string;
    level: number;
    levelTitle: string;
    totalDistanceKm: number;
    totalRuns: number;
    totalTerritoriesClaimed: number;
    streakDays: number;
    avatarColor?: string; // tailwind gradient from color hex e.g. '#00B4C6'
  };
}

type CardTheme = 'dark' | 'deep' | 'light';

const themes: Record<CardTheme, {
  bg: string;
  surface: string;
  accent: string;
  accentFaded: string;
  textPrimary: string;
  textSecondary: string;
  qrDark: string;
  qrLight: string;
  border: string;
}> = {
  dark: {
    bg: '#0A0A0F',
    surface: 'rgba(255,255,255,0.05)',
    accent: '#00B4C6',
    accentFaded: 'rgba(0,180,198,0.15)',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.45)',
    qrDark: '#00B4C6',
    qrLight: '#0A0A0F',
    border: 'rgba(255,255,255,0.08)',
  },
  deep: {
    bg: '#040E14',
    surface: 'rgba(0,180,198,0.06)',
    accent: '#00D4E8',
    accentFaded: 'rgba(0,212,232,0.12)',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.4)',
    qrDark: '#00D4E8',
    qrLight: '#040E14',
    border: 'rgba(0,212,232,0.15)',
  },
  light: {
    bg: '#FFFFFF',
    surface: 'rgba(0,0,0,0.04)',
    accent: '#0891B2',
    accentFaded: 'rgba(8,145,178,0.08)',
    textPrimary: '#0F172A',
    textSecondary: 'rgba(15,23,42,0.4)',
    qrDark: '#0891B2',
    qrLight: '#FFFFFF',
    border: 'rgba(0,0,0,0.06)',
  },
};

const AVATAR_HEX_COLORS: Record<string, string> = {
  teal: '#00B4C6',
  indigo: '#6366F1',
  rose: '#F43F5E',
  amber: '#F59E0B',
  violet: '#8B5CF6',
  emerald: '#10B981',
  sky: '#0EA5E9',
  orange: '#F97316',
};

export function ProfileShareCard({ isOpen, onClose, profile }: ProfileShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [selectedTheme, setSelectedTheme] = useState<CardTheme>('dark');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const theme = themes[selectedTheme];
  const inviteUrl = `https://runivo.app/join?ref=${encodeURIComponent(profile.username)}`;
  const avatarHex = AVATAR_HEX_COLORS[profile.avatarColor || 'teal'] || '#00B4C6';

  // Generate QR code whenever theme or username changes
  useEffect(() => {
    if (!isOpen) return;
    QRCode.toDataURL(inviteUrl, {
      width: 300,
      margin: 1,
      color: { dark: theme.qrDark, light: theme.qrLight },
      errorCorrectionLevel: 'M',
    }).then(setQrDataUrl).catch(() => setQrDataUrl(''));
  }, [isOpen, selectedTheme, inviteUrl, theme.qrDark, theme.qrLight]);

  const generateImage = useCallback(async () => {
    if (!cardRef.current) return;
    setGenerating(true);
    haptic('medium');

    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        width: 1080,
        height: 1080,
        style: { transform: 'scale(1)', transformOrigin: 'top left' },
      });

      if (navigator.share && navigator.canShare) {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], `runivo-profile-${Date.now()}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Join me on Runivo`,
            text: `Run with ${profile.username} on Runivo — Run · Capture · Conquer`,
            url: inviteUrl,
          });
          haptic('success');
          setGenerated(true);
          return;
        }
      }

      const link = document.createElement('a');
      link.download = `runivo-profile-${profile.username}-${Date.now()}.png`;
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
  }, [profile.username, inviteUrl]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      haptic('light');
    } catch {
      // fallback: select text
    }
  }, [inviteUrl]);

  const stats = [
    { label: 'LEVEL',  value: String(profile.level) },
    { label: 'KM',     value: profile.totalDistanceKm.toFixed(0) },
    { label: 'ZONES',  value: String(profile.totalTerritoriesClaimed) },
    { label: 'STREAK', value: `${profile.streakDays}d` },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 250 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[96vh] flex flex-col
                       bg-white rounded-t-3xl border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2 shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Header */}
            <div className="px-6 pb-4 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Share Profile</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-safe">
              {/* Card preview */}
              <div className="flex justify-center mb-5">
                <div style={{
                  width: '270px',
                  height: '270px',
                  overflow: 'hidden',
                  borderRadius: '20px',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
                }}>
                  <div style={{
                    width: '1080px',
                    height: '1080px',
                    transform: 'scale(0.25)',
                    transformOrigin: 'top left',
                  }}>
                    {/* === THE 1080×1080 SHARE CARD === */}
                    <div
                      ref={cardRef}
                      style={{
                        width: '1080px',
                        height: '1080px',
                        background: theme.bg,
                        position: 'relative',
                        overflow: 'hidden',
                        fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '80px',
                      }}
                    >
                      {/* Hex grid background */}
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        opacity: 0.025,
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='70' viewBox='0 0 60 70' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 17.5V52.5L30 70L0 52.5V17.5L30 0Z' fill='none' stroke='white' stroke-width='1'/%3E%3C/svg%3E")`,
                        backgroundSize: '60px 70px',
                      }} />

                      {/* Top accent line */}
                      <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0,
                        height: '5px',
                        background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
                      }} />

                      {/* LOGO row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '72px' }}>
                        {/* Hollow hex */}
                        <svg width="52" height="52" viewBox="0 0 100 100" fill="none">
                          <path d="M 50,6 L 88.1,28 L 88.1,72 L 50,94" stroke={theme.accent} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M 50,94 L 11.9,72 L 11.9,28 L 50,6" stroke={theme.accent} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity="0.28" />
                        </svg>
                        <div style={{
                          fontSize: '40px',
                          fontFamily: "'Cormorant Garamond', Georgia, serif",
                          fontStyle: 'italic',
                          fontWeight: 600,
                          color: theme.textPrimary,
                          letterSpacing: '0.01em',
                          lineHeight: 1,
                        }}>
                          Run<span style={{ color: theme.accent }}>ivo</span>
                        </div>
                      </div>

                      {/* Main content row */}
                      <div style={{ display: 'flex', gap: '64px', flex: 1, alignItems: 'flex-start' }}>
                        {/* Left — avatar + name + stats */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          {/* Hexagon avatar */}
                          <div style={{ marginBottom: '40px' }}>
                            <svg width="140" height="160" viewBox="0 0 140 160">
                              <defs>
                                <clipPath id="hex-clip">
                                  <polygon points="70,5 135,42.5 135,117.5 70,155 5,117.5 5,42.5" />
                                </clipPath>
                              </defs>
                              <polygon
                                points="70,5 135,42.5 135,117.5 70,155 5,117.5 5,42.5"
                                fill={avatarHex}
                                opacity="0.15"
                              />
                              <polygon
                                points="70,5 135,42.5 135,117.5 70,155 5,117.5 5,42.5"
                                fill="none"
                                stroke={avatarHex}
                                strokeWidth="3"
                                opacity="0.6"
                              />
                              <text
                                x="70"
                                y="95"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize="72"
                                fontWeight="700"
                                fill={avatarHex}
                                fontFamily="'Plus Jakarta Sans', 'Inter', sans-serif"
                              >
                                {profile.username.charAt(0).toUpperCase()}
                              </text>
                            </svg>
                          </div>

                          {/* Username */}
                          <div style={{
                            fontSize: '64px',
                            fontFamily: "'Cormorant Garamond', Georgia, serif",
                            fontStyle: 'italic',
                            fontWeight: 600,
                            color: theme.textPrimary,
                            lineHeight: 1.1,
                            marginBottom: '8px',
                            letterSpacing: '-0.01em',
                          }}>
                            {profile.username}
                          </div>

                          {/* Level title */}
                          <div style={{
                            fontSize: '26px',
                            color: theme.accent,
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                            marginBottom: '56px',
                          }}>
                            Lv.{profile.level} · {profile.levelTitle}
                          </div>

                          {/* Stats grid */}
                          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                            {stats.map((s) => (
                              <div key={s.label} style={{
                                background: theme.surface,
                                border: `1px solid ${theme.border}`,
                                borderRadius: '20px',
                                padding: '24px 28px',
                                minWidth: '100px',
                              }}>
                                <div style={{
                                  fontSize: '52px',
                                  fontWeight: 800,
                                  color: s.label === 'ZONES' ? theme.accent : s.label === 'STREAK' ? '#F97316' : theme.textPrimary,
                                  fontFamily: "'JetBrains Mono', monospace",
                                  lineHeight: 1,
                                  marginBottom: '8px',
                                }}>
                                  {s.value}
                                </div>
                                <div style={{
                                  fontSize: '18px',
                                  color: theme.textSecondary,
                                  letterSpacing: '0.18em',
                                  textTransform: 'uppercase' as const,
                                  fontWeight: 500,
                                }}>
                                  {s.label}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Right — QR code */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '16px' }}>
                          {/* QR card */}
                          <div style={{
                            background: theme.surface,
                            border: `1px solid ${theme.border}`,
                            borderRadius: '24px',
                            padding: '28px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '20px',
                          }}>
                            {qrDataUrl ? (
                              <img
                                src={qrDataUrl}
                                width={220}
                                height={220}
                                style={{ borderRadius: '12px', display: 'block' }}
                                alt="QR code"
                              />
                            ) : (
                              <div style={{ width: 220, height: 220, background: theme.accentFaded, borderRadius: '12px' }} />
                            )}
                            <div style={{
                              fontSize: '20px',
                              color: theme.textSecondary,
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase' as const,
                              textAlign: 'center' as const,
                            }}>
                              Scan to join
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bottom tagline */}
                      <div style={{
                        marginTop: '64px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <div style={{
                          fontSize: '24px',
                          color: theme.textSecondary,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase' as const,
                          fontWeight: 500,
                        }}>
                          Run · Capture · Conquer
                        </div>
                        <div style={{
                          fontSize: '22px',
                          color: theme.textSecondary,
                          letterSpacing: '0.06em',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}>
                          runivo.app
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Theme picker */}
              <div className="mb-5">
                <span className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-medium block mb-3">
                  Theme
                </span>
                <div className="flex gap-3">
                  {(Object.keys(themes) as CardTheme[]).map(t => (
                    <button
                      key={t}
                      onClick={() => { setSelectedTheme(t); haptic('light'); }}
                      className={`flex-1 h-12 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                        selectedTheme === t ? 'border-teal-400 scale-105' : 'border-gray-200'
                      }`}
                      style={{ background: themes[t].bg }}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ background: themes[t].accent }} />
                      <span className="text-[11px] font-medium capitalize" style={{ color: themes[t].textSecondary }}>
                        {t}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Share button */}
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={generateImage}
                disabled={generating}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600
                           text-base font-bold text-white
                           shadow-[0_4px_20px_rgba(0,180,198,0.3)]
                           disabled:opacity-50 disabled:cursor-not-allowed mb-3"
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
                ) : generated ? 'Shared!' : 'Share Profile'}
              </motion.button>

              {/* Copy link */}
              <button
                onClick={copyLink}
                className="w-full py-3 rounded-2xl bg-gray-50 border border-gray-200
                           text-sm font-semibold text-gray-500 mb-3"
              >
                Copy Invite Link
              </button>

              <button
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-gray-100 border border-gray-200
                           text-sm font-medium text-gray-400 mb-6"
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
