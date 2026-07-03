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
import StoryViewerScreen     from '@features/social/screens/StoryViewerScreen';
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
import CoachScreen           from '@features/coach/screens/CoachScreen';
import EventsScreen          from '@features/events/screens/EventsScreen';
import CreateEventScreen     from '@features/events/screens/CreateEventScreen';
import ClubScreen            from '@features/clubs/screens/ClubScreen';
import ClubDetailScreen      from '@features/clubs/screens/ClubDetailScreen';
import LobbyScreen           from '@features/clubs/screens/LobbyScreen';
import LobbyChatScreen       from '@features/clubs/screens/LobbyChatScreen';
import LeaderboardScreen     from '@features/leaderboard/screens/LeaderboardScreen';
import CalorieTrackerScreen  from '@features/nutrition/screens/CalorieTrackerScreen';
import NutritionSetupScreen  from '@features/nutrition/screens/NutritionSetupScreen';
import GearScreen            from '@features/gear/screens/GearScreen';
import GearAddScreen         from '@features/gear/screens/GearAddScreen';
import FootScanScreen        from '@features/gear/screens/FootScanScreen';
import SubscriptionScreen    from '@features/subscription/screens/SubscriptionScreen';
import LandingScreen         from '@features/auth/screens/LandingScreen';
import LoginScreen           from '@features/auth/screens/LoginScreen';
import SignUpScreen          from '@features/auth/screens/SignUpScreen';
import OnboardingScreen      from '@features/auth/screens/OnboardingScreen';
import PACEStoreScreen       from '@features/store/screens/PACEStoreScreen';
import RewardDetailScreen    from '@features/store/screens/RewardDetailScreen';
import CoachPlanScreen      from '@features/coach/screens/CoachPlanScreen';
import RunReplayScreen      from '@features/run/screens/RunReplayScreen';

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
  ActiveRun: { ghostRoutePoints?: { lat: number; lng: number }[]; activityType?: string } | undefined;
  RunSummary: {
    runId: string;
    runData?: {
      distance: number;
      duration: number;
      pace: number;
      territoriesClaimed: number;
      route?: { lat: number; lng: number }[];
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
    };
  };
  Coach:     undefined;
  Missions:  undefined;
  Events:    undefined;
  CreateEvent: undefined;
  Club:      undefined;
  ClubDetail: { clubId: string; clubName: string; badgeEmoji: string; memberCount: number; totalKm: number; description?: string };
  Lobby:     undefined;
  LobbyChat: { lobbyId: string };
  Leaderboard: undefined;
  CalorieTracker: { burnKcal?: number } | undefined;
  NutritionSetup: undefined;
  History:   undefined;
  Settings:          undefined;
  ConnectedDevices:  undefined;
  Gear:      undefined;
  GearAdd:   undefined;
  FootScan:  undefined;
  TerritoryMap: { initialFilter?: 'all' | 'mine' | 'rivals' | 'stale' } | undefined;
  Notifications: undefined;
  Subscription: undefined;
  StoryViewer: {
    groups: { userId: string; userName: string; stories: { id: string; imageUrl: string }[] }[];
    initialGroupIndex: number;
  };
  UserProfile: { userId: string; username: string };
  Followers: { userId: string };
  Following: { userId: string };
  AwardDetail: { awardId: string; unlockedAt: string | null };
  PACEStore:    undefined;
  RewardDetail: { rewardId: string };
  CoachPlan:    undefined;
  RunReplay: {
    runId: string;
    route: { lat: number; lng: number }[];
    durationSec: number;
    pace: number;
  };
};

export type TabParamList = {
  Dashboard: undefined;
  Feed:      undefined;
  Run:       undefined;
  Coach:     undefined;
  Profile:   undefined;
};

