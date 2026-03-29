import React, { useEffect } from 'react';
import { Platform, StyleSheet, Linking } from 'react-native';
import { Home, Play, Rss, Sparkles, User } from 'lucide-react-native';
import { NavigationContainer, useNavigationContainerRef, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  registerNotificationHandler,
  handleLaunchNotification,
} from '@features/notifications/services/notificationHandler';
import { syncPushSubscriptionOnLoad } from '@shared/services/pushNotificationService';
import { configureRevenueCat } from '@features/subscription/services/purchaseService';

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
import MissionsScreen        from '@features/missions/screens/MissionsScreen';
import HistoryScreen         from '@features/history/screens/HistoryScreen';
import NotificationsScreen   from '@features/notifications/screens/NotificationsScreen';
import SettingsScreen           from '@features/settings/screens/SettingsScreen';
import ConnectedDevicesScreen   from '@features/settings/screens/ConnectedDevicesScreen';
import CoachScreen           from '@features/coach/screens/CoachScreen';
import EventsScreen          from '@features/events/screens/EventsScreen';
import CreateEventScreen     from '@features/events/screens/CreateEventScreen';
import ClubScreen            from '@features/clubs/screens/ClubScreen';
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

// ─── Route param types ───────────────────────────────────────────────────────
export type RootStackParamList = {
  // Unauthenticated
  Landing:   undefined;
  Login:     undefined;
  SignUp:    undefined;
  Onboarding: undefined;
  // Authenticated
  Main:      undefined;
  // Modal / overlay stacks
  ActiveRun: { ghostRoutePoints?: { lat: number; lng: number }[] } | undefined;
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
      xpEarned?: number;
      enemyCaptured?: number;
      leveledUp?: boolean;
      preRunLevel?: number;
      newLevel?: number;
      newStreak?: number;
      completedMissions?: { id: string; title: string }[];
      startTime?: number;
    };
  };
  Coach:     undefined;
  Missions:  undefined;
  Events:    undefined;
  CreateEvent: undefined;
  Club:      undefined;
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
  Notifications: undefined;
  Subscription: undefined;
  StoryViewer: {
    groups: { userId: string; userName: string; stories: { id: string; imageUrl: string }[] }[];
    initialGroupIndex: number;
  };
  UserProfile: { userId: string; username: string };
};

export type TabParamList = {
  Dashboard: undefined;
  Feed:      undefined;
  Run:       undefined;
  Coach:     undefined;
  Profile:   undefined;
};

// ─── Tab icons ───────────────────────────────────────────────────────────────
const ACTIVE_COLOR   = '#D93518';
const INACTIVE_COLOR = '#ADADAD';
const ICON_SIZE      = 22;

type TabIconName = 'Home' | 'Play' | 'Rss' | 'Sparkles' | 'User';
const ICON_MAP: Record<TabIconName, React.FC<{ size: number; color: string; strokeWidth: number }>> = {
  Home, Play, Rss, Sparkles, User,
};

function TabIcon({ focused, icon }: { focused: boolean; icon: TabIconName }) {
  const Icon = ICON_MAP[icon];
  return (
    <Icon
      size={ICON_SIZE}
      color={focused ? ACTIVE_COLOR : INACTIVE_COLOR}
      strokeWidth={focused ? 2 : 1.5}
    />
  );
}

// ─── Bottom Tab Navigator ────────────────────────────────────────────────────
const Tab = createBottomTabNavigator<TabParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#F5F3EF',
          borderTopWidth: 0,
          paddingBottom: Platform.OS === 'ios' ? 0 : 8,
          height: Platform.OS === 'ios' ? 80 : 60,
        },
        tabBarActiveTintColor: '#D93518',
        tabBarInactiveTintColor: '#ADADAD',
        tabBarLabelStyle: { fontFamily: 'Barlow_400Regular', fontSize: 10 },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="Home" />,
        }}
      />
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarLabel: 'Feed',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="Rss" />,
        }}
      />
      <Tab.Screen
        name="Run"
        component={RunScreen}
        options={{
          tabBarLabel: 'Run',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="Play" />,
        }}
      />
      <Tab.Screen
        name="Coach"
        component={CoachScreen}
        options={{
          tabBarLabel: 'Coach',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="Sparkles" />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="User" />,
        }}
      />
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
    })();
  }, [isAuthenticated]);

  return (
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
            <Stack.Screen name="Coach"           component={CoachScreen} />
            <Stack.Screen name="Missions"        component={MissionsScreen} />
            <Stack.Screen name="Events"          component={EventsScreen} />
            <Stack.Screen name="CreateEvent"     component={CreateEventScreen} />
            <Stack.Screen name="Club"            component={ClubScreen} />
            <Stack.Screen name="Lobby"           component={LobbyScreen} />
            <Stack.Screen name="LobbyChat"       component={LobbyChatScreen} />
            <Stack.Screen name="Leaderboard"     component={LeaderboardScreen} />
            <Stack.Screen name="CalorieTracker"  component={CalorieTrackerScreen} />
            <Stack.Screen name="NutritionSetup"  component={NutritionSetupScreen} />
            <Stack.Screen name="History"         component={HistoryScreen} />
            <Stack.Screen name="Settings"          component={SettingsScreen} />
            <Stack.Screen name="ConnectedDevices"  component={ConnectedDevicesScreen} />
            <Stack.Screen name="Gear"            component={GearScreen} />
            <Stack.Screen name="GearAdd"         component={GearAddScreen} />
            <Stack.Screen name="FootScan"        component={FootScanScreen} />
            <Stack.Screen name="Notifications"   component={NotificationsScreen} />
            <Stack.Screen name="Subscription"    component={SubscriptionScreen} />
            <Stack.Screen name="StoryViewer"     component={StoryViewerScreen} />
            <Stack.Screen name="UserProfile"     component={UserProfileScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const styles = StyleSheet.create({});
