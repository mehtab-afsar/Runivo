import { useState } from 'react';
import { useTheme } from '@/shared/hooks/useTheme';
import { RunivoLogo } from '@shared/ui/RunivoLogo';
import { color, space, radius, type as t, shadow, territory, tier, rank } from './tokens';

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { dark } = useTheme();
  return (
    <div className="mb-10">
      <p style={{
        fontSize: t.size.label,
        fontWeight: t.weight.semibold,
        letterSpacing: t.tracking.widest,
        textTransform: 'uppercase',
        color: color.primary,
        marginBottom: space[3],
      }}>
        {title}
      </p>
      <div
        style={{
          background: dark ? color.dark.surface : color.light.surface,
          border: `1px solid ${dark ? color.dark.border : color.light.border}`,
          borderRadius: radius.card,
          padding: space[6],
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Color Swatch ─────────────────────────────────────────────────────────────
function Swatch({ hex, label, ring }: { hex: string; label: string; ring?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: space[2] }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: radius.md,
        background: hex,
        boxShadow: ring ? shadow.primary : undefined,
        border: '1px solid rgba(255,255,255,0.08)',
      }} />
      <span style={{ fontSize: t.size.label, color: 'inherit', opacity: 0.5, textAlign: 'center', maxWidth: 60 }}>{label}</span>
      <span style={{ fontSize: t.size.label, fontFamily: 'monospace', opacity: 0.35 }}>{hex}</span>
    </div>
  );
}

// ─── Pill chip ────────────────────────────────────────────────────────────────
function Chip({ label, active, dark }: { label: string; active?: boolean; dark: boolean }) {
  return (
    <div style={{
      padding: `${space[1] + 2}px ${space[3]}px`,
      borderRadius: radius.pill,
      fontSize: t.size.caption,
      fontWeight: t.weight.medium,
      background: active ? color.primary : dark ? color.dark.card : '#F1F5F9',
      color: active ? '#fff' : dark ? color.textDark.secondary : color.textLight.secondary,
      border: `1px solid ${active ? 'transparent' : dark ? color.dark.border : color.light.border}`,
      cursor: 'pointer',
      transition: `all ${150}ms ease`,
    }}>
      {label}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ value, unit, label, dark }: { value: string; unit: string; label: string; dark: boolean }) {
  return (
    <div style={{
      flex: 1,
      background: dark ? color.dark.card : '#F8FAFF',
      border: `1px solid ${dark ? color.dark.border : color.light.border}`,
      borderRadius: radius.lg,
      padding: `${space[4]}px ${space[3]}px`,
      textAlign: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 3 }}>
        <span style={{ fontSize: t.size.h2, fontWeight: t.weight.bold, color: dark ? color.textDark.primary : color.textLight.primary, lineHeight: 1 }}>
          {value}
        </span>
        <span style={{ fontSize: t.size.caption, fontWeight: t.weight.medium, color: color.primary }}>
          {unit}
        </span>
      </div>
      <p style={{ fontSize: t.size.label, fontWeight: t.weight.medium, letterSpacing: t.tracking.wider, textTransform: 'uppercase', color: dark ? color.textDark.muted : color.textLight.muted, marginTop: space[1] }}>
        {label}
      </p>
    </div>
  );
}

// ─── Leaderboard row ─────────────────────────────────────────────────────────
function LeaderRow({ position, name, km, zones, isYou, dark }: {
  position: number; name: string; km: string; zones: number; isYou?: boolean; dark: boolean;
}) {
  const rankStyle = position === 1 ? rank.gold : position === 2 ? rank.silver : position === 3 ? rank.bronze : null;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: `${space[3]}px ${space[4]}px`,
      borderRadius: radius.lg,
      marginBottom: space[2],
      background: isYou ? color.primaryDim : dark ? color.dark.card : '#F8FAFF',
      border: `1px solid ${isYou ? color.primary : dark ? color.dark.border : color.light.border}`,
      gap: space[3],
    }}>
      <div style={{
        width: 28,
        height: 28,
        borderRadius: radius.pill,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: t.size.caption,
        fontWeight: t.weight.bold,
        background: rankStyle ? rankStyle.bg : 'transparent',
        color: rankStyle ? rankStyle.text : dark ? color.textDark.muted : color.textLight.muted,
        border: rankStyle ? `1px solid ${rankStyle.border}` : '1px solid transparent',
        flexShrink: 0,
      }}>
        {position}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: t.size.body, fontWeight: isYou ? t.weight.semibold : t.weight.medium, color: dark ? color.textDark.primary : color.textLight.primary }}>
          {name} {isYou && <span style={{ fontSize: t.size.label, color: color.primary, fontWeight: t.weight.semibold }}>(you)</span>}
        </p>
        <p style={{ fontSize: t.size.caption, color: dark ? color.textDark.muted : color.textLight.muted }}>
          {zones} zones
        </p>
      </div>
      <span style={{ fontSize: t.size.bodyLg, fontWeight: t.weight.bold, color: dark ? color.textDark.primary : color.textLight.primary }}>
        {km} <span style={{ fontSize: t.size.label, color: color.primary, fontWeight: t.weight.semibold }}>km</span>
      </span>
    </div>
  );
}