// ─── Bottom Tab Navigator ────────────────────────────────────────────────────
const Tab = createBottomTabNavigator<TabParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Feed"  component={FEATURES.SOCIAL_FEED ? FeedScreen  : () => <ComingSoon feature={FEATURE_LABELS.SOCIAL_FEED!} />} />
      <Tab.Screen name="Run"       component={RunScreen}       />
      <Tab.Screen name="Coach" component={FEATURES.AI_COACH   ? CoachScreen : () => <ComingSoon feature={FEATURE_LABELS.AI_COACH!} />} />
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
      Lobby:       'lobby',
      Notifications: 'notifications',
      Subscription:      'subscription',
      ConnectedDevices:  'settings/devices',
      RunSummary:    'run/summary/:runId',
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
      <Stack.Navigator screenOptions={{ headerShown: false }}>
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
            <Stack.Screen name="Coach"           component={FEATURES.AI_COACH ? CoachScreen : () => <ComingSoon feature={FEATURE_LABELS.AI_COACH!} />} />
            <Stack.Screen name="Missions"        component={MissionsScreen} />
            <Stack.Screen name="Events"          component={FEATURES.EVENTS ? EventsScreen      : () => <ComingSoon feature={FEATURE_LABELS.EVENTS!} />} />
            <Stack.Screen name="CreateEvent"     component={FEATURES.EVENTS ? CreateEventScreen : () => <ComingSoon feature={FEATURE_LABELS.EVENTS!} />} />
            <Stack.Screen name="Club"            component={FEATURES.CLUBS ? ClubScreen       : () => <ComingSoon feature={FEATURE_LABELS.CLUBS!} />} />
            <Stack.Screen name="ClubDetail"      component={FEATURES.CLUBS ? ClubDetailScreen : () => <ComingSoon feature={FEATURE_LABELS.CLUBS!} />} />
            <Stack.Screen name="Lobby"           component={FEATURES.CLUBS ? LobbyScreen      : () => <ComingSoon feature={FEATURE_LABELS.CLUBS!} />} />
            <Stack.Screen name="LobbyChat"       component={FEATURES.CLUBS ? LobbyChatScreen  : () => <ComingSoon feature={FEATURE_LABELS.CLUBS!} />} />
            <Stack.Screen name="Leaderboard"     component={LeaderboardScreen} />
            <Stack.Screen name="CalorieTracker"  component={FEATURES.NUTRITION_TRACKER ? CalorieTrackerScreen : () => <ComingSoon feature={FEATURE_LABELS.NUTRITION_TRACKER!} />} />
            <Stack.Screen name="NutritionSetup"  component={FEATURES.NUTRITION_TRACKER ? NutritionSetupScreen : () => <ComingSoon feature={FEATURE_LABELS.NUTRITION_TRACKER!} />} />
            <Stack.Screen name="History"         component={HistoryScreen} />
            <Stack.Screen name="Settings"          component={SettingsScreen} />
            <Stack.Screen name="ConnectedDevices"  component={ConnectedDevicesScreen} />
            <Stack.Screen name="Gear"            component={FEATURES.GEAR_TRACKING ? GearScreen    : () => <ComingSoon feature={FEATURE_LABELS.GEAR_TRACKING!} />} />
            <Stack.Screen name="GearAdd"         component={FEATURES.GEAR_TRACKING ? GearAddScreen  : () => <ComingSoon feature={FEATURE_LABELS.GEAR_TRACKING!} />} />
            <Stack.Screen name="FootScan"        component={FEATURES.GEAR_TRACKING ? FootScanScreen : () => <ComingSoon feature={FEATURE_LABELS.GEAR_TRACKING!} />} />
            <Stack.Screen name="TerritoryMap"     component={TerritoryMapScreen} />
            <Stack.Screen name="Notifications"   component={NotificationsScreen} />
            <Stack.Screen name="Subscription"    component={SubscriptionScreen} />
            <Stack.Screen name="StoryViewer"     component={StoryViewerScreen} />
            <Stack.Screen name="UserProfile"     component={UserProfileScreen} />
            <Stack.Screen name="Followers"       component={FollowersScreen}   />
            <Stack.Screen name="Following"       component={FollowingScreen}   />
            <Stack.Screen name="AwardDetail"     component={AwardDetailScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="PACEStore"       component={PACEStoreScreen}    options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="RewardDetail"    component={RewardDetailScreen} options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="CoachPlan"       component={FEATURES.AI_COACH ? CoachPlanScreen : () => <ComingSoon feature={FEATURE_LABELS.AI_COACH!} />} options={{ headerShown: false }} />
            <Stack.Screen name="RunReplay"       component={RunReplayScreen}   options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
    </CoachNavProvider>
  );
}

