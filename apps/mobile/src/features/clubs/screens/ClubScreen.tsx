import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, SafeAreaView,
  Platform, ActivityIndicator, RefreshControl, Modal, TextInput,
  ScrollView, KeyboardAvoidingView, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { MapPin, Globe, Flag, Activity, Users, X } from 'lucide-react-native';
import { useClubs } from '@features/clubs/hooks/useClubs';
import { ClubCard } from '@features/clubs/components/ClubCard';
import { SearchBar } from '@features/clubs/components/SearchBar';
import { getEmojiIcon } from '@mobile/shared/lib/emojiIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Club } from '@features/clubs/types';
import { Colors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ClubTab = 'my_clubs' | 'rankings';
type RankingScope = 'local' | 'national' | 'international';
type JoinPolicy = 'open' | 'request' | 'invite';

const C = Colors;

const SCOPE_ICONS: Record<string, React.ReactNode> = {
  local:         <MapPin size={11} color="#6B6B6B" strokeWidth={1.5} />,
  national:      <Flag size={11} color="#6B6B6B" strokeWidth={1.5} />,
  international: <Globe size={11} color="#6B6B6B" strokeWidth={1.5} />,
};
const SCOPES: { value: RankingScope; label: string }[] = [
  { value: 'local',         label: 'Local'         },
  { value: 'national',      label: 'National'      },
  { value: 'international', label: 'International' },
];

const BADGE_EMOJIS = [
  '🏃','🔥','⚡','🏆','🌍','🛡️','🧭','💪','🎯','🏅',
  '🚀','🌟','⚔️','🦅','🐺','🦁','🐉','🌊','🏔️','🎖️',
  '🩸','💎','👑','🎽','👟','🏋️','🚴','🏊','⛰️','🌿',
];

const JOIN_POLICIES: { value: JoinPolicy; label: string; desc: string }[] = [
  { value: 'open',    label: 'Open',        desc: 'Anyone can join' },
  { value: 'request', label: 'Request',     desc: 'Members must be approved' },
  { value: 'invite',  label: 'Invite-only', desc: 'Invitation required' },
];

function RankingRow({ club, rank, onJoin, onLeave, onPress }: { club: Club; rank: number; onJoin: () => void; onLeave: () => void; onPress: () => void }) {
  const { icon: BadgeIcon, color: badgeColor } = getEmojiIcon(club.badge_emoji);
  return (
    <Pressable style={r.row} onPress={onPress}>
      <Text style={r.rank}>#{rank}</Text>
      <View style={r.emojiBox}><BadgeIcon size={20} color={badgeColor} strokeWidth={1.5} /></View>
      <View style={{ flex: 1 }}>
        <Text style={r.name} numberOfLines={1}>{club.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
          <Users size={10} color="#ADADAD" strokeWidth={1.5} />
          <Text style={r.meta}>{club.member_count} · </Text>
          <Activity size={10} color="#ADADAD" strokeWidth={1.5} />
          <Text style={r.meta}>{club.total_km.toFixed(0)} km</Text>
        </View>
      </View>
      <Pressable style={[r.joinBtn, club.joined && r.leaveBtn]} onPress={club.joined ? onLeave : onJoin}>
        <Text style={[r.joinLabel, club.joined && r.leaveLabelStyle]}>
          {club.joined ? 'Leave' : club.join_policy === 'open' ? 'Join' : 'Request'}
        </Text>
      </Pressable>
    </Pressable>
  );
}

const r = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, padding: 12, marginBottom: 6 },
  rank:      { fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: C.t3, width: 26, textAlign: 'center' },
  emojiBox:  { width: 30, alignItems: 'center', justifyContent: 'center' },
  name:      { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black },
  meta:      { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3, marginTop: 1 },
  joinBtn:   { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: C.black, flexShrink: 0 },
  leaveBtn:  { backgroundColor: C.stone },
  joinLabel: { fontFamily: 'Barlow_500Medium', fontSize: 11, color: C.white, textTransform: 'uppercase', letterSpacing: 0.5 },
  leaveLabelStyle: { color: C.t2 },
});

