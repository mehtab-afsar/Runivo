import { StyleSheet } from 'react-native';
import { Fonts, type AppColors } from '@theme';

// Was a fixed light-only palette (a prior deliberate branded-onboarding
// decision, documented as intentional). Now derived from the live theme so
// onboarding/auth participates in dark mode like the rest of the app —
// callers get a `useTheme()` value and derive D/C/shared from it instead of
// importing static objects.
export function mkD(C: AppColors) {
  return {
    bg:          C.bg,
    t1:          C.t1,
    t2:          C.t2,
    t3:          C.t3,
    div:         C.border,
    red:         C.red,
    surf:        C.surface,
    redLo:       C.redLo,
    card:        C.card,
    // Fixed dark/light pair for "filled/selected" pills — NOT t1/bg, which invert
    // in dark mode and would render a selected pill invisibly (near-white fill
    // with near-white text) once onboarding stopped being fixed-light-only.
    alwaysDark:  C.alwaysDark,
    alwaysLight: C.alwaysLight,
  } as const;
}

export type OnboardingD = ReturnType<typeof mkD>;
export type OnboardingC = ReturnType<typeof mkC>;

// C alias for PlanSelectionStep + any component that still references C.*
// alwaysDark/alwaysLight are exposed for the handful of elements meant to
// stay a fixed dark badge/card regardless of theme (see PlanSelectionStep).
export function mkC(C: AppColors) {
  const D = mkD(C);
  return {
    ...D,
    black:       C.t1,
    white:       C.card,
    border:      C.border,
    mid:         C.mid,
    stone:       C.surface,
    redLo:       C.redLo,
    redFaint:    C.redLo,
    muted:       C.t2,
    alwaysDark:  C.alwaysDark,
    alwaysLight: C.alwaysLight,
  };
}

export function mkShared(C: AppColors) {
  const D = mkD(C);
  return StyleSheet.create({
    stepContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },

    eyebrow: {
      fontFamily: Fonts.medium, fontSize: 10, color: D.red,
      textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 14,
    },
    heroTitle: {
      fontFamily: Fonts.display,
      fontSize: 36, color: D.t1, lineHeight: 36, marginBottom: 14,
    },
    subtitle: {
      fontSize: 14, color: D.t2,
      lineHeight: 21, marginBottom: 28, maxWidth: 280,
    },
    fieldLabel: {
      fontFamily: Fonts.medium, fontSize: 10, color: D.t3,
      textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
    },

    // Option list row — used by GoalStep
    optionRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingVertical: 18, borderBottomWidth: 0.5, borderBottomColor: D.div,
    },
    optionAccent: { width: 2, height: 36, borderRadius: 1, backgroundColor: 'transparent' },
    optionAccentActive: { backgroundColor: D.red },
    optionLabel: { fontSize: 15, color: D.t2 },
    optionLabelSel: { fontFamily: Fonts.medium, color: D.t1 },
    optionSub: { fontSize: 12, color: D.t3 },
    optionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: D.red },

    // Legacy — kept for PlanSelectionStep compat
    listRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: D.div,
    },
    listLabel: { fontSize: 15, color: D.t2 },
    listLabelSel: { fontFamily: Fonts.medium, color: D.t1 },
    listSub: { fontSize: 12, color: D.t3, marginTop: 2 },
    radio: {
      width: 18, height: 18, borderRadius: 9, borderWidth: 0.5,
      borderColor: D.div, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    radioSel: { borderColor: D.alwaysDark, backgroundColor: D.alwaysDark },
    radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: D.alwaysLight },
    gradientCard: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14,
      paddingHorizontal: 0, paddingVertical: 18,
      borderRadius: 0, borderWidth: 0,
      borderBottomWidth: 0.5, borderBottomColor: D.div, marginBottom: 0,
    },
  });
}
