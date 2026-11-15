/**
 * Runners you blocked or muted, with Unblock / Unmute.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Platform, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { Avatar } from '@mobile/shared/components/Avatar';
import { ErrorState } from '@mobile/shared/components/ErrorState';
import { fetchBlocksAndMutes, unblockUser, unmuteUser, type HiddenRunner } from '@mobile/shared/services/safetyService';

export default function BlockedRunnersScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation();
  const [rows, setRows] = useState<HiddenRunner[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(() => {
    setLoadError(false);
    // A failed load must not read as "you haven't blocked anyone" — on a safety screen
    // that would tell someone a blocked person is no longer blocked.
    fetchBlocksAndMutes().then(setRows).catch(() => { setRows([]); setLoadError(true); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const undo = async (r: HiddenRunner) => {
    setBusyId(r.userId + r.kind);
    try {
      await (r.kind === 'blocked' ? unblockUser(r.userId) : unmuteUser(r.userId));
      setRows(prev => (prev ?? []).filter(x => !(x.userId === r.userId && x.kind === r.kind)));
    } catch {
      Alert.alert('Something went wrong', 'Check your connection and try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={16} color={C.t1} weight="regular" />
        </Pressable>
        <Text style={s.title}>Blocked and muted</Text>
        <View style={{ width: 32 }} />
      </View>

      {rows === null ? (
        <View style={s.center}><ActivityIndicator color={C.t2} /></View>
      ) : loadError ? (
        <ErrorState title="Couldn't load your blocked list" onRetry={load} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => r.userId + r.kind}
          contentContainerStyle={s.list}
          ListHeaderComponent={
            <Text style={s.lead}>
              Blocked runners and you can't see each other. Muted runners' activities are hidden from your feed; they aren't told.
            </Text>
          }
          ListEmptyComponent={<Text style={s.empty}>You haven't blocked or muted anyone.</Text>}
          renderItem={({ item }) => (
            <View style={s.row}>
              <Avatar name={item.username} color={item.avatarColor ?? undefined} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.username}</Text>
                <Text style={s.kind}>{item.kind === 'blocked' ? 'Blocked' : 'Muted'}</Text>
              </View>
              <Pressable hitSlop={8} style={s.btn} onPress={() => undo(item)} disabled={busyId === item.userId + item.kind} accessibilityRole="button">
                {busyId === item.userId + item.kind
                  ? <ActivityIndicator size="small" color={C.t2} />
                  : <Text style={s.btnTxt}>{item.kind === 'blocked' ? 'Unblock' : 'Unmute'}</Text>}
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: C.bg },
    header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
    backBtn: { width: 32 },
    title:   { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list:    { paddingHorizontal: 18, paddingBottom: 40 },
    lead:    { fontFamily: Fonts.regular, fontSize: 13.5, lineHeight: 19, color: C.t2, marginBottom: 12 },
    empty:   { fontFamily: Fonts.regular, fontSize: 14, color: C.t3, textAlign: 'center', marginTop: 32 },
    row:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 22, padding: 12, marginBottom: 8 },
    name:    { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    kind:    { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 2 },
    btn:     { minWidth: 84, height: 32, borderRadius: 16, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
    btnTxt:  { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1 },
  });
}
