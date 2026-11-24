import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useTheme, Fonts, Type, Spacing, type AppColors } from '@theme';
import { ClubImagesPicker } from '../ClubImagesPicker';
import type { ChatReport } from '@features/clubs/services/clubService';
import type { JoinRequest } from '@features/clubs/types';
import { ClubReportsSection } from './ClubReportsSection';
import { ClubJoinRequestsSection } from './ClubJoinRequestsSection';
import { mkCommonStyles } from './clubDetailStyles';

interface Props {
  clubName: string;
  media: { avatar: string | null; banner: string | null };
  onChangeMedia: (kind: 'avatar' | 'banner', uri: string) => void;
  description: string;
  onChangeDescription: (text: string) => void;
  savingDescription: boolean;
  onSaveDescription: () => void;
  reports: ChatReport[];
  canRemoveAuthor: (authorId: string) => boolean;
  onDeleteMessage: (messageId: string) => void;
  onRemoveMember: (userId: string, username: string) => void;
  requestsLoading: boolean;
  joinRequests: JoinRequest[];
  onApprove: (req: JoinRequest) => void;
  onReject: (req: JoinRequest) => void;
  isOwner: boolean;
  onDeleteClub: () => void;
}

export function ClubAdminTab(p: Props) {
  const C = useTheme();
  const s = useMemo(() => mkCommonStyles(C), [C]);
  const a = useMemo(() => mkStyles(C), [C]);
  return (
    <ScrollView contentContainerStyle={a.adminContent} showsVerticalScrollIndicator={false}>
      {/* Club picture and cover */}
      <Text style={s.sectionLabel}>Club picture and cover</Text>
      <ClubImagesPicker
        avatar={p.media.avatar}
        banner={p.media.banner}
        onAvatar={u => p.onChangeMedia('avatar', u)}
        onBanner={u => p.onChangeMedia('banner', u)}
        name={p.clubName}
      />
      {/* Description edit */}
      <Text style={s.sectionLabel}>Club description</Text>
      <View style={s.adminCard}>
        <TextInput
          style={a.descInput}
          value={p.description}
          onChangeText={p.onChangeDescription}
          placeholder="Add a description…"
          placeholderTextColor={C.t3}
          multiline
          maxLength={280}
        />
        <Pressable
          style={[a.saveBtn, p.savingDescription && a.saveBtnDisabled]}
          onPress={p.onSaveDescription}
          disabled={p.savingDescription}
        >
          {p.savingDescription ? (
            <ActivityIndicator size="small" color={C.alwaysLight} />
          ) : (
            <Text style={a.saveBtnText}>Save</Text>
          )}
        </Pressable>
      </View>

      <ClubReportsSection
        reports={p.reports}
        canRemoveAuthor={p.canRemoveAuthor}
        onDeleteMessage={p.onDeleteMessage}
        onRemoveMember={p.onRemoveMember}
      />
      <ClubJoinRequestsSection loading={p.requestsLoading} requests={p.joinRequests} onApprove={p.onApprove} onReject={p.onReject} />

      {p.isOwner && (
        <>
          <Text style={[s.sectionLabel, { marginTop: 28 }]}>Danger zone</Text>
          <Pressable style={s.dangerRow} onPress={p.onDeleteClub} accessibilityRole="button">
            <Text style={s.dangerText}>Delete club</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    adminContent:{ paddingHorizontal: Spacing.gutter, paddingTop: 16, paddingBottom: 100, gap: 0 },
    descInput:   { fontFamily: Fonts.regular, fontSize: 13, color: C.t1, minHeight: 72, textAlignVertical: 'top', lineHeight: 20 },
    saveBtn:     { marginTop: 10, backgroundColor: C.alwaysDark, borderRadius: 999, height: 44, justifyContent: 'center', alignItems: 'center' },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { ...Type.button, fontSize: 14, color: C.alwaysLight },
  });
}
