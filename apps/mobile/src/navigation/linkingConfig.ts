/**
 * Deep-link paths (runivo://… and https://runivo.app/…). Pure data, so tests can
 * resolve paths against it without loading the screens.
 *
 * initialRouteName 'Main': a link that cold-starts the app (or a tapped push,
 * see getInitialURL in AppNavigator) used to build a stack holding ONLY the
 * target screen. Back did nothing and there was no tab bar: the runner had to
 * force-quit (B03). With it, the tabs are always underneath.
 *
 * Subscription has no path while subscriptions are off (SUBSCRIPTIONS_ENABLED).
 */
import type { PathConfigMap } from '@react-navigation/native';
import type { RootStackParamList } from './AppNavigator';

export const LINKING_PREFIXES = ['runivo://', 'https://runivo.app'];

export const linkingConfig: { initialRouteName: 'Main'; screens: PathConfigMap<RootStackParamList> } = {
  initialRouteName: 'Main',
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
    // club/:clubId?invite=… is the club invite link (clubService clubInviteLinks).
    ClubDetail:  'club/:clubId',
    Challenges:  'challenges',
    ChallengeDetail: 'challenges/:id',
    Notifications: 'notifications',
    Settings:          'settings',
    ConnectedDevices:  'settings/devices',
    MapVisibility:     'settings/map-visibility',
    BlockedRunners:    'settings/blocked',
    Privacy:           'settings/privacy',
    Feed:              'feed',
    PACEStore:         'store',
    MyRewards:         'store/mine',
    YearInRunivo:      'year',
    ProfileStats:      'profile/stats',
    TrainingLog:       'profile/log',
    Strength:          'training/strength',
    // r/:userId is the profile card link (profileCard.ts PROFILE_LINK_BASE).
    UserProfile:       { path: 'runner/:userId', alias: ['r/:userId'] },
    TrainingPlan:      'training',
    PlanBuilder:       'training/new',
    PlanSession:       'training/session/:sessionId',
    RunSummary:    'run/summary/:runId',
    AwardDetail:   'award/:awardId',
  },
};

/**
 * While a signed-in runner is still in onboarding, links are ignored (they would
 * open the tabs past it). OnboardingScreen lifts this when it finishes.
 */
export const linkingGate = { paused: false };
