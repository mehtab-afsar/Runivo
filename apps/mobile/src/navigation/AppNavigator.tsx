import React, { useEffect } from 'react';
import { Linking } from 'react-native';
import { CustomTabBar } from './CustomTabBar';
import { CoachNavProvider } from './CoachNavContext';
import { NavigationContainer, useNavigationContainerRef, type LinkingOptions, type NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  registerNotificationHandler,
  handleLaunchNotification,
} from '@features/notifications/services/notificationHandler';
import { syncPushSubscriptionOnLoad } from '@shared/services/pushNotificationService';
import { configureRevenueCat } from '@features/subscription/services/purchaseService';
import { useTheme } from '@theme';

// ─── Feature flags ───────────────────────────────────────────────────────────
import { FEATURES, FEATURE_LABELS } from '../config/features';
import { ComingSoon } from '@mobile/shared/components/ComingSoon';

// ─── Screens ─────────────────────────────────────────────────────────────────
import DashboardScreen       from '@features/dashboard/screens/DashboardScreen';
import ActiveRunScreen       from '@features/run/screens/ActiveRunScreen';
import RunSummaryScreen      from '@features/run/screens/RunSummaryScreen';
import RunScreen             from '@features/run/screens/RunScreen';
import TerritoryMapScreen    from '@features/territory/screens/TerritoryMapScreen';
import FeedScreen            from '@features/social/screens/FeedScreen';
import GroupsScreen          from '@features/groups/screens/GroupsScreen';
import ProfileScreen         from '@features/profile/screens/ProfileScreen';
import UserProfileScreen     from '@features/profile/screens/UserProfileScreen';
import FollowersScreen       from '@features/profile/screens/FollowersScreen';
import FollowingScreen       from '@features/profile/screens/FollowingScreen';
import AwardDetailScreen     from '@features/profile/screens/AwardDetailScreen';
import MissionsScreen        from '@features/missions/screens/MissionsScreen';
import HistoryScreen         from '@features/history/screens/HistoryScreen';
import NotificationsScreen   from '@features/notifications/screens/NotificationsScreen';
import SettingsScreen           from '@features/settings/screens/SettingsScreen';
import ConnectedDevicesScreen   from '@features/settings/screens/ConnectedDevicesScreen';
import MapVisibilityScreen      from '@features/settings/screens/MapVisibilityScreen';
import BlockedRunnersScreen     from '@features/settings/screens/BlockedRunnersScreen';
import PrivacyScreen            from '@features/settings/screens/PrivacyScreen';
import TrainingPlanScreen       from '@features/training/screens/TrainingPlanScreen';
import PlanBuilderScreen        from '@features/training/screens/PlanBuilderScreen';
import CoachScreen           from '@features/coach/screens/CoachScreen';
import EventsScreen          from '@features/events/screens/EventsScreen';
import CreateEventScreen     from '@features/events/screens/CreateEventScreen';
import ClubScreen            from '@features/clubs/screens/ClubScreen';
import ClubDetailScreen      from '@features/clubs/screens/ClubDetailScreen';
import ChallengesScreen      from '@features/challenges/screens/ChallengesScreen';
import ChallengeDetailScreen from '@features/challenges/screens/ChallengeDetailScreen';
import LeaderboardScreen     from '@features/leaderboard/screens/LeaderboardScreen';
import CalorieTrackerScreen  from '@features/nutrition/screens/CalorieTrackerScreen';
import NutritionSetupScreen  from '@features/nutrition/screens/NutritionSetupScreen';
import GearScreen            from '@features/gear/screens/GearScreen';
import GearAddScreen         from '@features/gear/screens/GearAddScreen';
import FootScanScreen        from '@features/gear/screens/FootScanScreen';
import type { PaywallReason } from '@shared/engine/entitlements';
import type { RaceDistance } from '@shared/engine/training';
import type { TargetZone } from '@shared/engine/targetZone';
import SubscriptionScreen    from '@features/subscription/screens/SubscriptionScreen';
import LandingScreen         from '@features/auth/screens/LandingScreen';
import LoginScreen           from '@features/auth/screens/LoginScreen';
import SignUpScreen          from '@features/auth/screens/SignUpScreen';
import OnboardingScreen      from '@features/auth/screens/OnboardingScreen';
import PACEStoreScreen       from '@features/store/screens/PACEStoreScreen';
import RewardDetailScreen    from '@features/store/screens/RewardDetailScreen';
import MyRewardsScreen       from '@features/store/screens/MyRewardsScreen';
import YearInRunivoScreen    from '@features/profile/screens/YearInRunivoScreen';
import ProfileStatsScreen    from '@features/profile/screens/ProfileStatsScreen';
import TrainingLogScreen     from '@features/profile/screens/TrainingLogScreen';
import StrengthScreen        from '@features/training/screens/StrengthScreen';
import LogTreadmillScreen    from '@features/run/screens/LogTreadmillScreen';
import type { Reward }       from '@features/store/types';
import MyFeedScreen         from '@features/social/screens/MyFeedScreen';
import RunReplayScreen      from '@features/run/screens/RunReplayScreen';

