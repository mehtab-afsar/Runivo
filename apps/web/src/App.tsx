import { Suspense, lazy, useState, useEffect } from 'react';
import { FeatureErrorBoundary } from '@shared/components/FeatureErrorBoundary';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { OnboardingWrapper } from '@features/onboarding/components/OnboardingWrapper';
import { BottomNavigation } from '@shared/layout/BottomNavigation';
import { PageTransition } from '@shared/layout/PageTransition';
import { RunivoLogo } from '@shared/ui/RunivoLogo';
import { NavVisibilityContext } from '@/shared/hooks/useNavVisibility';
import { NotificationToast } from '@features/notifications/components/NotificationToast';
import { ThemeProvider } from '@/shared/hooks/useTheme';
import './index.css';

const Dashboard     = lazy(() => import('@features/dashboard/pages/Dashboard'));
const Feed          = lazy(() => import('@features/social/pages/Feed'));
const RunScreen     = lazy(() => import('@features/run/pages/RunScreen'));
const ActiveRun     = lazy(() => import('@features/run/pages/ActiveRun'));
const RunSummary    = lazy(() => import('@features/run/pages/RunSummary'));
const Profile       = lazy(() => import('@features/profile/pages/Profile'));
const TerritoryMap  = lazy(() => import('@features/territory/pages/TerritoryMap'));
const Leaderboard   = lazy(() => import('@features/leaderboard/pages/Leaderboard'));
const Events        = lazy(() => import('@features/events/pages/Events'));
const History       = lazy(() => import('@features/history/pages/History'));
const Club          = lazy(() => import('@features/club/pages/Club'));
const Lobby         = lazy(() => import('@features/lobby/pages/Lobby'));
const LobbyChat     = lazy(() => import('@features/lobby/pages/LobbyChat'));
const Notifications = lazy(() => import('@features/notifications/pages/Notifications'));
const Missions      = lazy(() => import('@features/missions/pages/Missions'));
const CreateEvent   = lazy(() => import('@features/events/pages/CreateEvent'));
const Subscription  = lazy(() => import('@features/subscription/pages/Subscription'));
const SettingsPage  = lazy(() => import('@features/settings/pages/Settings'));
const DesignSystem      = lazy(() => import('@shared/design-system/DesignSystemPage'));
const CalorieTracker    = lazy(() => import('@features/nutrition/pages/CalorieTracker'));
const NutritionSetup    = lazy(() => import('@features/nutrition/pages/NutritionSetup'));
const CoachScreen       = lazy(() => import('@features/intelligence/pages/CoachScreen'));
const StoryViewer       = lazy(() => import('@features/social/pages/StoryViewer'));
const ShoeList          = lazy(() => import('@features/gear/pages/ShoeList'));
const AddShoe           = lazy(() => import('@features/gear/pages/AddShoe'));
const FootScan          = lazy(() => import('@features/gear/pages/FootScan'));
const ConnectedDevices  = lazy(() => import('@features/settings/pages/ConnectedDevices'));

function LayoutWithNav({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function FullscreenWithNav({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/** Minimal inline fallback shown while a lazy chunk is loading. */
function PageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-sm z-50">
      <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(232,67,90,0.2)', borderTopColor: '#E8435A' }} />
    </div>
  );
}

function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-[#FEFEFE]"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 14, stiffness: 120, delay: 0.1 }}
        className="drop-shadow-[0_8px_30px_rgba(232,67,90,0.25)]"
      >
        <RunivoLogo size={72} animate />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mt-4"
        style={{ fontSize: 36, fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: 'normal', fontWeight: 600, letterSpacing: '0.01em', color: '#0F172A' }}
      >
        run<span style={{ color: '#E8435A' }}>ivo</span>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.85, duration: 0.5 }}
        className="mt-2 text-[11px] tracking-[0.25em] uppercase font-semibold" style={{ color: '#E8435A' }}
      >
        Run · Capture · Conquer
      </motion.p>
    </motion.div>
  );
}

/**
 * All routes live here so we have access to useLocation().
 * AnimatePresence at this level means exit animations actually fire
 * before the next page mounts.
 */
