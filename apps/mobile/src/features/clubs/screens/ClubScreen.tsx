import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, SafeAreaView,
  Platform, ActivityIndicator, RefreshControl, Modal, TextInput,
  ScrollView, KeyboardAvoidingView, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import {
  MapPin, Globe, Flag, Activity, Users, X, Plus, Check,
  Flame, Zap, Trophy, Shield, Navigation, Dumbbell, Target, Medal,
  Rocket, Star, Swords, Wind, Waves, Mountain, Gem, Crown, Leaf,
  Footprints, Bike, UserCheck, Lock, ArrowLeft, Award,
  type LucideIcon,
} from 'lucide-react-native';
import { useClubs } from '@features/clubs/hooks/useClubs';
import { SearchBar } from '@features/clubs/components/SearchBar';
import { getEmojiIcon } from '@mobile/shared/lib/emojiIcon';
import { avatarColor } from '@shared/lib/avatarUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Club } from '@features/clubs/types';
import { useTheme, type AppColors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ClubTab = 'my_clubs' | 'rankings';
type RankingScope = 'local' | 'national' | 'international';
type JoinPolicy = 'open' | 'request' | 'invite';

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

const BADGE_OPTIONS: { emoji: string; Icon: LucideIcon; color: string; bg: string; label: string }[] = [
  { emoji: '🏃',  Icon: Activity,   color: '#D93518', bg: '#FDE8E4', label: 'Runner'    },
  { emoji: '🔥',  Icon: Flame,      color: '#EA580C', bg: '#FFEDD5', label: 'Fire'      },
  { emoji: '⚡',  Icon: Zap,        color: '#CA8A04', bg: '#FEF9C3', label: 'Lightning' },
  { emoji: '🏆',  Icon: Trophy,     color: '#D97706', bg: '#FEF3C7', label: 'Trophy'    },
  { emoji: '🌍',  Icon: Globe,      color: '#0284C7', bg: '#E0F2FE', label: 'Global'    },
  { emoji: '🛡️', Icon: Shield,     color: '#059669', bg: '#D1FAE5', label: 'Shield'    },
  { emoji: '🧭',  Icon: Navigation, color: '#475569', bg: '#F1F5F9', label: 'Compass'   },
  { emoji: '💪',  Icon: Dumbbell,   color: '#7C3AED', bg: '#EDE9FE', label: 'Strong'    },
  { emoji: '🎯',  Icon: Target,     color: '#D93518', bg: '#FDE8E4', label: 'Target'    },
  { emoji: '🏅',  Icon: Medal,      color: '#B45309', bg: '#FEF3C7', label: 'Medal'     },
  { emoji: '🚀',  Icon: Rocket,     color: '#8B5CF6', bg: '#EDE9FE', label: 'Rocket'    },
  { emoji: '🌟',  Icon: Star,       color: '#F59E0B', bg: '#FEF9C3', label: 'Star'      },
  { emoji: '⚔️', Icon: Swords,     color: '#DC2626', bg: '#FEE2E2', label: 'Battle'    },
  { emoji: '🌊',  Icon: Waves,      color: '#0EA5E9', bg: '#E0F2FE', label: 'Waves'     },
  { emoji: '🏔️', Icon: Mountain,   color: '#78716C', bg: '#F5F5F4', label: 'Mountain'  },
  { emoji: '💎',  Icon: Gem,        color: '#06B6D4', bg: '#CFFAFE', label: 'Diamond'   },
  { emoji: '👑',  Icon: Crown,      color: '#D97706', bg: '#FEF3C7', label: 'Crown'     },
  { emoji: '👟',  Icon: Footprints, color: '#6B7280', bg: '#F3F4F6', label: 'Stride'    },
  { emoji: '🚴',  Icon: Bike,       color: '#0284C7', bg: '#E0F2FE', label: 'Cycle'     },
  { emoji: '🌿',  Icon: Leaf,       color: '#15803D', bg: '#DCFCE7', label: 'Nature'    },
];

const JOIN_POLICIES: { value: JoinPolicy; label: string; desc: string; Icon: LucideIcon; color: string }[] = [
  { value: 'open',    label: 'Open',     desc: 'Anyone can join',        Icon: Users,     color: '#059669' },
  { value: 'request', label: 'Request',  desc: 'Approve new members',    Icon: UserCheck, color: '#D97706' },
  { value: 'invite',  label: 'Invite',   desc: 'Invitation required',    Icon: Lock,      color: '#7C3AED' },
];

function RankingRow({ club, rank, onPress, isLast }: { club: Club; rank: number; onJoin: () => void; onLeave: () => void; onPress: () => void; isLast?: boolean }) {
  const C = useTheme();
  const r = useMemo(() => mkRStyles(C), [C]);
  const { icon: BadgeIcon, color: badgeColor } = getEmojiIcon(club.badge_emoji);
  const bg = avatarColor(club.name);
  return (
    <Pressable style={[r.row, !isLast && r.rowBorder]} onPress={onPress}>
      <Text style={r.rank}>{rank}</Text>
      <View style={[r.avatar, { backgroundColor: bg + '30' }]}>
        <BadgeIcon size={18} color={badgeColor} strokeWidth={1.5} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={r.name} numberOfLines={1}>{club.name}</Text>
        <Text style={r.meta}>{club.member_count} members</Text>
      </View>
      <View style={r.cols}>
        <Text style={r.colVal}>{club.total_km.toFixed(0)}<Text style={r.colUnit}> km</Text></Text>
      </View>
    </Pressable>
  );
}

function mkRStyles(C: AppColors) {
  return StyleSheet.create({
    row:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.white },
    rowBorder: { borderBottomWidth: 0.5, borderBottomColor: C.mid },
    rank:      { fontFamily: 'Barlow_300Light', fontSize: 13, color: C.t3, width: 20, textAlign: 'center' },
    avatar:    { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    name:      { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black },
    meta:      { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, marginTop: 1 },
    cols:      { flexDirection: 'row', alignItems: 'center', gap: 24 },
    colVal:    { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.black, textAlign: 'right', width: 56 },
    colUnit:   { fontFamily: 'Barlow_300Light', fontSize: 9, color: C.t3 },
  });
}

// ── Create Club Sheet ────────────────────────────────────────────────────────

function CreateClubSheet({ visible, onClose, onCreate }: {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, desc: string, emoji: string, policy: JoinPolicy) => Promise<boolean>;
}) {
  const C = useTheme();
  const cs = useMemo(() => mkCsStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const [name, setName]         = useState('');
  const [desc, setDesc]         = useState('');
  const [emoji, setEmoji]       = useState(BADGE_OPTIONS[0].emoji);
  const [policy, setPolicy]     = useState<JoinPolicy>('open');
  const [saving, setSaving]     = useState(false);

  const isValid = name.trim().length >= 3 && name.trim().length <= 30;

  const handleCreate = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    const ok = await onCreate(name, desc, emoji, policy);
    setSaving(false);
    if (ok) {
      setName(''); setDesc(''); setEmoji(BADGE_OPTIONS[0].emoji); setPolicy('open');
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
            {/* Badge */}
            <Text style={cs.fieldLabel}>BADGE</Text>
            {(() => {
              const selected = BADGE_OPTIONS.find(b => b.emoji === emoji) ?? BADGE_OPTIONS[0];
              const SelIcon = selected.Icon;
              return (
                <View style={cs.badgePreviewRow}>
                  <View style={[cs.badgePreview, { backgroundColor: selected.bg }]}>
                    <SelIcon size={28} color={selected.color} strokeWidth={1.5} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={cs.badgePreviewLabel}>{selected.label}</Text>
                    <Text style={cs.badgePreviewSub}>Selected badge</Text>
                  </View>
                </View>
              );
            })()}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cs.badgeGrid}>
              {BADGE_OPTIONS.map(opt => {
                const BIcon = opt.Icon;
                const active = emoji === opt.emoji;
                return (
                  <Pressable
                    key={opt.emoji}
                    style={[cs.badgeBtn, active && { backgroundColor: opt.bg, borderColor: opt.color }]}
                    onPress={() => setEmoji(opt.emoji)}
                  >
                    <BIcon size={18} color={active ? opt.color : C.t3} strokeWidth={1.5} />
                    {active && <View style={[cs.badgeBtnDot, { backgroundColor: opt.color }]} />}
                  </Pressable>
                );
              })}
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
            <View style={cs.policyCol}>
              {JOIN_POLICIES.map(p => {
                const PIco = p.Icon;
                const active = policy === p.value;
                return (
                  <Pressable
                    key={p.value}
                    style={[cs.policyCard, active && cs.policyCardActive]}
                    onPress={() => setPolicy(p.value)}
                  >
                    <View style={[cs.policyIconBox, { backgroundColor: active ? p.color : C.stone }]}>
                      <PIco size={14} color={active ? '#fff' : p.color} strokeWidth={1.5} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[cs.policyLabel, active && cs.policyLabelActive]}>{p.label}</Text>
                      <Text style={[cs.policyDesc, active && cs.policyDescActive]}>{p.desc}</Text>
                    </View>
                    {active && <Check size={14} color={p.color} strokeWidth={2.5} />}
                  </Pressable>
                );
              })}
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

function mkCsStyles(C: AppColors) {
  return StyleSheet.create({
    backdrop:          { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet:             { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12 },
    handle:            { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    sheetHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, borderBottomWidth: 0.5, borderBottomColor: C.border, paddingBottom: 14 },
    sheetTitle:        { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
    closeBtn:          { width: 30, height: 30, borderRadius: 15, backgroundColor: C.stone, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: C.border },
    fieldLabel:        { fontFamily: 'Barlow_500Medium', fontSize: 10, letterSpacing: 1.2, color: C.t3, marginTop: 16, marginBottom: 8 },
    // Badge preview row
    badgePreviewRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12, backgroundColor: C.surface, borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: C.border },
    badgePreview:      { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    badgePreviewLabel: { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: C.black },
    badgePreviewSub:   { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3, marginTop: 2 },
    // Badge grid
    badgeGrid:         { paddingBottom: 4, gap: 8 },
    badgeBtn:          { width: 44, height: 44, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    badgeBtnDot:       { position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 2 },
    // Inputs
    input:             { borderWidth: 0.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Barlow_400Regular', fontSize: 14, color: C.black, backgroundColor: C.white },
    inputMulti:        { minHeight: 72, textAlignVertical: 'top', paddingTop: 12 },
    inputError:        { borderColor: C.red, backgroundColor: '#FEF0EE' },
    inputMeta:         { flexDirection: 'row', marginTop: 4 },
    inputHint:         { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3 },
    inputHintError:    { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.red },
    // Policy cards (vertical)
    policyCol:         { gap: 8, marginBottom: 4 },
    policyCard:        { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 0.5, borderColor: C.border, borderRadius: 14, padding: 14, backgroundColor: C.white },
    policyCardActive:  { borderColor: C.border, backgroundColor: C.surface },
    policyIconBox:     { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    policyLabel:       { fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: C.black },
    policyLabelActive: { color: C.black },
    policyDesc:        { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3, marginTop: 1 },
    policyDescActive:  { color: C.t2 },
    // Footer
    footer:            { paddingTop: 16, gap: 8 },
    createBtn:         { paddingVertical: 16, borderRadius: 16, backgroundColor: C.black, alignItems: 'center' },
    createBtnDisabled: { backgroundColor: C.stone },
    createBtnLabel:    { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: C.white, letterSpacing: 0.3 },
    createBtnLabelDisabled: { color: C.t3 },
    cancelBtn:         { paddingVertical: 14, borderRadius: 16, backgroundColor: C.stone, borderWidth: 0.5, borderColor: C.border, alignItems: 'center' },
    cancelBtnLabel:    { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.t2 },
  });
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function ClubScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const { filteredClubs, clubs, loading, refreshing, searchQuery, setSearchQuery, joinClub, leaveClub, createClub, refresh } = useClubs();
  const [tab, setTab] = useState<ClubTab>('my_clubs');
  const [rankScope, setRankScope] = useState<RankingScope>('international');
  const [rankSearch, setRankSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const myClubs = useMemo(() => filteredClubs.filter(c => c.joined), [filteredClubs]);
  const rankedClubs = useMemo(
    () => [...clubs].sort((a, b) => b.total_km - a.total_km),
    [clubs],
  );
  const filteredRanked = useMemo(
    () => rankSearch ? rankedClubs.filter(c => c.name.toLowerCase().includes(rankSearch.toLowerCase())) : null,
    [rankedClubs, rankSearch],
  );

  const goToDetail = (item: Club) =>
    navigation.navigate('ClubDetail', { clubId: item.id, clubName: item.name, badgeEmoji: item.badge_emoji, memberCount: item.member_count, totalKm: item.total_km });

  const ScopeHeader = (
    <>
      {/* Scope pills */}
      <View style={s.scopeRow}>
        {SCOPES.map(sc => {
          const active = rankScope === sc.value;
          const SIcon = sc.value === 'local' ? MapPin : sc.value === 'national' ? Flag : Globe;
          return (
            <Pressable key={sc.value} style={[s.scopeBtn, active && s.scopeBtnActive]} onPress={() => { setRankScope(sc.value); setRankSearch(''); }}>
              <SIcon size={10} color={active ? C.red : C.t3} strokeWidth={1.5} />
              <Text style={[s.scopeLabel, active && s.scopeLabelActive]}>{sc.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {/* Search bar */}
      <View style={s.rankSearchWrap}>
        <SearchBar value={rankSearch} onChange={setRankSearch} placeholder="Search clubs..." />
      </View>
    </>
  );

  const PodiumSection = rankedClubs.length >= 3 && !filteredRanked ? (
    <View style={s.podiumCard}>
      <View style={s.podiumHeader}>
        <MapPin size={12} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />
        <Text style={s.podiumHeading}>
          {rankScope === 'local' ? 'Top Clubs Locally' : rankScope === 'national' ? 'Top Clubs Nationally' : 'Top Clubs Worldwide'}
        </Text>
      </View>
      <View style={s.podiumRow}>
        {[rankedClubs[1], rankedClubs[0], rankedClubs[2]].map((club, idx) => {
          if (!club) return null;
          const podiumHeights = [72, 96, 56];
          const avatarSizes = [44, 52, 38];
          const ranks = [2, 1, 3];
          const bg = avatarColor(club.name);
          const { icon: BIco, color: bColor } = getEmojiIcon(club.badge_emoji);
          return (
            <Pressable key={club.id} style={s.podiumSlot} onPress={() => goToDetail(club)}>
              {idx === 1 && <Award size={16} color="#FCD34D" strokeWidth={1.5} style={{ marginBottom: 6 }} />}
              {idx !== 1 && <View style={{ height: 22 }} />}
              <View style={[s.podiumAvatar, { width: avatarSizes[idx], height: avatarSizes[idx], borderRadius: avatarSizes[idx] * 0.25, backgroundColor: bg + '40', borderWidth: idx === 1 ? 1.5 : 0, borderColor: '#FCD34D' }]}>
                <BIco size={avatarSizes[idx] * 0.44} color={bColor} strokeWidth={1.5} />
              </View>
              <Text style={[s.podiumName, { fontSize: idx === 1 ? 12 : 10 }]} numberOfLines={1}>{club.name}</Text>
              <Text style={s.podiumMeta}>{club.total_km.toFixed(0)} km</Text>
              <View style={[s.podiumBlock, { height: podiumHeights[idx] }]}>
                <Text style={s.podiumRank}>#{ranks[idx]}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  ) : null;

  const TableHeader = !filteredRanked && rankedClubs.length > 3 ? (
    <View style={[s.tableHeader, { marginTop: 12 }]}>
      <Text style={[s.tableHeaderText, { flex: 1, marginLeft: 72 }]}>Club</Text>
      <Text style={[s.tableHeaderText, { width: 56, textAlign: 'right' }]}>KM</Text>
    </View>
  ) : null;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
          <ArrowLeft size={18} color={C.t2} strokeWidth={2} />
        </Pressable>
        <Text style={s.title}>Clubs</Text>
        <Pressable style={s.createTrigger} onPress={() => setShowCreate(true)}>
          <Plus size={16} color={C.white} strokeWidth={2.5} />
        </Pressable>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {(['my_clubs', 'rankings'] as ClubTab[]).map(t => (
          <Pressable key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabLabel, tab === t && s.tabLabelActive]}>
              {t === 'my_clubs' ? 'My clubs' : 'Rankings'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={C.red} /></View>
      ) : tab === 'my_clubs' ? (
        <FlatList
          data={myClubs}
          keyExtractor={c => c.id}
          renderItem={({ item }) => {
            const bg = avatarColor(item.name);
            const { icon: BIco, color: bColor } = getEmojiIcon(item.badge_emoji);
            return (
              <Pressable style={s.myClubRow} onPress={() => goToDetail(item)}>
                <View style={[s.myClubAvatar, { backgroundColor: bg + '30' }]}>
                  <BIco size={22} color={bColor} strokeWidth={1.5} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={s.myClubTopRow}>
                    <Text style={s.myClubName} numberOfLines={1}>{item.name}</Text>
                    <Text style={s.myClubDate}>{item.total_km.toFixed(0)} km</Text>
                  </View>
                  <Text style={s.myClubMeta}>{item.member_count} members · {item.total_km.toFixed(0)} zones</Text>
                  <Text style={s.myClubPreview} numberOfLines={1}>{item.description ?? 'Tap to open'}</Text>
                </View>
              </Pressable>
            );
          }}
          contentContainerStyle={s.myClubList}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={s.searchWrap}>
              <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search clubs..." />
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.red} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Users size={28} color={C.red} strokeWidth={1.5} style={{ marginBottom: 8 }} />
              <Text style={s.emptyTitle}>No clubs yet</Text>
              <Text style={s.emptyText}>Switch to Rankings to join clubs, or tap + to create one.</Text>
              <Pressable style={s.emptyBtn} onPress={() => setShowCreate(true)}>
                <Text style={s.emptyBtnLabel}>Create a club</Text>
              </Pressable>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredRanked ?? (rankedClubs.length > 3 ? rankedClubs.slice(3) : [])}
          keyExtractor={c => c.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.rankList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.red} />}
          ListHeaderComponent={
            <>
              {ScopeHeader}
              {PodiumSection}
              {TableHeader}
              {filteredRanked !== null && filteredRanked.length === 0 && (
                <View style={s.empty}>
                  <Text style={s.emptyTitle}>No clubs found</Text>
                </View>
              )}
            </>
          }
          renderItem={({ item, index }) => (
            <RankingRow
              club={item}
              rank={(filteredRanked ? index : index + 4) }
              onJoin={() => joinClub(item)}
              onLeave={() => leaveClub(item)}
              onPress={() => goToDetail(item)}
              isLast={index === (filteredRanked ?? rankedClubs.slice(3)).length - 1}
            />
          )}
          ListEmptyComponent={!filteredRanked ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No clubs found</Text>
              <Text style={s.emptyText}>Check back soon.</Text>
            </View>
          ) : null}
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

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:            { flex: 1, backgroundColor: C.bg },
    header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 10, backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.border },
    backBtn:         { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    title:           { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
    createTrigger:   { width: 28, height: 28, borderRadius: 14, backgroundColor: C.bg, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    // Tabs - match web (black underline active)
    tabBar:          { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.mid },
    tabBtn:          { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1.5, borderBottomColor: 'transparent' },
    tabBtnActive:    { borderBottomColor: C.black },
    tabLabel:        { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.t3 },
    tabLabelActive:  { fontFamily: 'Barlow_500Medium', color: C.black },
    loader:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
    // My Clubs tab
    searchWrap:      { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
    myClubList:      { paddingBottom: 100 },
    myClubRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 13, backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.mid },
    myClubAvatar:    { width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    myClubTopRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
    myClubName:      { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: C.black, flex: 1 },
    myClubDate:      { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, marginLeft: 8, flexShrink: 0 },
    myClubMeta:      { fontFamily: 'Barlow_400Regular', fontSize: 10, color: C.t3, marginBottom: 2 },
    myClubPreview:   { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3 },
    empty:           { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 18 },
    emptyTitle:      { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black, marginBottom: 4 },
    emptyText:       { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3, textAlign: 'center', marginBottom: 12 },
    emptyBtn:        { backgroundColor: C.black, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 4 },
    emptyBtnLabel:   { fontFamily: 'Barlow_500Medium', fontSize: 11, color: C.white, textTransform: 'uppercase', letterSpacing: 0.6 },
    // Rankings tab
    rankList:        { paddingBottom: 100 },
    scopeRow:        { flexDirection: 'row', gap: 6, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 4, backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.border },
    scopeBtn:        { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 0.5, borderColor: C.border, backgroundColor: C.bg, flexDirection: 'row', alignItems: 'center', gap: 4 },
    scopeBtnActive:  { backgroundColor: C.redLo, borderColor: 'rgba(217,53,24,0.3)' },
    scopeLabel:      { fontFamily: 'Barlow_400Regular', fontSize: 9, color: C.t3 },
    scopeLabelActive:{ fontFamily: 'Barlow_500Medium', color: C.red },
    rankSearchWrap:  { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
    // Dark podium
    podiumCard:      { marginHorizontal: 18, marginTop: 12, marginBottom: 0, backgroundColor: '#0A0A0A', borderRadius: 16, paddingHorizontal: 16, paddingTop: 18, overflow: 'hidden' },
    podiumHeader:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
    podiumHeading:   { fontFamily: 'Barlow_500Medium', fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1.2 },
    podiumRow:       { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 6 },
    podiumSlot:      { flex: 1, alignItems: 'center' },
    podiumAvatar:    { alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    podiumName:      { fontFamily: 'Barlow_600SemiBold', color: '#FFFFFF', textAlign: 'center', marginBottom: 2, paddingHorizontal: 4 },
    podiumMeta:      { fontFamily: 'Barlow_300Light', fontSize: 9, color: 'rgba(255,255,255,0.45)', marginBottom: 8 },
    podiumBlock:     { width: '100%', borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
    podiumRank:      { fontFamily: 'Barlow_700Bold', fontSize: 18, color: '#FFFFFF' },
    // Table header
    tableHeader:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.stone, borderTopWidth: 0.5, borderTopColor: C.border, borderBottomWidth: 0.5, borderBottomColor: C.border },
    tableHeaderText: { fontFamily: 'Barlow_600SemiBold', fontSize: 9, color: C.t3, textTransform: 'uppercase', letterSpacing: 1 },
  });
}