// ── Create Club Sheet ────────────────────────────────────────────────────────

function CreateClubSheet({ visible, onClose, onCreate }: {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, desc: string, emoji: string, policy: JoinPolicy) => Promise<boolean>;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName]         = useState('');
  const [desc, setDesc]         = useState('');
  const [emoji, setEmoji]       = useState('🏃');
  const [policy, setPolicy]     = useState<JoinPolicy>('open');
  const [saving, setSaving]     = useState(false);

  const isValid = name.trim().length >= 3 && name.trim().length <= 30;

  const handleCreate = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    const ok = await onCreate(name, desc, emoji, policy);
    setSaving(false);
    if (ok) {
      setName(''); setDesc(''); setEmoji('🏃'); setPolicy('open');
      onClose();
    } else {
      Alert.alert('Error', 'Could not create club. Please try again.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={cs.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ justifyContent: 'flex-end' }}
      >
        <View style={[cs.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={cs.handle} />
          <View style={cs.sheetHeader}>
            <Text style={cs.sheetTitle}>Create Club</Text>
            <Pressable style={cs.closeBtn} onPress={onClose}>
              <X size={14} color={C.t2} strokeWidth={2} />
            </Pressable>
          </View>

          <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
            {/* Badge Emoji */}
            <Text style={cs.fieldLabel}>BADGE EMOJI</Text>
            <View style={cs.emojiSelected}>
              <Text style={cs.emojiSelectedText}>{emoji}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cs.emojiGrid}>
              {BADGE_EMOJIS.map(e => (
                <Pressable key={e} style={[cs.emojiBtn, emoji === e && cs.emojiBtnActive]} onPress={() => setEmoji(e)}>
                  <Text style={{ fontSize: 20 }}>{e}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Club Name */}
            <Text style={cs.fieldLabel}>CLUB NAME <Text style={{ color: C.red }}>*</Text></Text>
            <TextInput
              style={[cs.input, name.length > 0 && name.trim().length < 3 && cs.inputError]}
              value={name}
              onChangeText={setName}
              placeholder="Enter a unique club name..."
              placeholderTextColor={C.t3}
              maxLength={30}
              autoCorrect={false}
            />
            <View style={cs.inputMeta}>
              {name.length > 0 && name.trim().length < 3
                ? <Text style={cs.inputHintError}>At least 3 characters required</Text>
                : <Text style={cs.inputHint}>{name.length}/30</Text>
              }
            </View>

            {/* Description */}
            <Text style={cs.fieldLabel}>DESCRIPTION <Text style={{ color: C.t3, fontFamily: 'Barlow_300Light', textTransform: 'none', letterSpacing: 0 }}>(optional)</Text></Text>
            <TextInput
              style={[cs.input, cs.inputMulti]}
              value={desc}
              onChangeText={setDesc}
              placeholder="Tell others about your club..."
              placeholderTextColor={C.t3}
              multiline
              numberOfLines={3}
              maxLength={100}
            />
            <Text style={cs.inputHint}>{desc.length}/100</Text>

            {/* Join Policy */}
            <Text style={cs.fieldLabel}>JOIN POLICY</Text>
            <View style={cs.policyRow}>
              {JOIN_POLICIES.map(p => (
                <Pressable
                  key={p.value}
                  style={[cs.policyBtn, policy === p.value && cs.policyBtnActive]}
                  onPress={() => setPolicy(p.value)}
                >
                  <Text style={[cs.policyLabel, policy === p.value && cs.policyLabelActive]}>{p.label}</Text>
                  <Text style={[cs.policyDesc, policy === p.value && cs.policyDescActive]}>{p.desc}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* CTAs */}
          <View style={cs.footer}>
            <Pressable
              style={[cs.createBtn, !isValid && cs.createBtnDisabled]}
              onPress={handleCreate}
              disabled={!isValid || saving}
            >
              <Text style={[cs.createBtnLabel, !isValid && cs.createBtnLabelDisabled]}>
                {saving ? 'Creating...' : 'Create Club'}
              </Text>
            </Pressable>
            <Pressable style={cs.cancelBtn} onPress={onClose}>
              <Text style={cs.cancelBtnLabel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const cs = StyleSheet.create({
  backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet:        { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12 },
  handle:       { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, borderBottomWidth: 0.5, borderBottomColor: C.border, paddingBottom: 14 },
  sheetTitle:   { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
  closeBtn:     { width: 28, height: 28, borderRadius: 14, backgroundColor: C.stone, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontFamily: 'Barlow_400Regular', fontSize: 13, color: C.t2 },
  fieldLabel:   { fontFamily: 'Barlow_500Medium', fontSize: 10, letterSpacing: 1, color: C.t3, marginTop: 16, marginBottom: 8 },
  emojiSelected:{ width: 56, height: 56, borderRadius: 16, backgroundColor: C.stone, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emojiSelectedText: { fontSize: 30 },
  emojiGrid:    { paddingBottom: 4, gap: 6 },
  emojiBtn:     { width: 40, height: 40, borderRadius: 10, backgroundColor: C.stone, alignItems: 'center', justifyContent: 'center' },
  emojiBtnActive: { backgroundColor: C.black },
  input:        { borderWidth: 0.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Barlow_400Regular', fontSize: 14, color: C.black, backgroundColor: C.white },
  inputMulti:   { minHeight: 72, textAlignVertical: 'top', paddingTop: 12 },
  inputError:   { borderColor: C.red, backgroundColor: '#FEF0EE' },
  inputMeta:    { flexDirection: 'row', marginTop: 4 },
  inputHint:    { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3 },
  inputHintError: { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.red },
  policyRow:    { flexDirection: 'row', gap: 8, marginBottom: 4 },
  policyBtn:    { flex: 1, borderWidth: 0.5, borderColor: C.border, borderRadius: 10, padding: 10, backgroundColor: C.stone, alignItems: 'center' },
  policyBtnActive: { backgroundColor: C.black, borderColor: C.black },
  policyLabel:  { fontFamily: 'Barlow_600SemiBold', fontSize: 11, color: C.black, marginBottom: 2 },
  policyLabelActive: { color: C.white },
  policyDesc:   { fontFamily: 'Barlow_300Light', fontSize: 9, color: C.t3, textAlign: 'center' },
  policyDescActive: { color: 'rgba(255,255,255,0.55)' },
  footer:       { paddingTop: 16, gap: 8 },
  createBtn:    { paddingVertical: 16, borderRadius: 16, backgroundColor: C.black, alignItems: 'center' },
  createBtnDisabled: { backgroundColor: C.stone },
  createBtnLabel:    { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: C.white, letterSpacing: 0.3 },
  createBtnLabelDisabled: { color: C.t3 },
  cancelBtn:    { paddingVertical: 14, borderRadius: 16, backgroundColor: C.stone, borderWidth: 0.5, borderColor: C.border, alignItems: 'center' },
  cancelBtnLabel: { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.t2 },
});

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function ClubScreen() {
  const navigation = useNavigation<Nav>();
  const { filteredClubs, clubs, loading, refreshing, searchQuery, setSearchQuery, joinClub, leaveClub, createClub, refresh } = useClubs();
  const [tab, setTab] = useState<ClubTab>('my_clubs');
  const [rankScope, setRankScope] = useState<RankingScope>('international');
  const [showCreate, setShowCreate] = useState(false);

  const myClubs = useMemo(() => filteredClubs.filter(c => c.joined), [filteredClubs]);
  const rankedClubs = useMemo(
    () => [...clubs].sort((a, b) => b.total_km - a.total_km),
    [clubs],
  );

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </Pressable>
        <Text style={s.title}>Clubs</Text>
        <Pressable style={s.createTrigger} onPress={() => setShowCreate(true)}>
          <Text style={s.createTriggerText}>+</Text>
        </Pressable>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {(['my_clubs', 'rankings'] as ClubTab[]).map(t => (
          <Pressable key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabLabel, tab === t && s.tabLabelActive]}>
              {t === 'my_clubs' ? 'My Clubs' : 'Rankings'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={C.red} /></View>
      ) : tab === 'my_clubs' ? (
        <>
          <View style={s.searchWrap}>
            <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search clubs..." />
          </View>
          <FlatList
            data={myClubs}
            keyExtractor={c => c.id}
            renderItem={({ item }) => (
              <ClubCard
                club={item}
                onJoin={() => joinClub(item)}
                onLeave={() => leaveClub(item)}
                onPress={() => navigation.navigate('ClubDetail', { clubId: item.id, clubName: item.name, badgeEmoji: item.badge_emoji, memberCount: item.member_count, totalKm: item.total_km })}
              />
            )}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.red} />}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyTitle}>No clubs yet</Text>
                <Text style={s.emptyText}>Switch to Rankings to join clubs, or tap + to create one.</Text>
              </View>
            }
          />
        </>
      ) : (
        <FlatList
          data={rankedClubs}
          keyExtractor={c => c.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.red} />}
          ListHeaderComponent={
            <View style={s.scopeRow}>
              {SCOPES.map(sc => (
                <Pressable key={sc.value} style={[s.scopeBtn, rankScope === sc.value && s.scopeBtnActive]} onPress={() => setRankScope(sc.value)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {SCOPE_ICONS[sc.value]}
                    <Text style={[s.scopeLabel, rankScope === sc.value && s.scopeLabelActive]}>{sc.label}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          }
          renderItem={({ item, index }) => (
            <RankingRow
              club={item}
              rank={index + 1}
              onJoin={() => joinClub(item)}
              onLeave={() => leaveClub(item)}
              onPress={() => navigation.navigate('ClubDetail', { clubId: item.id, clubName: item.name, badgeEmoji: item.badge_emoji, memberCount: item.member_count, totalKm: item.total_km })}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No clubs found</Text>
              <Text style={s.emptyText}>Check back soon.</Text>
            </View>
          }
        />
      )}

      <CreateClubSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={createClub}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
  backBtn:      { width: 32 },
  backText:     { fontFamily: 'Barlow_400Regular', fontSize: 18, color: C.t2 },
  title:        { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
  createTrigger:{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center' },
  createTriggerText: { fontFamily: 'Barlow_300Light', fontSize: 20, color: C.white, lineHeight: 28 },
  tabBar:       { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.border },
  tabBtn:       { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: C.red },
  tabLabel:     { fontFamily: 'Barlow_400Regular', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, color: C.t3 },
  tabLabelActive:{ fontFamily: 'Barlow_600SemiBold', color: C.red },
  searchWrap:   { paddingHorizontal: 16, paddingTop: 10, marginBottom: 4 },
  loader:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:         { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 100 },
  empty:        { alignItems: 'center', paddingVertical: 48 },
  emptyTitle:   { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black, marginBottom: 6 },
  emptyText:    { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, textAlign: 'center' },
  scopeRow:     { flexDirection: 'row', gap: 6, marginBottom: 12 },
  scopeBtn:     { flex: 1, paddingVertical: 7, borderRadius: 20, backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border, alignItems: 'center' },
  scopeBtnActive:{ backgroundColor: C.black, borderColor: C.black },
  scopeLabel:   { fontFamily: 'Barlow_400Regular', fontSize: 10, color: C.t2 },
  scopeLabelActive: { color: C.white, fontFamily: 'Barlow_500Medium' },
});
