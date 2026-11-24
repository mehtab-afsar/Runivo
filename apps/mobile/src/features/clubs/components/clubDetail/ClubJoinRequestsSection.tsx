import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Check, X } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { Avatar } from '@mobile/shared/components/Avatar';
import type { JoinRequest } from '@features/clubs/types';
import { mkCommonStyles } from './clubDetailStyles';

interface Props {
  loading: boolean;
  requests: JoinRequest[];
  onApprove: (req: JoinRequest) => void;
  onReject: (req: JoinRequest) => void;
}

export function ClubJoinRequestsSection({ loading, requests, onApprove, onReject }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkCommonStyles(C), [C]);
  const r = useMemo(() => mkStyles(C), [C]);
  return (
    <>
      <Text style={[s.sectionLabel, { marginTop: 20 }]}>Join requests</Text>
      {loading ? (
        <ActivityIndicator color={C.red} style={{ marginTop: 16 }} />
      ) : requests.length === 0 ? (
        <View style={s.adminCard}>
          <Text style={r.noRequestsText}>No pending requests</Text>
        </View>
      ) : (
        requests.map(req => (
          <View key={req.id} style={r.requestRow}>
            <View style={[r.reqAvatar, { overflow: 'hidden' }]}>
              <Avatar name={req.username} uri={req.avatarUrl ?? null} size={34} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.reqName}>{req.username}</Text>
              <Text style={s.reqTime}>{new Date(req.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
            </View>
            <Pressable style={r.approveBtn} onPress={() => onApprove(req)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Approve ${req.username}`}>
              <Check size={14} color={C.green} weight="regular" />
            </Pressable>
            <Pressable style={r.rejectBtn} onPress={() => onReject(req)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Decline ${req.username}`}>
              <X size={14} color={C.danger} weight="regular" />
            </Pressable>
          </View>
        ))
      )}
    </>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    noRequestsText: { fontFamily: Fonts.regular, fontSize: 12, color: C.t3, textAlign: 'center' },
    requestRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 22, padding: 12, marginBottom: 6 },
    reqAvatar:   { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    approveBtn:  { width: 34, height: 34, borderRadius: 17, backgroundColor: C.greenBg, borderWidth: 0.5, borderColor: C.green, alignItems: 'center', justifyContent: 'center' },
    rejectBtn:   { width: 34, height: 34, borderRadius: 17, backgroundColor: C.danger + '14', borderWidth: 0.5, borderColor: C.danger, alignItems: 'center', justifyContent: 'center' },
  });
}