// Stable component per feature. An inline `() => <ComingSoon/>` is a NEW component type on
// every AppNavigator render, which remounts the screen (losing its state) each time.
const comingSoonCache = new Map<string, React.ComponentType>();
function comingSoon(label: string): React.ComponentType {
  let c = comingSoonCache.get(label);
  if (!c) { c = function ComingSoonScreen() { return <ComingSoon feature={label} />; }; comingSoonCache.set(label, c); }
  return c;
}

// ─── Route param types ───────────────────────────────────────────────────────
export type RootStackParamList = {
  // Unauthenticated
  Landing:   undefined;
  Login:     undefined;
  SignUp:    undefined;
  Onboarding: undefined;
  // Authenticated
  Main:      NavigatorScreenParams<TabParamList> | undefined;
  // Modal / overlay stacks
  ActiveRun: { ghostRoutePoints?: { lat: number; lng: number }[]; activityType?: string; mapStyle?: string; pacerEnabled?: boolean; pacerPace?: string; autoStart?: boolean; /** A planned session to run in workout mode (training plan). */ sessionId?: string; /** Defend or attack this zone (M1). */ targetZone?: TargetZone } | undefined;
  RunSummary: {
    runId: string;
    /** 'cycle' turns the summary into a ride summary (tracked only). */
    activityType?: string;
    runData?: {
      distance: number;
      duration: number;
      pace: number;
      territoriesClaimed: number;
      route?: { lat: number; lng: number; timestamp?: number }[];
      actionType?: string;
      success?: boolean;
      enemyCaptured?: number;
      preRunLevel?: number;
      newLevel?: number;
      newStreak?: number;
      completedMissions?: { id: string; title: string }[];
      startTime?: number;
      elevationGainM?: number;
      paceEarned?: number;
      paceBreakdown?: { fromDistance: number; fromNewZones: number; fromStolenZones: number; fromStreak: number };
      cappedAt?: number;
      territory?: { id: string; runId: string; ownerId: string; ownerName: string; polygon: [number, number][]; areaM2: number; freshness: number; lastDefendedAt: string; claimedAt: string; isLoopFill: boolean; tier: 'patch' | 'block' | 'district' | 'quarter' | 'domain'; synced: boolean } | null;
      runnerRank?: 'pacer' | 'strider' | 'chaser' | 'hunter' | 'sovereign';
      paceTotalEarned?: number;
      runnerRankPaceToNext?: number;
      rivalZonesStolen?: number;
      newAwards?: string[];
    };
  };
  Coach:     undefined;
  Missions:  undefined;
  Events:    undefined;
  CreateEvent: undefined;
  Club:      undefined;
  ClubDetail: { clubId: string; clubName: string; badgeEmoji: string; memberCount: number; totalKm: number; description?: string };
  Challenges: undefined;
  ChallengeDetail: { id: string };
  Leaderboard: undefined;
  CalorieTracker: { burnKcal?: number } | undefined;
  NutritionSetup: undefined;
  History:   undefined;
  Settings:          undefined;
  ConnectedDevices:  undefined;
  MapVisibility:     undefined;
  BlockedRunners:    undefined;
  Privacy:           undefined;
  TrainingPlan:      undefined;
  PlanBuilder:       { race?: RaceDistance; raceDate?: string; raceName?: string; fromOnboarding?: boolean } | undefined;
  Gear:      undefined;
  GearAdd:   undefined;
  FootScan:  undefined;
  TerritoryMap: { initialFilter?: 'all' | 'mine' | 'rivals' | 'stale'; /** Show this club's ground (C2). */ clubId?: string; clubName?: string } | undefined;
  Notifications: undefined;
  /** reason: which paywall moment opened it (sets the headline). */
  Subscription: { reason?: PaywallReason } | undefined;
  // username is optional — deep links from push notifications (e.g. a new-follower
  // push) only carry the userId; the screen fetches the rest itself.
  UserProfile: { userId: string; username?: string };
  ProfileStats: { sport?: 'all' | 'run' | 'walk' | 'ride' } | undefined;
  TrainingLog: undefined;
  Strength: undefined;
  LogTreadmill: undefined;
  Followers: { userId: string };
  Following: { userId: string };
  AwardDetail: { awardId: string; unlockedAt: string | null };
  PACEStore:    undefined;
  // `reward` is optional — passed by PACEStoreScreen to avoid a second fetch;
  // the screen shows "not found" if it is ever reached without it.
  RewardDetail: { rewardId: string; reward?: Reward };
  MyRewards:    undefined;
  YearInRunivo: { year?: number } | undefined;
  MyFeed: undefined;
  Feed: { search?: boolean } | undefined;
  RunReplay: {
    runId: string;
    route: { lat: number; lng: number }[];
    durationSec: number;
    pace: number;
  };
};

