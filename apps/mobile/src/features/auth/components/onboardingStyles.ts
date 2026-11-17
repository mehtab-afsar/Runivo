import { StyleSheet } from 'react-native';
import { Fonts, type AppColors } from '@theme';

/**
 * Shared look for the onboarding steps (2026 redesign): Outfit sentence-case
 * titles, white 20px cards on the light grey canvas, an ink border and mint
 * fill for what's chosen, and a lavender "Why PaceX asks" note.
 */
export function mkStep(C: AppColors) {
  return StyleSheet.create({
    content:     { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 32 },
    eyebrow:     { fontFamily: Fonts.semiBold, fontSize: 13, color: C.green, marginBottom: 8 },
    title:       { fontFamily: Fonts.semiBold, fontSize: 32, lineHeight: 37, letterSpacing: -0.9, color: C.t1 },
    sub:         { fontFamily: Fonts.regular, fontSize: 16, lineHeight: 23, color: C.t2, marginTop: 10, marginBottom: 18 },
    label:       { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1, marginBottom: 10, marginTop: 6 },
    note:        { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18, color: C.t3, marginTop: 12 },

    card:        {
      flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, minHeight: 72, marginBottom: 10,
      borderRadius: 20, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border,
    },
    cardOn:      { borderWidth: 2, borderColor: C.t1, backgroundColor: C.mint },
    cardIcon:    { width: 44, height: 44, borderRadius: 14, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    cardIconOn:  { backgroundColor: C.mint2 },
    cardTitle:   { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    cardSub:     { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, marginTop: 2 },

    chips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
    chip:        {
      minWidth: 48, height: 44, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.card,
      borderWidth: 1.5, borderColor: C.card, alignItems: 'center', justifyContent: 'center',
    },
    // Even layouts, so no option sits alone on its own line ("7", "Sunday"):
    // `row` + `cell` share one line equally; `grid` + `gridCell` make balanced rows of four.
    row:         { flexDirection: 'row', gap: 6, marginBottom: 18 },
    cell:        { flex: 1, minWidth: 0, paddingHorizontal: 4 },
    grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
    gridCell:    { flexBasis: '22%', flexGrow: 1, paddingHorizontal: 6 },
    chipOn:      { backgroundColor: C.alwaysDark, borderColor: C.alwaysDark },
    chipText:    { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    chipTextOn:  { color: C.alwaysLight },

    input:       {
      height: 56, borderRadius: 18, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border,
      paddingHorizontal: 16, fontFamily: Fonts.medium, fontSize: 18, color: C.t1,
    },
    inputError:  { borderColor: C.danger },
    error:       { fontFamily: Fonts.medium, fontSize: 13, color: C.danger, marginTop: 8 },

    statCard:    { backgroundColor: C.card, borderRadius: 20, padding: 18, marginTop: 4 },
    statNum:     { fontFamily: Fonts.numeric, fontSize: 40, lineHeight: 42, color: C.t1, fontVariant: ['tabular-nums'] },
    statUnit:    { fontFamily: Fonts.medium, fontSize: 14, color: C.t2 },

    why:         { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 16, backgroundColor: C.lavender, marginTop: 16 },
    whyOrb:      { width: 20, height: 20, borderRadius: 10, backgroundColor: '#7C72D8', marginTop: 1 },
    whyText:     { flex: 1, fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18, color: C.lavenderInk },
    whyStrong:   { fontFamily: Fonts.semiBold },
  });
}

export type StepStyles = ReturnType<typeof mkStep>;