function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.key}>
        {/* Fullscreen — no bottom nav */}
        <Route path="/story-viewer" element={
          <FeatureErrorBoundary feature="Story Viewer">
            <StoryViewer />
          </FeatureErrorBoundary>
        } />
        <Route path="/active-run" element={
          <FeatureErrorBoundary feature="Active Run">
            <PageTransition><ActiveRun /></PageTransition>
          </FeatureErrorBoundary>
        } />
        <Route path="/run-summary/:id" element={
          <FeatureErrorBoundary feature="Run Summary">
            <PageTransition><RunSummary /></PageTransition>
          </FeatureErrorBoundary>
        } />
        <Route path="/missions" element={
          <FeatureErrorBoundary feature="Missions">
            <PageTransition><Missions /></PageTransition>
          </FeatureErrorBoundary>
        } />
        <Route path="/events/create" element={
          <FeatureErrorBoundary feature="Create Event">
            <PageTransition><CreateEvent /></PageTransition>
          </FeatureErrorBoundary>
        } />
        <Route path="/subscription" element={
          <FeatureErrorBoundary feature="Subscription">
            <PageTransition><Subscription /></PageTransition>
          </FeatureErrorBoundary>
        } />
        <Route path="/settings" element={
          <FeatureErrorBoundary feature="Settings">
            <PageTransition><SettingsPage /></PageTransition>
          </FeatureErrorBoundary>
        } />
        <Route path="/settings/devices" element={
          <FeatureErrorBoundary feature="Connected Devices">
            <PageTransition><ConnectedDevices /></PageTransition>
          </FeatureErrorBoundary>
        } />
        {/* OAuth providers redirect back here after authorisation */}
        <Route path="/settings/devices/callback" element={
          <FeatureErrorBoundary feature="Connected Devices">
            <PageTransition><ConnectedDevices /></PageTransition>
          </FeatureErrorBoundary>
        } />

        {/* Map — fullscreen with floating nav */}
        <Route path="/territory-map" element={
          <FeatureErrorBoundary feature="Territory Map">
            <PageTransition>
              <FullscreenWithNav><TerritoryMap /></FullscreenWithNav>
            </PageTransition>
          </FeatureErrorBoundary>
        } />

        {/* Standard pages with bottom nav */}
        <Route path="/home" element={
          <FeatureErrorBoundary feature="Dashboard">
            <PageTransition>
              <LayoutWithNav><Dashboard /></LayoutWithNav>
            </PageTransition>
          </FeatureErrorBoundary>
        } />
        <Route path="/feed" element={
          <FeatureErrorBoundary feature="Feed">
            <PageTransition>
              <LayoutWithNav><Feed /></LayoutWithNav>
            </PageTransition>
          </FeatureErrorBoundary>
        } />
        <Route path="/run" element={
          <FeatureErrorBoundary feature="Run Screen">
            <PageTransition><RunScreen /></PageTransition>
          </FeatureErrorBoundary>
        } />
        <Route path="/profile" element={
          <FeatureErrorBoundary feature="Profile">
            <PageTransition>
              <LayoutWithNav><Profile /></LayoutWithNav>
            </PageTransition>
          </FeatureErrorBoundary>
        } />
        <Route path="/leaderboard" element={
          <FeatureErrorBoundary feature="Leaderboard">
            <PageTransition>
              <LayoutWithNav><Leaderboard /></LayoutWithNav>
            </PageTransition>
          </FeatureErrorBoundary>
        } />
        <Route path="/events" element={
          <FeatureErrorBoundary feature="Events">
            <PageTransition>
              <LayoutWithNav><Events /></LayoutWithNav>
            </PageTransition>
          </FeatureErrorBoundary>
        } />
        <Route path="/history" element={
          <FeatureErrorBoundary feature="History">
            <PageTransition>
              <LayoutWithNav><History /></LayoutWithNav>
            </PageTransition>
          </FeatureErrorBoundary>
        } />
        <Route path="/calories" element={
          <FeatureErrorBoundary feature="Calorie Tracker">
            <PageTransition>
              <LayoutWithNav><CalorieTracker /></LayoutWithNav>
            </PageTransition>
          </FeatureErrorBoundary>
        } />
        <Route path="/calories/setup" element={
          <FeatureErrorBoundary feature="Nutrition Setup">
            <PageTransition><NutritionSetup /></PageTransition>
          </FeatureErrorBoundary>
        } />
        <Route path="/club" element={
          <FeatureErrorBoundary feature="Club">
            <PageTransition>
              <LayoutWithNav><Club /></LayoutWithNav>
            </PageTransition>
          </FeatureErrorBoundary>
        } />
        <Route path="/lobby" element={
          <FeatureErrorBoundary feature="Lobby">
            <PageTransition>
              <LayoutWithNav><Lobby /></LayoutWithNav>
            </PageTransition>
          </FeatureErrorBoundary>
        } />
        <Route path="/lobby/:id" element={
          <FeatureErrorBoundary feature="Lobby Chat">
            <PageTransition>
              <LayoutWithNav><LobbyChat /></LayoutWithNav>
            </PageTransition>
          </FeatureErrorBoundary>
        } />
        <Route path="/notifications" element={
          <FeatureErrorBoundary feature="Notifications">
            <PageTransition>
              <LayoutWithNav><Notifications /></LayoutWithNav>
            </PageTransition>
          </FeatureErrorBoundary>
        } />
        <Route path="/coach" element={
          <FeatureErrorBoundary feature="AI Coach">
            <PageTransition>
              <LayoutWithNav><CoachScreen /></LayoutWithNav>
            </PageTransition>
          </FeatureErrorBoundary>
        } />

        {/* Gear / shoe tracker */}
        <Route path="/gear" element={
          <FeatureErrorBoundary feature="Shoe Tracker">
            <PageTransition><ShoeList /></PageTransition>
          </FeatureErrorBoundary>
        } />
        <Route path="/gear/add" element={
          <FeatureErrorBoundary feature="Add Shoe">
            <PageTransition><AddShoe onSaved={() => history.back()} onClose={() => history.back()} /></PageTransition>
          </FeatureErrorBoundary>
        } />
        <Route path="/gear/scan" element={
          <FeatureErrorBoundary feature="Foot Scan">
            <PageTransition><FootScan onDone={() => history.back()} onClose={() => history.back()} /></PageTransition>
          </FeatureErrorBoundary>
        } />

        {/* Design system */}
        <Route path="/design-system" element={
          <PageTransition><DesignSystem /></PageTransition>
        } />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  const [navVisible, setNavVisible] = useState(true);
  const [showSplash, setShowSplash] = useState(() => {
    if (import.meta.env.VITE_E2E_TEST_MODE === 'true') return false;
    if (sessionStorage.getItem('runivo-splash-shown')) return false;
    return true;
  });

  // Register service worker for Web Push notifications
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(async (reg) => {
      // Request notification permission once
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      if (Notification.permission !== 'granted') return;

      // Subscribe to Web Push using the VAPID public key from env
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) return;

      try {
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidPublicKey,
        });
        const json = sub.toJSON();

        // Persist the subscription to Supabase so the edge function can fan out
        const { supabase } = await import('@shared/services/supabase');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        await supabase.from('push_subscriptions').upsert({
          user_id:  session.user.id,
          endpoint: json.endpoint,
          p256dh:   (json.keys as Record<string, string>).p256dh,
          auth:     (json.keys as Record<string, string>).auth,
        }, { onConflict: 'user_id,endpoint', ignoreDuplicates: true });
      } catch {
        // Push subscription failed (e.g. denied, incognito) — not fatal
      }
    }).catch(() => {
      // Service worker registration failed — not fatal
    });
  }, []);

  const hideSplash = () => {
    sessionStorage.setItem('runivo-splash-shown', '1');
    setShowSplash(false);
  };

  return (
    <ThemeProvider>
      <NavVisibilityContext.Provider value={{ navVisible, setNavVisible }}>
        <AnimatePresence>
          {showSplash && <SplashScreen key="splash" onDone={hideSplash} />}
        </AnimatePresence>

        {!showSplash && (
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <OnboardingWrapper>
              <Suspense fallback={<PageLoader />}>
                <AnimatedRoutes />
              </Suspense>
              <BottomNavigation />
            </OnboardingWrapper>
            <NotificationToast />
          </BrowserRouter>
        )}
      </NavVisibilityContext.Provider>
    </ThemeProvider>
  );
}
