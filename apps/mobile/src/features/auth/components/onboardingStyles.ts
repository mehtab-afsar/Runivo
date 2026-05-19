import { StyleSheet } from 'react-native';

export const D = {
  bg:   '#F7F5F2',
  t1:   '#111110',
  t2:   '#7A7873',
  t3:   '#B8B5B0',
  div:  '#E2DFDA',
  red:  '#C8391A',
  surf: '#EDE9E4',
} as const;

// C alias for PlanSelectionStep + any component that still references C.*
export const C = {
  ...D,
  black:     '#111110',
  white:     '#FFFFFF',
  border:    '#E2DFDA',
  mid:       '#E2DFDA',
  stone:     '#EDE9E4',
  redLo:     'rgba(200,57,26,0.06)',
  gradStart: '#C8391A',
  gradEnd:   '#A82E14',
  redFaint:  'rgba(200,57,26,0.06)',
  muted:     '#7A7873',
  t1:        '#111110',
  t2:        '#7A7873',
  t3:        '#B8B5B0',
};

export const shared = StyleSheet.create({
  stepContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },

  eyebrow: {
    fontWeight: '500', fontSize: 10, color: D.red,
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 14,
  },
  heroTitle: {
    fontFamily: 'PlayfairDisplay_400Regular_Italic',
    fontSize: 36, color: D.t1, lineHeight: 36, marginBottom: 14,
  },
  subtitle: {
    fontSize: 14, color: D.t2,
    lineHeight: 21, marginBottom: 28, maxWidth: 280,
  },
  fieldLabel: {
    fontWeight: '500', fontSize: 10, color: D.t3,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
  },

  // Option list row — used by UsernameStep + GoalStep
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 18, borderBottomWidth: 0.5, borderBottomColor: D.div,
  },
  optionAccent: { width: 2, height: 36, borderRadius: 1, backgroundColor: 'transparent' },
  optionAccentActive: { backgroundColor: D.red },
  optionLabel: { fontSize: 15, color: D.t2 },
  optionLabelSel: { fontWeight: '500', color: D.t1 },
  optionSub: { fontSize: 12, color: D.t3 },
  optionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: D.red },

  // Legacy — kept for PlanSelectionStep compat
  listRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: D.div,
  },
  listLabel: { fontSize: 15, color: D.t2 },
  listLabelSel: { fontWeight: '500', color: D.t1 },
  listSub: { fontSize: 12, color: D.t3, marginTop: 2 },
  radio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 0.5,
    borderColor: D.div, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  radioSel: { borderColor: D.t1, backgroundColor: D.t1 },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  gradientCard: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14,
    paddingHorizontal: 0, paddingVertical: 18,
    borderRadius: 0, borderWidth: 0,
    borderBottomWidth: 0.5, borderBottomColor: D.div, marginBottom: 0,
  },
});
