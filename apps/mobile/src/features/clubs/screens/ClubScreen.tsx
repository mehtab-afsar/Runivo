import React, { useState, useMemo } from 'react';
import { appAlert } from '@mobile/shared/components/AppAlert';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { Users, Plus, Lock, MagnifyingGlass, type Icon } from 'phosphor-react-native';
import { useClubs } from '@features/clubs/hooks/useClubs';
import { SearchBar } from '@features/clubs/components/SearchBar';
import { ErrorState } from '@mobile/shared/components/ErrorState';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import type { Club } from '@features/clubs/types';
import { useTheme, Fonts, Type, Spacing, type AppColors } from '@theme';
import { ClubRankRow } from '../components/ClubRankRow';
import { ClubHeroCard, ClubInitialsTile } from '../components/ClubHeroCard';
import { NearbyClubsSection } from '../components/NearbyClubsSection';
import { ClubWarCard } from '../components/ClubWarCard';
import { ClubImagesPicker } from '../components/ClubImagesPicker';
import { FormScreen, FormField, ChoiceCards, FormButton } from '@mobile/shared/components/form/FormKit';
import { NewClubPost } from '../components/NewClubPost';
import { ScreenHeader } from '@mobile/shared/components/ScreenHeader';
import { AlertLayer } from '@mobile/shared/components/AppAlert';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ClubTab = 'my_clubs' | 'rankings';
// Matches the DB CHECK constraint on clubs.join_policy exactly (migration 005) —
// it only allows these two values. The UI previously offered a third 'request'
// option that could never be saved (createClub always failed the CHECK for it).
type JoinPolicy = 'open' | 'invite_only';


// A club's mark is its photo or its initials on the hexagon; badge_emoji stays only for older builds.
const DEFAULT_BADGE = '🏃';

const JOIN_POLICIES: { value: JoinPolicy; title: string; sub: string; Icon: Icon }[] = [
  { value: 'open',        title: 'Open',            sub: 'Anyone can join straight away', Icon: Users },
  { value: 'invite_only', title: 'Approve members', sub: 'People ask, an admin lets them in', Icon: Lock },
];

// ── Create Club ──────────────────────────────────────────────────────────────
// Full page on the shared form kit (mock onboarding style), not a bottom sheet.

