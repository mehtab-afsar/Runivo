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
  MapPin, Globe, Flag, Pulse, Users, X, Plus, Check,
  Fire, Lightning, Trophy, Shield, NavigationArrow, Barbell, Target, Medal,
  Rocket, Star, Sword, Waves, Mountains, Diamond, Crown, Leaf,
  Footprints, Bicycle, Lock, ArrowLeft, Seal, CaretDown, MagnifyingGlass,
  type Icon,
} from 'phosphor-react-native';
import { useClubs } from '@features/clubs/hooks/useClubs';
import { SearchBar } from '@features/clubs/components/SearchBar';
import { BottomSheet } from '@mobile/shared/components/BottomSheet';
import { getEmojiIcon } from '@mobile/shared/lib/emojiIcon';
import { avatarColor } from '@shared/lib/avatarUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Club } from '@features/clubs/types';
import { useTheme, Colors, Fonts, Type, Spacing, type AppColors } from '@theme';
import { ClubRankRow } from '../components/ClubRankRow';
import { ClubHeroCard } from '../components/ClubHeroCard';
import { NearbyClubsSection } from '../components/NearbyClubsSection';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ClubTab = 'my_clubs' | 'rankings';
type RankingScope = 'local' | 'national' | 'international';
// Matches the DB CHECK constraint on clubs.join_policy exactly (migration 005) —
// it only allows these two values. The UI previously offered a third 'request'
// option that could never be saved (createClub always failed the CHECK for it).
type JoinPolicy = 'open' | 'invite_only';

const SCOPES: { value: RankingScope; label: string }[] = [
  { value: 'local',         label: 'Local'         },
  { value: 'national',      label: 'National'      },
  { value: 'international', label: 'International' },
];

const BADGE_OPTIONS: { emoji: string; Icon: Icon; color: string; bg: string; label: string }[] = [
  { emoji: '🏃',  Icon: Pulse,          color: '#FF4518', bg: '#FDE8E4', label: 'Runner'    },
  { emoji: '🔥',  Icon: Fire,           color: '#EA580C', bg: '#FFEDD5', label: 'Fire'      },
  { emoji: '⚡',  Icon: Lightning,      color: Colors.gold, bg: '#FEF9C3', label: 'Lightning' },
  { emoji: '🏆',  Icon: Trophy,         color: Colors.gold, bg: '#FEF3C7', label: 'Trophy'    },
  { emoji: '🌍',  Icon: Globe,          color: '#0284C7', bg: '#E0F2FE', label: 'Global'    },
  { emoji: '🛡️', Icon: Shield,         color: '#059669', bg: '#D1FAE5', label: 'Shield'    },
  { emoji: '🧭',  Icon: NavigationArrow,color: '#475569', bg: '#F1F5F9', label: 'Compass'   },
  { emoji: '💪',  Icon: Barbell,        color: Colors.purple, bg: '#EDE9FE', label: 'Strong'    },
  { emoji: '🎯',  Icon: Target,         color: '#FF4518', bg: '#FDE8E4', label: 'Target'    },
  { emoji: '🏅',  Icon: Medal,          color: '#B45309', bg: '#FEF3C7', label: 'Medal'     },
  { emoji: '🚀',  Icon: Rocket,         color: Colors.purple, bg: '#EDE9FE', label: 'Rocket'    },
  { emoji: '🌟',  Icon: Star,           color: Colors.gold, bg: '#FEF9C3', label: 'Star'      },
  { emoji: '⚔️', Icon: Sword,          color: '#DC2626', bg: '#FEE2E2', label: 'Battle'    },
  { emoji: '🌊',  Icon: Waves,          color: '#0EA5E9', bg: '#E0F2FE', label: 'Waves'     },
  { emoji: '🏔️', Icon: Mountains,      color: '#78716C', bg: '#F5F5F4', label: 'Mountain'  },
  { emoji: '💎',  Icon: Diamond,        color: '#06B6D4', bg: '#CFFAFE', label: 'Diamond'   },
  { emoji: '👑',  Icon: Crown,          color: Colors.gold, bg: '#FEF3C7', label: 'Crown'     },
  { emoji: '👟',  Icon: Footprints,     color: '#6B7280', bg: '#F3F4F6', label: 'Stride'    },
  { emoji: '🚴',  Icon: Bicycle,        color: '#0284C7', bg: '#E0F2FE', label: 'Cycle'     },
  { emoji: '🌿',  Icon: Leaf,           color: '#15803D', bg: '#DCFCE7', label: 'Nature'    },
];

