import { StyleSheet } from 'react-native';
import { Fonts, Type, Spacing, type AppColors } from '@theme';

/** Styles shared by more than one ClubDetail section. */
export function mkCommonStyles(C: AppColors) {
  return StyleSheet.create({
    invite:      { height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: C.card, justifyContent: 'center' },
    inviteTxt:   { fontFamily: Fonts.medium, fontSize: 14.5, color: C.t1 },
    loader:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
    emptyTitle:  { fontFamily: Fonts.semiBold, fontSize: 18, color: C.t1 },
    emptyText:   { ...Type.bodySm, color: C.t2, textAlign: 'center' },
    listContent: { paddingHorizontal: Spacing.gutter, paddingTop: 12, paddingBottom: 100 },
    sectionLabel:{ fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1, marginBottom: 10 },
    adminCard:   { backgroundColor: C.card, borderRadius: 24, padding: 16, marginBottom: 4 },
    dangerRow:   { height: 52, borderRadius: 18, backgroundColor: C.card, alignItems: "center", justifyContent: "center", marginTop: 16 },
    dangerText:  { fontFamily: Fonts.medium, fontSize: 15, color: C.danger },
    reqName:     { fontFamily: Fonts.medium, fontSize: 13, color: C.t1 },
    reqTime:     { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 2 },
  });
}
