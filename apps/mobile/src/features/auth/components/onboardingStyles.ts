import { StyleSheet } from 'react-native';
import { Fonts, Type, type AppColors } from '@theme';

/**
 * Shared look for the onboarding steps (matches the welcome screen): big
 * Archivo uppercase titles, Geist body, white 20px cards on the paper canvas,
 * an orange border for what's chosen.
 */
export function mkStep(C: AppColors) {
  return StyleSheet.create({
    content:     { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 32 },
    eyebrow:     { fontFamily: Fonts.semiBold, fontSize: 13, color: C.red, marginBottom: 8 },
    title:       { ...Type.hero, fontSize: 52, lineHeight: 47, color: C.t1 },
    sub:         { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 22, color: C.t2, marginTop: 12, marginBottom: 24 },
    label:       { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1, marginBottom: 10, marginTop: 6 },
    note:        { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18, color: C.t3, marginTop: 12 },

    card:        {
      flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, minHeight: 72, marginBottom: 10,
      borderRadius: 20, backgroundColor: C.card, borderWidth: 2, borderColor: C.card,
    },
    cardOn:      { borderColor: C.red },
    cardIcon:    { width: 44, height: 44, borderRadius: 14, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    cardIconOn:  { backgroundColor: C.redLo },
    cardTitle:   { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    cardSub:     { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, marginTop: 2 },

    chips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
    chip:        {
      minWidth: 48, height: 44, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.card,
      borderWidth: 1.5, borderColor: C.card, alignItems: 'center', justifyContent: 'center',
    },
    chipOn:      { backgroundColor: C.alwaysDark, borderColor: C.alwaysDark },
    chipText:    { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    chipTextOn:  { color: C.alwaysLight },

    input:       {
      height: 56, borderRadius: 18, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border,
      paddingHorizontal: 16, fontFamily: Fonts.medium, fontSize: 18, color: C.t1,
    },
    inputError:  { borderColor: C.red },
    error:       { fontFamily: Fonts.medium, fontSize: 13, color: C.red, marginTop: 8 },

    statCard:    { backgroundColor: C.card, borderRadius: 20, padding: 18, marginTop: 4 },
    statNum:     { fontFamily: Fonts.numeric, fontSize: 40, lineHeight: 42, color: C.t1, fontVariant: ['tabular-nums'] },
    statUnit:    { fontFamily: Fonts.medium, fontSize: 14, color: C.t2 },
  });
}

export type StepStyles = ReturnType<typeof mkStep>;
