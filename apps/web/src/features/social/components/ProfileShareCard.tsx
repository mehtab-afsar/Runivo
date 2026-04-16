import { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
    avatarColor?: string;
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
    accent: '#D93518',
    accentFaded: 'rgba(217,53,24,0.15)',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.45)',
    qrDark: '#D93518',
    qrLight: '#0A0A0F',
    border: 'rgba(255,255,255,0.08)',
  },
  deep: {
    bg: '#040E14',
    surface: 'rgba(217,53,24,0.06)',
    accent: '#D93518',
    accentFaded: 'rgba(217,53,24,0.12)',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.4)',
    qrDark: '#D93518',
    qrLight: '#040E14',
    border: 'rgba(217,53,24,0.15)',
  },
  light: {
    bg: '#FFFFFF',
    surface: 'rgba(0,0,0,0.04)',
    accent: '#D93518',
    accentFaded: 'rgba(217,53,24,0.08)',
    textPrimary: '#0F172A',
    textSecondary: 'rgba(15,23,42,0.4)',
    qrDark: '#D93518',
    qrLight: '#FFFFFF',
    border: 'rgba(0,0,0,0.06)',
  },
};

const AVATAR_HEX_COLORS: Record<string, string> = {
  teal: '#D93518',
  indigo: '#6366F1',
  rose: '#F43F5E',
  amber: '#9E6800',
  violet: '#8B5CF6',
  emerald: '#1A6B40',
  sky: '#0EA5E9',
  orange: '#F97316',
};

