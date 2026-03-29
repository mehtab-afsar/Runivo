import { StyleSheet } from 'react-native';

export const C = {
  bg: '#F8F6F3', white: '#FFFFFF', stone: '#F0EDE8',
  mid: '#E8E4DF', border: '#DDD9D4', black: '#0A0A0A',
  t2: '#6B6B6B', t3: '#ADADAD', red: '#D93518', redLo: '#FEF0EE',
  gradStart: '#D93518', gradEnd: '#B82E10',
  redFaint: 'rgba(217,53,24,0.08)',
};

export const shared = StyleSheet.create({
  stepContent: { padding: 20, paddingTop: 12, paddingBottom: 40 },
  eyebrow: {
    fontFamily: 'Barlow_300Light', fontSize: 8, color: C.t3,
    textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6,
  },
  heroTitle: {
    fontFamily: 'PlayfairDisplay_400Regular_Italic',
    fontSize: 22, color: C.black, lineHeight: 26, marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2,
    lineHeight: 16, marginBottom: 18,
  },
  listRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.mid,
  },
  listLabel: { fontFamily: 'Barlow_300Light', fontSize: 13, color: C.t2 },
  listLabelSel: { fontFamily: 'Barlow_500Medium', color: C.black },
  listSub: { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, marginTop: 2 },
  radio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 0.5,
    borderColor: C.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  radioSel: { borderColor: C.black, backgroundColor: C.black },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  fieldLabel: {
    fontFamily: 'Barlow_400Regular', fontSize: 8, color: C.t3,
    textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8,
  },
  gradientCard: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1, borderColor: 'transparent', marginBottom: 10,
  },
});