const JOIN_POLICIES: { value: JoinPolicy; label: string; desc: string; Icon: Icon; color: string }[] = [
  { value: 'open',        label: 'Open',    desc: 'Anyone can join',                Icon: Users, color: '#059669' },
  { value: 'invite_only', label: 'Request', desc: 'Members must request to join',   Icon: Lock,  color: Colors.purple },
];

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
  const [nameError, setNameError] = useState(false);

  const trimmedName = name.trim();
  const isValid = trimmedName.length >= 3 && trimmedName.length <= 30;

  const handleCreate = async () => {
    if (saving) return;
    if (trimmedName.length === 0) { setNameError(true); return; }
    if (!isValid) return;
    setSaving(true);
    const ok = await onCreate(name, desc, emoji, policy);
    setSaving(false);
    if (ok) {
      setName(''); setDesc(''); setEmoji(BADGE_OPTIONS[0].emoji); setPolicy('open'); setNameError(false);
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
              <X size={14} color={C.t2} weight="regular" />
            </Pressable>
          </View>

          <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
            {/* Badge */}
            <Text style={cs.fieldLabel}>Badge</Text>
            {(() => {
              const selected = BADGE_OPTIONS.find(b => b.emoji === emoji) ?? BADGE_OPTIONS[0];
              const SelIcon = selected.Icon;
              return (
                <View style={cs.badgePreviewRow}>
                  <View style={[cs.badgePreview, { backgroundColor: selected.bg }]}>
                    <SelIcon size={28} color={selected.color} weight="light" />
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
                    <BIcon size={18} color={active ? opt.color : C.t3} weight="light" />
                    {active && <View style={[cs.badgeBtnDot, { backgroundColor: opt.color }]} />}
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Club Name */}
            <Text style={cs.fieldLabel}>Club name <Text style={{ color: C.red }}>*</Text></Text>
            <TextInput
              style={[cs.input, (nameError || (name.length > 0 && trimmedName.length < 3)) && cs.inputError]}
              value={name}
              onChangeText={t => { setName(t); if (nameError) setNameError(false); }}
              placeholder="Enter a unique club name..."
              placeholderTextColor={C.t3}
              maxLength={30}
              autoCorrect={false}
            />
            <View style={cs.inputMeta}>
              {nameError
                ? <Text style={cs.inputHintError}>Enter a club name</Text>
                : name.length > 0 && trimmedName.length < 3
                ? <Text style={cs.inputHintError}>At least 3 characters required</Text>
                : <Text style={cs.inputHint}>{name.length}/30</Text>
              }
            </View>

            {/* Description */}
            <Text style={cs.fieldLabel}>Description <Text style={{ color: C.t3, textTransform: 'none', letterSpacing: 0 }}>(optional)</Text></Text>
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
            <Text style={cs.fieldLabel}>Join policy</Text>
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
                      <PIco size={14} color={active ? C.white : p.color} weight="light" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[cs.policyLabel, active && cs.policyLabelActive]}>{p.label}</Text>
                      <Text style={[cs.policyDesc, active && cs.policyDescActive]}>{p.desc}</Text>
                    </View>
                    {active && <Check size={14} color={p.color} weight="bold" />}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* CTAs */}
          <View style={cs.footer}>
            <Pressable
              style={cs.createBtn}
              onPress={handleCreate}
              disabled={saving}
            >
              <Text style={cs.createBtnLabel}>
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
    sheetTitle:        { fontFamily: Fonts.display, fontSize: 20, color: C.t1 },
    closeBtn:          { width: 30, height: 30, borderRadius: 15, backgroundColor: C.stone, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: C.border },
    fieldLabel:        { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1, marginTop: 16, marginBottom: 8 },
    // Badge preview row
    badgePreviewRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12, backgroundColor: C.surface, borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: C.border },
    badgePreview:      { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    badgePreviewLabel: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    badgePreviewSub:   { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 2 },
    // Badge grid
    badgeGrid:         { paddingBottom: 4, gap: 8 },
    badgeBtn:          { width: 44, height: 44, borderRadius: 12, backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    badgeBtnDot:       { position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 2 },
    // Inputs
    input:             { borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts.regular, fontSize: 14, color: C.t1, backgroundColor: C.card },
    inputMulti:        { minHeight: 72, textAlignVertical: 'top', paddingTop: 12 },
    inputError:        { borderColor: C.red, backgroundColor: C.redLo },
    inputMeta:         { flexDirection: 'row', marginTop: 4 },
    inputHint:         { fontFamily: Fonts.regular, fontSize: 11, color: C.t3 },
    inputHintError:    { fontFamily: Fonts.regular, fontSize: 11, color: C.red },
    // Policy cards (vertical)
    policyCol:         { gap: 8, marginBottom: 4 },
    policyCard:        { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, backgroundColor: C.card },
    policyCardActive:  { borderColor: C.t1, backgroundColor: C.card },
    policyIconBox:     { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    policyLabel:       { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1 },
    policyLabelActive: { color: C.t1 },
    policyDesc:        { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 1 },
    policyDescActive:  { color: C.t2 },
    // Footer
    footer:            { paddingTop: 16, gap: 8 },
    createBtn:         { height: Spacing.height.buttonPrimary, justifyContent: 'center', borderRadius: 999, backgroundColor: C.red, alignItems: 'center' },
    createBtnLabel:    { ...Type.button, color: C.alwaysLight },
    cancelBtn:         { height: 48, justifyContent: 'center', borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
    cancelBtnLabel:    { fontFamily: Fonts.medium, fontSize: 13, color: C.t2 },
  });
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function ClubScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const { filteredClubs, clubs, nearClubs, nearby, locationOn, loading, refreshing, joinClub, leaveClub, createClub, refresh } = useClubs();
  const [tab, setTab] = useState<ClubTab>('my_clubs');
  const [rankScope, setRankScope] = useState<RankingScope>('international');
  const [scopeSheetOpen, setScopeSheetOpen] = useState(false);
  const [rankSearchOpen, setRankSearchOpen] = useState(false);
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

  const scopeLabel = SCOPES.find(sc => sc.value === rankScope)?.label ?? 'International';

  // One row: a scope chip that opens a sheet for the 3 options, plus a search
  // toggle — instead of 3 always-visible pills + a permanently-open search bar
  // + a table header stacked before a single ranked list ever shows.
  const ScopeHeader = (
    <>
      <View style={s.rankHeaderRow}>
        <Pressable style={s.scopeChip} onPress={() => setScopeSheetOpen(true)}>
          <Text style={s.scopeChipText}>{scopeLabel}</Text>
          <CaretDown size={9} color={C.t3} weight="bold" />
        </Pressable>
        <Pressable
          style={[s.searchToggle, rankSearchOpen && s.searchToggleActive]}
          onPress={() => setRankSearchOpen(o => { if (o) setRankSearch(''); return !o; })}
          hitSlop={6}
        >
          <MagnifyingGlass size={14} color={rankSearchOpen ? C.alwaysLight : C.t3} weight="regular" />
        </Pressable>
      </View>
      {rankSearchOpen && (
        <View style={s.rankSearchWrap}>
          <SearchBar value={rankSearch} onChange={setRankSearch} placeholder="Search clubs..." />
        </View>
      )}
    </>
  );

  const PodiumSection = rankedClubs.length >= 3 && !filteredRanked ? (
    <View style={s.podiumCard}>
      <View style={s.podiumHeader}>
        <MapPin size={12} color="rgba(255,255,255,0.4)" weight="light" />
        <Text style={s.podiumHeading}>
          {rankScope === 'local' ? 'Top clubs near you' : rankScope === 'national' ? 'Top clubs nationally' : 'Top clubs worldwide'}
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
              {idx === 1 && <Seal size={16} color={C.gold} weight="light" style={{ marginBottom: 6 }} />}
              {idx !== 1 && <View style={{ height: 22 }} />}
              <View style={[s.podiumAvatar, { width: avatarSizes[idx], height: avatarSizes[idx], borderRadius: avatarSizes[idx] * 0.25, backgroundColor: bg + '40', borderWidth: idx === 1 ? 1.5 : 0, borderColor: C.gold }]}>
                <BIco size={avatarSizes[idx] * 0.44} color={bColor} weight="light" />
              </View>
              <Text style={[s.podiumName, { fontSize: idx === 1 ? 13 : 11 }]} numberOfLines={1}>{club.name}</Text>
              <Text style={s.podiumMeta}>{club.total_km.toFixed(0)} km</Text>
              <View style={[s.podiumBlock, { height: podiumHeights[idx] }]}>
                <Text style={s.podiumRank}>{ranks[idx]}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  ) : null;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
          <ArrowLeft size={16} color={C.t1} weight="regular" />
        </Pressable>
        <Text style={s.title}>Clubs</Text>
        <Pressable style={s.createTrigger} onPress={() => setShowCreate(true)} testID="clubs-create-btn">
          <Plus size={14} color={C.t1} weight="bold" />
          <Text style={s.createTriggerText}>Create</Text>
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
        {/* C4: group challenges with people you follow (C6: the open lobby room is gone). */}
        <Pressable style={s.tabBtn} onPress={() => navigation.navigate('Challenges')}>
          <Text style={s.tabLabel}>Challenges</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={C.red} /></View>
      ) : tab === 'my_clubs' ? (
        <FlatList
          // Distinct key from the rankings list below — they render at the same
          // JSX position with different numColumns (2 vs. the default 1), and
          // without a key React reuses the same FlatList instance across the
          // tab switch instead of remounting, which RN's FlatList explicitly
          // doesn't support ("Changing numColumns on the fly is not supported").
          key="my-clubs-list"
          data={myClubs}
          keyExtractor={c => c.id}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item, index }) => (
            <ClubHeroCard
              club={item}
              variant={index === 0 ? 'hero' : 'card'}
              rank={rankedClubs.findIndex(c => c.id === item.id) + 1 || undefined}
              onPress={() => goToDetail(item)}
            />
          )}
          contentContainerStyle={s.myClubList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            <View style={{ marginTop: myClubs.length > 0 ? 22 : 0 }}>
              <NearbyClubsSection
                clubs={nearClubs.filter(c => !c.joined)}
                nearby={nearby}
                locationOn={locationOn}
                onPress={goToDetail}
                onJoin={joinClub}
              />
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.red} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Users size={28} color={C.red} weight="light" style={{ marginBottom: 8 }} />
              <Text style={s.emptyTitleServe}>No pack to run with yet.</Text>
              <Text style={s.emptyText}>Join a club below, find more in Rankings, or create your own.</Text>
              <Pressable style={s.emptyBtn} onPress={() => setShowCreate(true)}>
                <Text style={s.emptyBtnLabel}>Create a club</Text>
              </Pressable>
            </View>
          }
        />
      ) : (
        <FlatList
          key="rankings-list"
          data={filteredRanked ?? (rankedClubs.length > 3 ? rankedClubs.slice(3) : [])}
          keyExtractor={c => c.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.rankList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.red} />}
          ListHeaderComponent={
            <>
              {ScopeHeader}
              {PodiumSection}
              {filteredRanked !== null && filteredRanked.length === 0 && (
                <View style={s.empty}>
                  <Text style={s.emptyTitle}>No clubs found</Text>
                </View>
              )}
            </>
          }
          renderItem={({ item, index }) => (
            <ClubRankRow
              club={item}
              // Search results are their own 1-based list; the unfiltered list
              // starts at 4 because the podium already showed 1-3. This was
              // `index` in search mode, which rendered the first result as "0".
              rank={filteredRanked ? index + 1 : index + 4}
              onJoin={joinClub}
              onLeave={leaveClub}
              onPress={goToDetail}
              isLast={index === (filteredRanked ?? rankedClubs.slice(3)).length - 1}
            />
          )}
          ListEmptyComponent={!filteredRanked ? (
            <View style={s.empty}>
              <Text style={s.emptyTitleServe}>Nobody's claimed the board yet.</Text>
              <Text style={s.emptyText}>Finish a run and be the first name up here.</Text>
            </View>
          ) : null}
        />
      )}

      <CreateClubSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={createClub}
      />

      <BottomSheet visible={scopeSheetOpen} onClose={() => setScopeSheetOpen(false)} maxHeight={0.36}>
        <View style={s.scopeSheetContent}>
          <Text style={s.scopeSheetLabel}>Rank clubs by</Text>
          {SCOPES.map(sc => {
            const active = rankScope === sc.value;
            const SIcon = sc.value === 'local' ? MapPin : sc.value === 'national' ? Flag : Globe;
            return (
              <Pressable
                key={sc.value}
                style={[s.scopeSheetRow, active && s.scopeSheetRowActive]}
                onPress={() => { setRankScope(sc.value); setRankSearch(''); setScopeSheetOpen(false); }}
              >
                <SIcon size={15} color={active ? C.red : C.t3} weight={active ? 'fill' : 'light'} />
                <Text style={[s.scopeSheetRowLabel, active && s.scopeSheetRowLabelActive]}>{sc.label}</Text>
                {active && <Check size={14} color={C.red} weight="bold" />}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:            { flex: 1, backgroundColor: C.bg },
    header:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.gutter, paddingTop: Platform.OS === 'android' ? 12 : 4, paddingBottom: 12, backgroundColor: C.bg },
    backBtn:         { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
    title:           { fontFamily: Fonts.bold, fontSize: 28, lineHeight: 30, letterSpacing: -0.7, color: C.t1, flex: 1 },
    createTrigger:   { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
    createTriggerText: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
    // Tabs - match web (black underline active)
    // Segmented control: one rounded track, active segment is a raised card.
    tabBar:          { flexDirection: 'row', marginHorizontal: 18, marginBottom: 4, padding: 3, borderRadius: 999, backgroundColor: '#E9E7E2' },
    tabBtn:          { flex: 1, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
    tabBtnActive:    { backgroundColor: C.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
    tabLabel:        { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t2 },
    tabLabelActive:  { color: C.t1 },
    loader:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
    myClubsHeading:  { ...Type.headline, color: C.t1, marginBottom: 8 },
    // My Clubs tab — 2-column grid
    searchWrap:      { paddingTop: 10, paddingBottom: 6 },
    myClubList:      { paddingHorizontal: Spacing.gutter, paddingBottom: 100, gap: 10 },
    myClubGridRow:   { gap: 10 },
    myClubRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 13, backgroundColor: C.card, borderBottomWidth: 0.5, borderBottomColor: C.mid },
    myClubAvatar:    { width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    myClubTopRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
    myClubName:      { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1, flex: 1 },
    myClubDate:      { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginLeft: 8, flexShrink: 0 },
    myClubMeta:      { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginBottom: 2 },
    myClubPreview:   { fontFamily: Fonts.regular, fontSize: 11, color: C.t3 },
    empty:           { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 18 },
    emptyTitle:      { fontFamily: Fonts.medium, fontSize: 13, color: C.t1, marginBottom: 4 },
    emptyTitleServe: { ...Type.title, color: C.t1, marginBottom: 6, textAlign: 'center' },
    emptyText:       { ...Type.bodySm, color: C.t2, textAlign: 'center', marginBottom: 16 },
    emptyBtn:        { backgroundColor: C.red, paddingHorizontal: 22, height: 46, justifyContent: 'center', borderRadius: 999 },
    emptyBtnLabel:   { ...Type.button, color: C.alwaysLight },
    // Rankings tab — one row (scope chip + search toggle) instead of pills + a
    // permanently-open search bar stacked above the list.
    rankList:        { paddingBottom: 100 },
    rankHeaderRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.gutter, paddingTop: 14, paddingBottom: 4, backgroundColor: C.bg },
    scopeChip:       { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, backgroundColor: C.card, borderRadius: 999, shadowColor: C.t1, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1, paddingHorizontal: 12, paddingVertical: 7 },
    scopeChipText:   { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1 },
    searchToggle:    { width: 34, height: 34, borderRadius: 17, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    searchToggleActive: { backgroundColor: C.alwaysDark, borderColor: C.alwaysDark },
    rankSearchWrap:  { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 4 },
    scopeSheetContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },
    scopeSheetLabel:   { ...Type.overline, color: C.t3, marginBottom: 12 },
    scopeSheetRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 10, borderRadius: 10, borderBottomWidth: 0.5, borderBottomColor: C.mid },
    scopeSheetRowActive: { backgroundColor: C.redLo, borderBottomColor: 'transparent' },
    scopeSheetRowLabel:  { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: C.t1 },
    scopeSheetRowLabelActive: { fontFamily: Fonts.medium, color: C.red },
    // Dark podium
    podiumCard:      { marginHorizontal: Spacing.gutter, marginTop: 12, marginBottom: 8, backgroundColor: C.alwaysDark, borderRadius: 20, paddingHorizontal: 16, paddingTop: 18, overflow: 'hidden' },
    podiumHeader:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
    podiumHeading:   { fontFamily: Fonts.semiBold, fontSize: 13, color: C.alwaysLight },
    podiumRow:       { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 6 },
    podiumSlot:      { flex: 1, alignItems: 'center' },
    podiumAvatar:    { alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    podiumName:      { fontFamily: Fonts.semiBold, color: C.alwaysLight, textAlign: 'center', marginBottom: 2, paddingHorizontal: 4 },
    podiumMeta:      { fontFamily: Fonts.numeric, fontSize: 16, color: C.alwaysLight, opacity: 0.7, marginBottom: 8, fontVariant: ['tabular-nums'] },
    podiumBlock:     { width: '100%', borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
    podiumRank:      { fontFamily: Fonts.numeric, fontSize: 34, lineHeight: 36, color: C.alwaysLight },
  });
}
