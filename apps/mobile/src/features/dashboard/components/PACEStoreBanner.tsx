import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Diamond, ArrowRight } from 'lucide-react-native';
import { useTheme, Type, Fonts, Spacing, type AppColors } from '@theme';

interface Props {
  paceBalance: number;
  weeklyEarned: number;
  weeklyCap: number;
  onPress: () => void;
}

// Standard neutral card — a preview/entry point into the Store, not the place
// specific rewards live. Reward names/discounts belong on PACEStoreScreen only.
export function PACEStoreBanner({ paceBalance, weeklyEarned, weeklyCap, onPress }: Props) {
  const C  = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const fillPct = Math.min(100, Math.round(weeklyCap > 0 ? (weeklyEarned / weeklyCap) * 100 : 0));

  return (
    <Pressable
      style={({ pressed }) => [ss.wrap, pressed && ss.pressed]}
      onPress={onPress}
      android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
    >
      <Text style={ss.eyebrow}>PACE Store</Text>

      <View style={ss.main}>
        <View style={ss.iconWrap}>
          <Diamond size={28} color={C.gold} strokeWidth={1.5} />
        </View>
        <View style={ss.textBlock}>
          <Text style={ss.headline}>Every kilometer earns PACE</Text>
          <Text style={ss.subtext}>{paceBalance.toLocaleString()} PACE saved · {weeklyCap} cap this week</Text>
        </View>
      </View>

      {/* Weekly progress bar */}
      <View style={ss.weeklyWrap}>
        <View style={ss.weeklyTrack}>
          <View style={[ss.weeklyFill, { width: `${fillPct}%` }]} />
        </View>
        <Text style={ss.weeklyLabel}>{weeklyEarned} / {weeklyCap} PACE this week</Text>
      </View>

      <View style={ss.ctaRow}>
        <Text style={ss.ctaTxt}>View rewards</Text>
        <ArrowRight size={13} color={C.red} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    wrap:        { marginHorizontal: Spacing.gutter, marginBottom: 16, borderRadius: 16, padding: 16, backgroundColor: C.card, borderWidth: 0.5, borderColor: C.border },
    pressed:     { opacity: 0.85 },
    eyebrow:     { ...Type.overline, color: C.t3, marginBottom: 12 },

    main:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    iconWrap:    { width: 44, height: 44, borderRadius: 12, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
    textBlock:   { flex: 1 },
    headline:    { ...Type.body, fontFamily: Fonts.medium, color: C.t1 },
    subtext:     { ...Type.caption, color: C.t2, marginTop: 3, fontVariant: ['tabular-nums'] },

    weeklyWrap:  { marginBottom: 14 },
    weeklyTrack: { height: 4, borderRadius: 2, backgroundColor: C.border, overflow: 'hidden', marginBottom: 6 },
    weeklyFill:  { height: 4, backgroundColor: C.gold, borderRadius: 2 },
    weeklyLabel: { ...Type.caption, color: C.t3, fontVariant: ['tabular-nums'] },

    ctaRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 12 },
    ctaTxt:      { ...Type.label, fontFamily: Fonts.semiBold, color: C.red },
  });
}