// ─── Territory hex badge ──────────────────────────────────────────────────────
function HexBadge({ type: hexType }: { type: 'owned' | 'enemy' | 'neutral' | 'contested' }) {
  const cfg = {
    owned:     { label: 'Owned',     bg: territory.ownedFill, border: territory.owned,   text: territory.owned },
    enemy:     { label: 'Enemy',     bg: territory.enemyFill, border: territory.enemy,   text: territory.enemy },
    neutral:   { label: 'Neutral',   bg: 'rgba(107,114,128,0.15)', border: '#6B7280',   text: '#6B7280' },
    contested: { label: 'Contested', bg: color.goldDim,       border: color.gold,        text: color.gold },
  }[hexType];

  return (
    <div style={{
      padding: `${space[1]}px ${space[3]}px`,
      borderRadius: radius.pill,
      fontSize: t.size.caption,
      fontWeight: t.weight.semibold,
      background: cfg.bg,
      color: cfg.text,
      border: `1px solid ${cfg.border}`,
    }}>
      {cfg.label}
    </div>
  );
}

// ─── Tier badge ───────────────────────────────────────────────────────────────
function TierBadge({ id }: { id: keyof typeof tier }) {
  const cfg = tier[id];
  return (
    <div style={{
      padding: `${space[1]}px ${space[3]}px`,
      borderRadius: radius.pill,
      fontSize: t.size.caption,
      fontWeight: t.weight.semibold,
      background: cfg.bg,
      color: cfg.color,
      border: `1px solid ${cfg.color}40`,
      display: 'flex',
      alignItems: 'center',
      gap: space[2],
    }}>
      <span>{cfg.label}</span>
      <span style={{ opacity: 0.6 }}>{cfg.mult}</span>
    </div>
  );
}

// ─── Bottom sheet preview ─────────────────────────────────────────────────────
function BottomSheetPreview({ dark }: { dark: boolean }) {
  return (
    <div style={{
      background: dark ? color.dark.card : color.light.surface,
      border: `1px solid ${dark ? color.dark.border : color.light.border}`,
      borderRadius: `${radius.xl}px ${radius.xl}px 0 0`,
      padding: `${space[3]}px ${space[6]}px ${space[6]}px`,
    }}>
      {/* handle */}
      <div style={{ width: 36, height: 4, borderRadius: radius.pill, background: dark ? 'rgba(255,255,255,0.15)' : '#E2E8F0', margin: '0 auto', marginBottom: space[5] }} />
      <p style={{ fontSize: t.size.title, fontWeight: t.weight.bold, color: dark ? color.textDark.primary : color.textLight.primary, marginBottom: space[2] }}>
        Hex #4A2B
      </p>
      <p style={{ fontSize: t.size.caption, color: dark ? color.textDark.muted : color.textLight.muted, marginBottom: space[4] }}>
        Defense 72 / 100 · Tier: Rare · Income 2.0×
      </p>
      <div style={{ height: 6, background: dark ? color.dark.surface : '#F1F5F9', borderRadius: radius.pill, overflow: 'hidden', marginBottom: space[5] }}>
        <div style={{ width: '72%', height: '100%', background: color.primary, borderRadius: radius.pill }} />
      </div>
      <button style={{
        width: '100%',
        padding: `${space[4]}px`,
        borderRadius: radius.lg,
        background: color.primary,
        color: '#fff',
        fontSize: t.size.body,
        fontWeight: t.weight.semibold,
        border: 'none',
        cursor: 'pointer',
        boxShadow: shadow.primary,
      }}>
        Fortify Territory
      </button>
    </div>
  );
}