/** Renders the 1080×1920 card content. Used for both capture and preview. */
function CardBody({
  theme,
  avatarHex,
  profile,
  stats,
  qrDataUrl,
}: {
  theme: (typeof themes)[CardTheme];
  avatarHex: string;
  profile: ProfileShareCardProps['profile'];
  stats: { label: string; value: string }[];
  qrDataUrl: string;
}) {
  return (
    <>
      {/* Hex grid background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.03,
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='92' viewBox='0 0 80 92' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 0L80 23V69L40 92L0 69V23L40 0Z' fill='none' stroke='white' stroke-width='1'/%3E%3C/svg%3E")`,
        backgroundSize: '80px 92px',
      }} />

      {/* Top glow */}
      <div style={{
        position: 'absolute',
        top: '-200px', left: '50%',
        transform: 'translateX(-50%)',
        width: '800px',
        height: '600px',
        background: `radial-gradient(ellipse at center, ${theme.accent}22 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Top accent line */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '5px',
        background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
      }} />

      {/* LOGO row — centered */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '22px', marginBottom: '100px' }}>
        <svg width="56" height="56" viewBox="0 0 100 100" fill="none">
          <path d="M 50,6 L 88.1,28 L 88.1,72 L 50,94" stroke={theme.accent} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 50,94 L 11.9,72 L 11.9,28 L 50,6" stroke={theme.accent} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity="0.28" />
        </svg>
        <div style={{
          fontSize: '52px',
          fontFamily: 'Georgia, serif',
          fontStyle: 'italic',
          fontWeight: 600,
          color: theme.textPrimary,
          letterSpacing: '0.02em',
          lineHeight: 1,
        }}>
          Run<span style={{ color: theme.accent }}>ivo</span>
        </div>
      </div>

      {/* Avatar — centered, large */}
      <div style={{ marginBottom: '44px' }}>
        <svg width="220" height="252" viewBox="0 0 220 252">
          <polygon points="110,8 211,65.5 211,186.5 110,244 9,186.5 9,65.5" fill={avatarHex} opacity="0.08" />
          <polygon points="110,8 211,65.5 211,186.5 110,244 9,186.5 9,65.5" fill="none" stroke={avatarHex} strokeWidth="3" opacity="0.5" />
          <polygon points="110,28 191,73.5 191,178.5 110,224 29,178.5 29,73.5" fill={avatarHex} opacity="0.18" />
          <text
            x="110" y="136"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="108"
            fontWeight="800"
            fill={avatarHex}
            fontFamily="sans-serif"
          >
            {profile.username.charAt(0).toUpperCase()}
          </text>
        </svg>
      </div>

      {/* Username */}
      <div style={{
        fontSize: '80px',
        fontFamily: 'Georgia, serif',
        fontStyle: 'italic',
        fontWeight: 600,
        color: theme.textPrimary,
        lineHeight: 1,
        marginBottom: '16px',
        letterSpacing: '-0.01em',
        textAlign: 'center',
      }}>
        {profile.username}
      </div>

      {/* Level badge */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        background: theme.accentFaded,
        border: `1px solid ${theme.border}`,
        borderRadius: '100px',
        padding: '12px 36px',
        marginBottom: '80px',
      }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: theme.accent }} />
        <div style={{ fontSize: '28px', color: theme.accent, fontWeight: 700, letterSpacing: '0.04em' }}>
          Lv.{profile.level} · {profile.levelTitle}
        </div>
      </div>

      {/* Stats grid — 2×2 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        width: '100%',
        marginBottom: '80px',
      }}>
        {stats.map((s) => (
          <div key={s.label} style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: '28px',
            padding: '36px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            <div style={{
              fontSize: '72px',
              fontWeight: 800,
              color: s.label === 'ZONES' ? theme.accent : s.label === 'STREAK' ? '#F97316' : theme.textPrimary,
              fontFamily: 'monospace',
              lineHeight: 1,
              marginBottom: '10px',
            }}>
              {s.value}
            </div>
            <div style={{
              fontSize: '20px',
              color: theme.textSecondary,
              letterSpacing: '0.2em',
              textTransform: 'uppercase' as const,
              fontWeight: 600,
              fontFamily: 'sans-serif',
            }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* QR code — centered, prominent */}
      <div style={{
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: '32px',
        padding: '40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        width: '100%',
        marginBottom: 'auto',
      }}>
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            width={280}
            height={280}
            style={{ borderRadius: '16px', display: 'block' }}
            alt="QR code"
          />
        ) : (
          <div style={{ width: 280, height: 280, background: theme.accentFaded, borderRadius: '16px' }} />
        )}
        <div style={{
          fontSize: '24px',
          color: theme.textSecondary,
          letterSpacing: '0.14em',
          textTransform: 'uppercase' as const,
          textAlign: 'center' as const,
          fontWeight: 500,
          fontFamily: 'sans-serif',
        }}>
          Scan to join
        </div>
      </div>

      {/* Bottom tagline */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingTop: '60px',
      }}>
        <div style={{
          fontSize: '24px',
          color: theme.textSecondary,
          letterSpacing: '0.12em',
          textTransform: 'uppercase' as const,
          fontWeight: 500,
          fontFamily: 'sans-serif',
        }}>
          Run · Capture · Conquer
        </div>
        <div style={{
          fontSize: '24px',
          color: theme.textSecondary,
          letterSpacing: '0.06em',
          fontFamily: 'monospace',
        }}>
          runivo.app
        </div>
      </div>
    </>
  );
}

const CARD_STYLE = (bg: string): React.CSSProperties => ({
  width: '1080px',
  height: '1920px',
  background: bg,
  position: 'relative',
  overflow: 'hidden',
  fontFamily: 'sans-serif',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '100px 80px 80px',
  boxSizing: 'border-box',
});

export function ProfileShareCard({ isOpen, onClose, profile }: ProfileShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [selectedTheme, setSelectedTheme] = useState<CardTheme>('dark');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [shareError, setShareError] = useState('');
  const [copyDone, setCopyDone] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const theme = themes[selectedTheme];
  const inviteUrl = `https://runivo.app/join?ref=${encodeURIComponent(profile.username)}`;
  const avatarHex = AVATAR_HEX_COLORS[profile.avatarColor || 'teal'] || '#D93518';

  const stats = [
    { label: 'LEVEL',  value: String(profile.level) },
    { label: 'KM',     value: profile.totalDistanceKm.toFixed(0) },
    { label: 'ZONES',  value: String(profile.totalTerritoriesClaimed) },
    { label: 'STREAK', value: `${profile.streakDays}d` },
  ];

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
    setShareError('');
    haptic('medium');

    try {
      // Capture the off-screen element (full 1080×1920, no parent clip/scale)
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        width: 1080,
        height: 1920,
      });

      // Try native share sheet (mobile)
      if (typeof navigator.share === 'function') {
        try {
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          const file = new File([blob], `runivo-${profile.username}.png`, { type: 'image/png' });
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Join me on Runivo',
              text: `Run with ${profile.username} on Runivo — Run · Capture · Conquer`,
            });
            haptic('success');
            setGenerated(true);
            return;
          }
        } catch (shareErr: unknown) {
          // User cancelled native share — not an error
          if ((shareErr as Error)?.name === 'AbortError') {
            return;
          }
        }
      }

      // Fallback: download the image
      const blob = await (await fetch(dataUrl)).blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `runivo-${profile.username}-${Date.now()}.png`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      haptic('success');
      setGenerated(true);
    } catch (err) {
      console.error('[share]', err);
      haptic('error');
      setShareError('Could not generate image. Try copying the link instead.');
    } finally {
      setGenerating(false);
    }
  }, [profile.username]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      haptic('light');
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    } catch {
      // clipboard not available — show the URL
      setShareError(`Copy manually: ${inviteUrl}`);
    }
  }, [inviteUrl]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Off-screen capture target — full 1080×1920, NO parent clip/transform ── */}
          <div
            style={{
              position: 'fixed',
              left: '-9999px',
              top: 0,
              zIndex: -1,
              pointerEvents: 'none',
            }}
          >
            <div ref={cardRef} style={CARD_STYLE(theme.bg)}>
              <CardBody
                theme={theme}
                avatarHex={avatarHex}
                profile={profile}
                stats={stats}
                qrDataUrl={qrDataUrl}
              />
            </div>
          </div>

          {/* ── Overlay backdrop ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* ── Bottom sheet ── */}
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
              {/* Card preview — visual only, 270×480 = 1080×1920 at 0.25× */}
              <div className="flex justify-center mb-5">
                <div style={{
                  width: '270px',
                  height: '480px',
                  overflow: 'hidden',
                  borderRadius: '20px',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
                  flexShrink: 0,
                }}>
                  <div style={{
                    width: '1080px',
                    height: '1920px',
                    transform: 'scale(0.25)',
                    transformOrigin: 'top left',
                  }}>
                    {/* Visual copy — no ref */}
                    <div style={CARD_STYLE(theme.bg)}>
                      <CardBody
                        theme={theme}
                        avatarHex={avatarHex}
                        profile={profile}
                        stats={stats}
                        qrDataUrl={qrDataUrl}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Error feedback */}
              {shareError && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                  {shareError}
                </div>
              )}

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
                        selectedTheme === t ? 'border-[#D93518] scale-105' : 'border-gray-200'
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
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#D93518] to-[#B82D14]
                           text-base font-bold text-white
                           shadow-[0_4px_20px_rgba(217,53,24,0.3)]
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
                ) : generated ? '✓ Shared!' : 'Share Profile Card'}
              </motion.button>

              {/* Copy link */}
              <button
                onClick={copyLink}
                className="w-full py-3 rounded-2xl bg-gray-50 border border-gray-200
                           text-sm font-semibold text-gray-500 mb-3 transition-colors"
              >
                {copyDone ? '✓ Copied!' : 'Copy Invite Link'}
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
    </AnimatePresence>,
    document.body
  );
}
