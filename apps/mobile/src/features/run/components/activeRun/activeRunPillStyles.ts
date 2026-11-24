import { StyleSheet } from 'react-native';
import { Fonts, type AppColors } from '@theme';

/** Floating pill chrome shared by the top bar and the safety-link pill. */
export function mkPillStyles(C: AppColors) {
  const floating = {
    backgroundColor: C.card, borderRadius: 999,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  } as const;
  return StyleSheet.create({
    topBar:      { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    iconPill:    { ...floating, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    safetyPill:   { position: 'absolute', right: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
    pill:        { ...floating, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 30 },
    pillDot:     { width: 7, height: 7, borderRadius: 4 },
    pillTxt:     { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
    friendDot:   { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginLeft: -4 },
    friendInitial: { fontFamily: Fonts.bold, fontSize: 10, color: '#fff' },
  });
}