export type TabParamList = {
  Dashboard: undefined;
  Groups:    undefined;
  Run:       undefined;
  Map:       undefined;
  Profile:   undefined;
};

// ─── Bottom Tab Navigator ────────────────────────────────────────────────────
const Tab = createBottomTabNavigator<TabParamList>();

// The territory map is both a tab root (no params) and a pushable stack screen
// (with an optional initial filter). It reads params defensively, so the tab
// can render the same component.
const TerritoryMapTab = TerritoryMapScreen as unknown as React.ComponentType;

function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {/* 2026 tab order: Home, Map, Record, Groups, You. The feed lives on Home;
          Groups holds Challenges, Clubs and Events. */}
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Map"       component={TerritoryMapTab} />
      <Tab.Screen name="Run"       component={RunScreen}       />
      <Tab.Screen name="Groups"    component={GroupsScreen}    />
      <Tab.Screen name="Profile"   component={ProfileScreen}   />
    </Tab.Navigator>
  );
}

// ─── Deep link config ────────────────────────────────────────────────────────
// Handles runivo:// URLs and https://runivo.app universal links.
// Used for: Supabase magic-link auth callbacks, push notification URLs,
// and any runivo:// links shared from other apps.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['runivo://', 'https://runivo.app'],
  async getInitialURL() {
    // Check if app was opened from a deep link
    const url = await Linking.getInitialURL();
    if (url) return url;
    // Check if app was opened from a push notification
    const response = await import('expo-notifications')
      .then(n => n.getLastNotificationResponseAsync())
      .catch(() => null);
    const actionUrl = (response?.notification.request.content.data as { actionUrl?: string })?.actionUrl;
    if (actionUrl) return `runivo:/${actionUrl}`;
    return null;
  },
  subscribe(listener) {
    const sub = Linking.addEventListener('url', ({ url }) => listener(url));
    return () => sub.remove();
  },
  config: {
    screens: {
      Main: '',
      Landing:     'landing',
      Login:       'login',
      SignUp:      'signup',
      Onboarding:  'onboarding',
      History:     'history',
      Missions:    'missions',
      Leaderboard: 'leaderboard',
      Events:      'events',
      Club:        'clubs',
      Challenges:  'challenges',
      ChallengeDetail: 'challenges/:id',
      Notifications: 'notifications',
      Subscription:      'subscription',
      ConnectedDevices:  'settings/devices',
      MapVisibility:     'settings/map-visibility',
      BlockedRunners:    'settings/blocked',
      Privacy:           'settings/privacy',
      MyRewards:         'store/mine',
      YearInRunivo:      'year',
      ProfileStats:      'profile/stats',
      TrainingLog:       'profile/log',
      Strength:          'training/strength',
      UserProfile:       'runner/:userId',
      TrainingPlan:      'training',
      PlanBuilder:       'training/new',
      RunSummary:    'run/summary/:runId',
      AwardDetail:   'award/:awardId',
    },
  },
};