function CreateClubSheet({ visible, onClose, onCreate }: {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, desc: string, emoji: string, policy: JoinPolicy, images: { avatar: string | null; banner: string | null }) => Promise<true | string>;
}) {
  const [avatar, setAvatar]     = useState<string | null>(null);
  const [banner, setBanner]     = useState<string | null>(null);
  const [name, setName]         = useState('');
  const [desc, setDesc]         = useState('');
  const [policy, setPolicy]     = useState<JoinPolicy>('open');
  const [saving, setSaving]     = useState(false);
  const [touched, setTouched]   = useState(false);

  const trimmedName = name.trim();
  const nameError = touched && trimmedName.length > 0 && trimmedName.length < 3 ? 'At least 3 characters' : null;
  const isValid = trimmedName.length >= 3 && trimmedName.length <= 30;

  const reset = () => { setName(''); setDesc(''); setPolicy('open'); setTouched(false); setAvatar(null); setBanner(null); };
  const handleCreate = async () => {
    if (saving || !isValid) return;
    setSaving(true);
    const ok = await onCreate(name, desc, DEFAULT_BADGE, policy, { avatar, banner });
    setSaving(false);
    if (ok === true) { reset(); onClose(); }
    else appAlert("Couldn't create the club", ok);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      {/* A Modal is a new native root: give it its own safe-area measurement,
          or the content starts under the status bar. */}
      <SafeAreaProvider>
      <FormScreen
        title="Start a"
        accent="club."
        subtitle="Run together, hold ground together. You can change all of this later."
        onClose={onClose}
        footer={<FormButton label="Create club" onPress={handleCreate} disabled={!isValid} busy={saving} />}
      >
        <ClubImagesPicker
          avatar={avatar}
          banner={banner}
          onAvatar={setAvatar}
          onBanner={setBanner}
          name={trimmedName}
        />
        <FormField
          label="Club name"
          value={name}
          onChangeText={t => { setName(t); setTouched(true); }}
          placeholder="Indiranagar Striders"
          maxLength={30}
          counter
          autoCapitalize="words"
          returnKeyType="next"
          error={nameError}
        />
        <FormField
          label="What's it about"
          optional
          value={desc}
          onChangeText={setDesc}
          placeholder="Saturday long runs, 5:30 pace groups, coffee after."
          maxLength={100}
          counter
          multiline
        />
        <ChoiceCards label="Who can join" options={JOIN_POLICIES} value={policy} onChange={setPolicy} />
      </FormScreen>
      <AlertLayer />
      </SafeAreaProvider>
    </Modal>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

/** `embedded`: shown inside the Groups tab, which supplies the title and safe area. */
export default function ClubScreen({ embedded = false }: { embedded?: boolean }) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const { filteredClubs, clubs, nearClubs, nearby, locationOn, loading, loadError, refreshing, joinClub, leaveClub, createClub, refresh } = useClubs();
  const [tab, setTab] = useState<ClubTab>('my_clubs');
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

  // One row: a scope chip that opens a sheet for the 3 options, plus a search
  // toggle — instead of 3 always-visible pills + a permanently-open search bar
  // + a table header stacked before a single ranked list ever shows.
  const ScopeHeader = (
    <>
      <View style={s.rankHeaderRow}>
        {/* The Local / National / International chip only changed this heading, never the
            list (clubs carry no country data), so it is a plain label until that exists. */}
        <Text style={s.scopeChipText}>All clubs, ranked by distance run</Text>
        <Pressable
          style={[s.searchToggle, rankSearchOpen && s.searchToggleActive]}
          onPress={() => setRankSearchOpen(o => { if (o) setRankSearch(''); return !o; })}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Search clubs"
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

  // Podium in the leaderboard mock's style: No. 1 on a warm orange block,
  // No. 2 and 3 on light cards, each club's own mark, its km beneath.
  const PodiumSection = rankedClubs.length >= 3 && !filteredRanked ? (
    <View style={s.podiumWrap}>
      {[rankedClubs[1], rankedClubs[0], rankedClubs[2]].map((club, idx) => {
        if (!club) return null;
        const first = idx === 1;
        const rank = [2, 1, 3][idx];
        return (
          <Pressable key={club.id} style={s.podiumSlot} onPress={() => goToDetail(club)} accessibilityRole="button" accessibilityLabel={`Number ${rank}, ${club.name}, ${club.total_km.toFixed(0)} kilometres`}>
            <ClubInitialsTile name={club.name} size={first ? 54 : 44} uri={club.avatar_url} shape="hex" />
            <Text style={[s.podiumName, first && s.podiumNameFirst]} numberOfLines={2}>{club.name}</Text>
            <View style={[s.podiumBlock, first ? s.podiumBlockFirst : s.podiumBlockSide, { height: first ? 118 : idx === 0 ? 96 : 82 }]}>
              <Text style={[s.podiumRank, first && s.podiumRankFirst]}>{rank}</Text>
              <Text style={[s.podiumKm, first && s.podiumKmFirst]}>{club.total_km.toFixed(0)} km</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  ) : null;

  const Root = embedded ? View : SafeAreaView;
  return (
    <Root style={s.root}>
      {!embedded && (
        <ScreenHeader variant="large" title="Clubs" onBack={() => navigation.goBack()} right={
          <Pressable style={s.createTrigger} onPress={() => setShowCreate(true)} testID="clubs-create-btn" accessibilityRole="button" accessibilityLabel="Create a club">
            <Plus size={14} color={C.t1} weight="bold" />
            <Text style={s.createTriggerText}>Create</Text>
          </Pressable>
        } />
      )}

      {/* Tab bar (embedded in Groups: chips on the left, Create on the right, one row) */}
      <View style={[s.tabBar, embedded && { marginTop: 14 }]}>
        {(['my_clubs', 'rankings'] as ClubTab[]).map(t => (
          <Pressable hitSlop={8} key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabLabel, tab === t && s.tabLabelActive]}>
              {t === 'my_clubs' ? 'My clubs' : 'Rankings'}
            </Text>
          </Pressable>
        ))}
        {/* C4: group challenges with people you follow (C6: the open lobby room is gone). */}
        {!embedded && (
          <Pressable hitSlop={8} style={s.tabBtn} onPress={() => navigation.navigate('Challenges')}>
            <Text style={s.tabLabel}>Challenges</Text>
          </Pressable>
        )}
        {embedded && (
          <Pressable style={[s.createTrigger, { marginLeft: 'auto', height: 38 }]} onPress={() => setShowCreate(true)} testID="clubs-create-btn" accessibilityRole="button">
            <Plus size={14} color={C.t1} weight="bold" />
            <Text style={s.createTriggerText}>Create</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={C.red} /></View>
      ) : loadError && clubs.length === 0 ? (
        <ErrorState title="Couldn't load clubs" onRetry={refresh} />
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
          ListHeaderComponent={myClubs.length > 0 ? (
            <>
              <NewClubPost clubs={myClubs} onPick={c => navigation.navigate('ClubDetail', { clubId: c.id, clubName: c.name, badgeEmoji: c.badge_emoji, memberCount: c.member_count, totalKm: c.total_km, compose: true })} />
              <Text style={s.sectionHead}>Your clubs</Text>
            </>
          ) : null}
          ListFooterComponent={
            <View style={{ marginTop: myClubs.length > 0 ? 22 : 0 }}>
              {myClubs[0] && (
                <View style={{ marginBottom: 22 }}>
                  <ClubWarCard clubId={myClubs[0].id} onPress={() => goToDetail(myClubs[0]!)} />
                </View>
              )}
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

    </Root>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    podiumWrap:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 },
    podiumSlot:       { flex: 1, alignItems: 'center', gap: 6 },
    podiumName:       { fontFamily: Fonts.medium, fontSize: 13, lineHeight: 17, color: C.t1, textAlign: 'center', minHeight: 34 },
    podiumNameFirst:  { fontFamily: Fonts.semiBold },
    podiumBlock:      { alignSelf: 'stretch', borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 2 },
    podiumBlockFirst: { backgroundColor: '#F2A43A' },
    podiumBlockSide:  { backgroundColor: C.card },
    podiumRank:       { fontFamily: Fonts.semiBold, fontSize: 26, color: C.t1 },
    podiumRankFirst:  { fontSize: 32, color: C.alwaysDark },
    podiumKm:         { fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2 },
    podiumKmFirst:    { color: 'rgba(23,24,26,0.75)' },
    root:            { flex: 1, backgroundColor: C.bg },
    createTrigger:   { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.card },
    createTriggerText: { fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
    // Tabs - match web (black underline active)
    // Segmented control: one rounded track, active segment is a raised card.
    tabBar:          { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 18, marginBottom: 10 },
    tabBtn:          { height: 38, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: C.card },
    tabBtnActive:    { backgroundColor: C.alwaysDark },
    tabLabel:        { fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
    tabLabelActive:  { color: C.alwaysLight },
    sectionHead:     { fontFamily: Fonts.semiBold, fontSize: 18, color: C.t1, marginTop: 6, marginBottom: 2 },
    loader:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
    myClubsHeading:  { ...Type.headline, color: C.t1, marginBottom: 8 },
    // My Clubs tab — 2-column grid
    searchWrap:      { paddingTop: 10, paddingBottom: 6 },
    myClubList:      { paddingHorizontal: Spacing.gutter, paddingBottom: 130, gap: 10 },
    myClubGridRow:   { gap: 10 },
    myClubRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 13, backgroundColor: C.card, borderBottomWidth: 0.5, borderBottomColor: C.mid },
    myClubAvatar:    { width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    myClubTopRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
    myClubName:      { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1, flex: 1 },
    myClubDate:      { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginLeft: 8, flexShrink: 0 },
    myClubMeta:      { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginBottom: 2 },
    myClubPreview:   { fontFamily: Fonts.regular, fontSize: 11, color: C.t3 },
    empty:           { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, marginTop: 4, borderRadius: 24, backgroundColor: C.card },
    emptyTitle:      { fontFamily: Fonts.medium, fontSize: 13, color: C.t1, marginBottom: 4 },
    emptyTitleServe: { ...Type.title, color: C.t1, marginBottom: 6, textAlign: 'center' },
    emptyText:       { ...Type.bodySm, color: C.t2, textAlign: 'center', marginBottom: 16 },
    emptyBtn:        { backgroundColor: C.alwaysDark, paddingHorizontal: 22, height: 46, justifyContent: 'center', borderRadius: 999 },
    emptyBtnLabel:   { ...Type.button, color: C.alwaysLight },
    // Rankings tab — one row (scope chip + search toggle) instead of pills + a
    // permanently-open search bar stacked above the list.
    rankList:        { paddingBottom: 130 },
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
  });
}