// ─── Underline tabs ───────────────────────────────────────────────────────────
function UnderlineTabs({ dark }: { dark: boolean }) {
  const [active, setActive] = useState(0);
  const tabs = ['This Week', 'This Month', 'All Time'];
  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${dark ? color.dark.border : color.light.border}`, gap: space[6] }}>
      {tabs.map((tab, i) => (
        <button
          key={tab}
          onClick={() => setActive(i)}
          style={{
            paddingBottom: space[3],
            fontSize: t.size.body,
            fontWeight: active === i ? t.weight.semibold : t.weight.regular,
            color: active === i ? color.primary : dark ? color.textDark.muted : color.textLight.muted,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderBottom: active === i ? `2px solid ${color.primary}` : '2px solid transparent',
            marginBottom: -1,
            transition: 'all 150ms ease',
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DesignSystemPage() {
  const { dark, setDark } = useTheme();
  const [activeChip, setActiveChip] = useState('All');

  const bg   = dark ? color.dark.bg      : color.light.bg;
  const text = dark ? color.textDark.primary : color.textLight.primary;

  return (
    <div style={{ minHeight: '100vh', background: bg, color: text, fontFamily: t.sans }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: dark ? `${color.dark.bg}E6` : `${color.light.bg}E6`,
        backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${dark ? color.dark.border : color.light.border}`,
        padding: `${space[4]}px ${space[6]}px`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
          <RunivoLogo size={28} />
          <div>
            <p style={{ fontSize: t.size.label, letterSpacing: t.tracking.widest, textTransform: 'uppercase', color: color.primary, fontWeight: t.weight.semibold }}>
              Design System
            </p>
            <p style={{ fontSize: t.size.caption, color: dark ? color.textDark.muted : color.textLight.muted }}>
              Tokens · Components · Patterns
            </p>
          </div>
        </div>
        <button
          onClick={() => setDark(!dark)}
          style={{
            padding: `${space[2]}px ${space[4]}px`,
            borderRadius: radius.pill,
            fontSize: t.size.caption,
            fontWeight: t.weight.medium,
            background: dark ? color.dark.card : '#F1F5F9',
            color: dark ? color.textDark.secondary : color.textLight.secondary,
            border: `1px solid ${dark ? color.dark.border : color.light.border}`,
            cursor: 'pointer',
          }}
        >
          {dark ? '☀️ Light' : '🌙 Dark'}
        </button>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: `${space[8]}px ${space[6]}px ${space[16]}px` }}>

        {/* ── Logo & Wordmark ── */}
        <Section title="Logo & Wordmark">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[8], alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: space[3] }}>
              <RunivoLogo size={48} />
              <span style={{ fontSize: t.size.label, color: dark ? color.textDark.muted : color.textLight.muted }}>Icon only</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: space[3] }}>
              <RunivoLogo size={40} wordmark onDark={dark} />
              <span style={{ fontSize: t.size.label, color: dark ? color.textDark.muted : color.textLight.muted }}>With wordmark</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: space[3] }}>
              <div style={{ background: color.primary, padding: `${space[3]}px ${space[5]}px`, borderRadius: radius.lg }}>
                <RunivoLogo size={36} wordmark onDark />
              </div>
              <span style={{ fontSize: t.size.label, color: dark ? color.textDark.muted : color.textLight.muted }}>On teal bg</span>
            </div>
          </div>
        </Section>

        {/* ── Colors ── */}
        <Section title="Color Tokens">
          <p style={{ fontSize: t.size.caption, color: dark ? color.textDark.muted : color.textLight.muted, marginBottom: space[4] }}>Brand</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[5], marginBottom: space[6] }}>
            <Swatch hex={color.primary}      label="Crimson" ring />
            <Swatch hex={color.primaryLight} label="Crimson Light" />
            <Swatch hex={color.primaryDim}   label="Crimson Dim" />
            <Swatch hex={color.secondary}    label="Lavender" />
            <Swatch hex={color.secondaryDim} label="Lavender Dim" />
          </div>
          <p style={{ fontSize: t.size.caption, color: dark ? color.textDark.muted : color.textLight.muted, marginBottom: space[4] }}>Semantic</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[5], marginBottom: space[6] }}>
            <Swatch hex={color.enemy}   label="Enemy" />
            <Swatch hex={color.gold}    label="Gold / XP" />
            <Swatch hex={color.success} label="Success" />
            <Swatch hex={color.warning} label="Warning" />
          </div>
          <p style={{ fontSize: t.size.caption, color: dark ? color.textDark.muted : color.textLight.muted, marginBottom: space[4] }}>Surfaces ({dark ? 'dark mode' : 'light mode'})</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[5] }}>
            {dark
              ? <>
                  <Swatch hex={color.dark.bg}      label="BG" />
                  <Swatch hex={color.dark.surface}  label="Surface" />
                  <Swatch hex={color.dark.card}     label="Card" />
                </>
              : <>
                  <Swatch hex={color.light.bg}      label="BG" />
                  <Swatch hex={color.light.surface} label="Surface" />
                  <Swatch hex={color.light.card}    label="Card" />
                </>
            }
          </div>
        </Section>

        {/* ── Typography ── */}
        <Section title="Typography Scale">
          {([
            [t.size.h1,      t.weight.black,    'H1 · 36px Black',      'Run. Capture. Conquer.'],
            [t.size.h2,      t.weight.bold,     'H2 · 28px Bold',       'Your Territory'],
            [t.size.title,   t.weight.semibold, 'Title · 22px Semibold','Weekly Progress'],
            [t.size.subhead, t.weight.medium,   'Subhead · 18px Medium','5 Zones Owned'],
            [t.size.bodyLg,  t.weight.medium,   'Body Lg · 16px Medium','Fortify your weakest zones'],
            [t.size.body,    t.weight.regular,  'Body · 14px Regular',  'Defense regens while you run'],
            [t.size.caption, t.weight.regular,  'Caption · 12px',       '3.2 km · 5:42 pace · 280 cal'],
            [t.size.label,   t.weight.semibold, 'Label · 10px Semibold · UPPERCASE', 'TERRITORY · DEFENSE · INCOME'],
          ] as const).map(([size, weight, meta, example]) => (
            <div key={meta} style={{ marginBottom: space[4], paddingBottom: space[4], borderBottom: `1px solid ${dark ? color.dark.divider : color.light.divider}` }}>
              <p style={{ fontSize: t.size.label, color: color.primary, letterSpacing: t.tracking.wide, marginBottom: space[1] }}>{meta}</p>
              <p style={{ fontSize: size, fontWeight: weight, color: dark ? color.textDark.primary : color.textLight.primary, letterSpacing: size >= t.size.h2 ? t.tracking.tight : t.tracking.normal }}>
                {example}
              </p>
            </div>
          ))}
        </Section>

        {/* ── Filter Chips ── */}
        <Section title="Filter Pills / Chips">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[2] }}>
            {['All', 'Owned', 'Enemy', 'Neutral', 'Contested'].map(label => (
              <div key={label} onClick={() => setActiveChip(label)} style={{ cursor: 'pointer' }}>
                <Chip label={label} active={activeChip === label} dark={dark} />
              </div>
            ))}
          </div>
        </Section>

        {/* ── Stat Cards ── */}
        <Section title="Stat Cards (3-col grid)">
          <div style={{ display: 'flex', gap: space[3] }}>
            <StatCard value="5.4"  unit="km"  label="Distance" dark={dark} />
            <StatCard value="4:58" unit="/km" label="Pace"     dark={dark} />
            <StatCard value="28"   unit="min" label="Time"     dark={dark} />
          </div>
          <div style={{ display: 'flex', gap: space[3], marginTop: space[3] }}>
            <StatCard value="312" unit="cal"  label="Calories" dark={dark} />
            <StatCard value="7"   unit="🔥"   label="Streak"   dark={dark} />
            <StatCard value="4"   unit=""     label="Zones"    dark={dark} />
          </div>
        </Section>

        {/* ── Leaderboard Rows ── */}
        <Section title="Leaderboard Rows">
          <LeaderRow position={1} name="shadowrunner" km="82.4" zones={34} dark={dark} />
          <LeaderRow position={2} name="vex_empire"   km="74.1" zones={28} dark={dark} />
          <LeaderRow position={3} name="ghostmile"    km="68.9" zones={25} dark={dark} />
          <LeaderRow position={4} name="you"          km="61.2" zones={22} isYou dark={dark} />
          <LeaderRow position={5} name="duskrunner"   km="55.0" zones={19} dark={dark} />
        </Section>

        {/* ── Tabs ── */}
        <Section title="Underline Tabs">
          <UnderlineTabs dark={dark} />
        </Section>

        {/* ── Territory Status ── */}
        <Section title="Territory Status Badges">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[3] }}>
            <HexBadge type="owned" />
            <HexBadge type="enemy" />
            <HexBadge type="neutral" />
            <HexBadge type="contested" />
          </div>
        </Section>

        {/* ── Tier Badges ── */}
        <Section title="Territory Tier Badges">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[3] }}>
            {(Object.keys(tier) as Array<keyof typeof tier>).map(id => (
              <TierBadge key={id} id={id} />
            ))}
          </div>
        </Section>

        {/* ── Buttons ── */}
        <Section title="Buttons">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[3], alignItems: 'center' }}>
            {/* Primary */}
            <button style={{
              padding: `${space[4]}px ${space[6]}px`,
              borderRadius: radius.lg,
              background: color.primary,
              color: '#fff',
              fontSize: t.size.body,
              fontWeight: t.weight.semibold,
              border: 'none',
              cursor: 'pointer',
              boxShadow: shadow.primary,
            }}>
              Primary Action
            </button>
            {/* Secondary */}
            <button style={{
              padding: `${space[4]}px ${space[6]}px`,
              borderRadius: radius.lg,
              background: 'transparent',
              color: color.primary,
              fontSize: t.size.body,
              fontWeight: t.weight.semibold,
              border: `1.5px solid ${color.primary}`,
              cursor: 'pointer',
            }}>
              Secondary
            </button>
            {/* Danger */}
            <button style={{
              padding: `${space[4]}px ${space[6]}px`,
              borderRadius: radius.lg,
              background: color.enemyDim,
              color: color.enemy,
              fontSize: t.size.body,
              fontWeight: t.weight.semibold,
              border: `1.5px solid ${color.enemy}40`,
              cursor: 'pointer',
            }}>
              Danger
            </button>
            {/* Ghost */}
            <button style={{
              padding: `${space[4]}px ${space[6]}px`,
              borderRadius: radius.lg,
              background: dark ? color.dark.card : '#F1F5F9',
              color: dark ? color.textDark.secondary : color.textLight.secondary,
              fontSize: t.size.body,
              fontWeight: t.weight.medium,
              border: `1px solid ${dark ? color.dark.border : color.light.border}`,
              cursor: 'pointer',
            }}>
              Ghost
            </button>
          </div>
        </Section>

        {/* ── Progress bars ── */}
        <Section title="Progress Bars">
          {[
            { label: 'Defense', value: 72, color: color.primary },
            { label: 'Weekly Goal', value: 58, color: color.gold },
            { label: 'XP to next level', value: 40, color: '#8B5CF6' },
            { label: 'Energy', value: 85, color: color.success },
          ].map(({ label, value, color: c }) => (
            <div key={label} style={{ marginBottom: space[4] }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: space[1] }}>
                <span style={{ fontSize: t.size.caption, color: dark ? color.textDark.secondary : color.textLight.secondary }}>{label}</span>
                <span style={{ fontSize: t.size.caption, fontWeight: t.weight.semibold, color: c }}>{value}%</span>
              </div>
              <div style={{ height: 6, background: dark ? color.dark.surface : '#F1F5F9', borderRadius: radius.pill, overflow: 'hidden' }}>
                <div style={{ width: `${value}%`, height: '100%', background: c, borderRadius: radius.pill, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          ))}
        </Section>

        {/* ── Bottom Sheet ── */}
        <Section title="Bottom Sheet Pattern">
          <BottomSheetPreview dark={dark} />
        </Section>

        {/* ── Spacing ── */}
        <Section title="Spacing Scale">
          <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
            {([1, 2, 3, 4, 5, 6, 8, 10, 12, 16] as const).map(key => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: space[4] }}>
                <div style={{ width: space[key], height: 16, background: color.primary, borderRadius: 2, flexShrink: 0 }} />
                <span style={{ fontSize: t.size.caption, color: dark ? color.textDark.muted : color.textLight.muted, fontFamily: 'monospace' }}>
                  space[{key}] = {space[key]}px
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Shadows ── */}
        <Section title="Shadows / Glow">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[5] }}>
            {[
              { label: 'Crimson Glow',  s: shadow.primary,  bg: color.primary },
              { label: 'Lavender Glow', s: shadow.lavender,  bg: color.secondary },
              { label: 'Enemy Glow',    s: shadow.enemy,     bg: color.enemy },
              { label: 'Card',          s: shadow.card,      bg: dark ? color.dark.card : color.light.card },
            ].map(({ label, s, bg }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: space[3] }}>
                <div style={{ width: 64, height: 64, borderRadius: radius.lg, background: bg, boxShadow: s }} />
                <span style={{ fontSize: t.size.label, color: dark ? color.textDark.muted : color.textLight.muted }}>{label}</span>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </div>
  );
}