// ─── Root Stack Navigator ────────────────────────────────────────────────────
const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator({
  isAuthenticated,
  needsOnboarding = false,
}: {
  isAuthenticated: boolean;
  needsOnboarding?: boolean;
}) {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const C = useTheme();

  useEffect(() => {
    if (!isAuthenticated) return;
    registerNotificationHandler(navigationRef);
    handleLaunchNotification(navigationRef).catch(() => {});
    syncPushSubscriptionOnLoad().catch(() => {});
    // Configure RevenueCat with the current user's ID for receipt attribution
    (async () => {
      const { data: { user } } = await (await import('@shared/services/supabase')).supabase.auth.getUser();
      configureRevenueCat(user?.id).catch(() => {});
    })().catch(() => {});
  }, [isAuthenticated]);

  return (
    <CoachNavProvider>
    <NavigationContainer ref={navigationRef} linking={linking}>
      {/* contentStyle gives every screen a guaranteed opaque backing during the
          push transition — without it, a screen whose own root view doesn't yet
          fully cover the viewport lets the outgoing screen (tab bar included)
          show through underneath for the length of the animation. */}
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
        {!isAuthenticated ? (
          // Unauthenticated group
          <>
            <Stack.Screen name="Landing"    component={LandingScreen} />
            <Stack.Screen name="Login"      component={LoginScreen} />
            <Stack.Screen name="SignUp"     component={SignUpScreen} />
          </>
        ) : (
          // Authenticated group
          // React Navigation shows the FIRST registered screen as the initial route.
          // When needsOnboarding=true, Onboarding is listed first so it opens automatically.
          <>
            {needsOnboarding
              ? <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              : <Stack.Screen name="Main"       component={TabNavigator} />
            }
            {/* Always register both so navigation.navigate() works from any screen */}
            {!needsOnboarding && (
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            )}
            {needsOnboarding && (
              <Stack.Screen name="Main" component={TabNavigator} />
            )}
            <Stack.Screen
              name="ActiveRun"
              component={ActiveRunScreen}
              options={{ gestureEnabled: false }}
            />
            <Stack.Screen name="RunSummary"      component={RunSummaryScreen} />
            <Stack.Screen name="Coach"           component={FEATURES.AI_COACH ? CoachScreen : comingSoon(FEATURE_LABELS.AI_COACH!)} />
            <Stack.Screen name="Missions"        component={FEATURES.DAILY_MISSIONS ? MissionsScreen : comingSoon(FEATURE_LABELS.DAILY_MISSIONS!)} />
            <Stack.Screen name="Events"          component={FEATURES.EVENTS ? EventsScreen      : comingSoon(FEATURE_LABELS.EVENTS!)} />
            <Stack.Screen name="CreateEvent"     component={FEATURES.EVENTS ? CreateEventScreen : comingSoon(FEATURE_LABELS.EVENTS!)} />
            <Stack.Screen name="Club"            component={FEATURES.CLUBS ? ClubScreen       : comingSoon(FEATURE_LABELS.CLUBS!)} />
            <Stack.Screen name="ClubDetail"      component={FEATURES.CLUBS ? ClubDetailScreen : comingSoon(FEATURE_LABELS.CLUBS!)} />
            <Stack.Screen name="Challenges"      component={ChallengesScreen} />
            <Stack.Screen name="ChallengeDetail" component={ChallengeDetailScreen} />
            <Stack.Screen name="Leaderboard"     component={LeaderboardScreen} />
            <Stack.Screen name="CalorieTracker"  component={FEATURES.NUTRITION_TRACKER ? CalorieTrackerScreen : comingSoon(FEATURE_LABELS.NUTRITION_TRACKER!)} />
            <Stack.Screen name="NutritionSetup"  component={FEATURES.NUTRITION_TRACKER ? NutritionSetupScreen : comingSoon(FEATURE_LABELS.NUTRITION_TRACKER!)} />
            <Stack.Screen name="History"         component={HistoryScreen} />
            <Stack.Screen name="Settings"          component={SettingsScreen} />
            <Stack.Screen name="ConnectedDevices"  component={ConnectedDevicesScreen} />
            <Stack.Screen name="MapVisibility"     component={MapVisibilityScreen} />
            <Stack.Screen name="BlockedRunners"    component={BlockedRunnersScreen} />
            <Stack.Screen name="Privacy"           component={PrivacyScreen} />
            <Stack.Screen name="TrainingPlan"      component={TrainingPlanScreen} />
            <Stack.Screen name="PlanBuilder"       component={PlanBuilderScreen} />
            <Stack.Screen name="Gear"            component={FEATURES.GEAR_TRACKING ? GearScreen    : comingSoon(FEATURE_LABELS.GEAR_TRACKING!)} />
            <Stack.Screen name="GearAdd"         component={FEATURES.GEAR_TRACKING ? GearAddScreen  : comingSoon(FEATURE_LABELS.GEAR_TRACKING!)} />
            <Stack.Screen name="FootScan"        component={FEATURES.GEAR_TRACKING ? FootScanScreen : comingSoon(FEATURE_LABELS.GEAR_TRACKING!)} />
            <Stack.Screen name="TerritoryMap"     component={TerritoryMapScreen} />
            <Stack.Screen name="Notifications"   component={NotificationsScreen} />
            <Stack.Screen name="Subscription"    component={SubscriptionScreen} />
            <Stack.Screen name="UserProfile"     component={UserProfileScreen} />
            <Stack.Screen name="Followers"       component={FollowersScreen}   />
            <Stack.Screen name="Following"       component={FollowingScreen}   />
            <Stack.Screen name="AwardDetail"     component={AwardDetailScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="PACEStore"       component={PACEStoreScreen}    options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="RewardDetail"    component={RewardDetailScreen} options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="MyRewards"       component={MyRewardsScreen} />
            <Stack.Screen name="YearInRunivo"    component={YearInRunivoScreen} />
            <Stack.Screen name="ProfileStats"    component={ProfileStatsScreen} />
            <Stack.Screen name="TrainingLog"     component={TrainingLogScreen} />
            <Stack.Screen name="Strength"        component={StrengthScreen} />
            <Stack.Screen name="LogTreadmill"    component={LogTreadmillScreen} />
            <Stack.Screen name="RunReplay"       component={RunReplayScreen}   options={{ headerShown: false }} />
            <Stack.Screen name="MyFeed"          component={MyFeedScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Feed"            component={FEATURES.SOCIAL_FEED ? FeedScreen : comingSoon(FEATURE_LABELS.SOCIAL_FEED!)} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
    </CoachNavProvider>
  );
}

