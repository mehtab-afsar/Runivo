import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import type { ChatReport } from '@features/clubs/services/clubService';
import { reportSummaryLine } from '../../utils/clubDetailFormatters';
import { mkCommonStyles } from './clubDetailStyles';

interface Props {
  reports: ChatReport[];
  canRemoveAuthor: (authorId: string) => boolean;
  onDeleteMessage: (messageId: string) => void;
  onRemoveMember: (userId: string, username: string) => void;
}

export function ClubReportsSection({ reports, canRemoveAuthor, onDeleteMessage, onRemoveMember }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkCommonStyles(C), [C]);
  const r = useMemo(() => mkStyles(C), [C]);
  return (
    <>
      <Text style={[s.sectionLabel, { marginTop: 20 }]}>Reported messages</Text>
      {reports.length === 0 ? (
        <View style={s.adminCard}><Text style={r.noRequestsText}>Nothing reported</Text></View>
      ) : reports.map(rep => (
        <View key={rep.messageId} style={[s.adminCard, { marginBottom: 6 }]}>
          <Text style={s.reqName}>{rep.authorUsername}</Text>
          <Text style={r.reportText} numberOfLines={3}>{rep.content}</Text>
          <Text style={s.reqTime}>
            {reportSummaryLine(rep.reports, rep.reasons)}
          </Text>
          <View style={r.reportActions}>
            <Pressable hitSlop={8} style={r.reportBtn} onPress={() => onDeleteMessage(rep.messageId)} accessibilityRole="button">
              <Text style={r.reportBtnTxt}>Delete message</Text>
            </Pressable>
            {canRemoveAuthor(rep.authorId) && (
              <Pressable hitSlop={8} style={r.reportBtn} onPress={() => onRemoveMember(rep.authorId, rep.authorUsername)} accessibilityRole="button">
                <Text style={[r.reportBtnTxt, { color: C.danger }]}>Remove {rep.authorUsername}</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}
    </>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    reportText:  { fontFamily: Fonts.regular, fontSize: 14, color: C.t1, marginTop: 4, lineHeight: 20 },
    reportActions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
    reportBtn:   { height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
    reportBtnTxt:{ fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
    noRequestsText: { fontFamily: Fonts.regular, fontSize: 12, color: C.t3, textAlign: 'center' },
  });
}
