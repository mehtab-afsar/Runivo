import { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { OnboardingWrapper } from '@features/onboarding/components/OnboardingWrapper';
import { BottomNavigation } from '@shared/layout/BottomNavigation';
import { PageTransition } from '@shared/layout/PageTransition';
import { RunivoLogo } from '@shared/ui/RunivoLogo';
import { NavVisibilityContext } from '@shared/hooks/useNavVisibility';
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

function LayoutWithNav({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
      <BottomNavigation />
    </div>
  );
}

function FullscreenWithNav({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BottomNavigation />
    </>
  );
}

/** Minimal inline fallback shown while a lazy chunk is loading. */
function PageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50">
      <div className="w-7 h-7 rounded-full border-2 border-teal-200 border-t-teal-500 animate-spin" />
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
        className="drop-shadow-[0_8px_30px_rgba(8,145,178,0.25)]"
      >
        <RunivoLogo size={72} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mt-4"
        style={{ fontSize: 36, fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: 'italic', fontWeight: 600, letterSpacing: '0.01em', color: '#0F172A' }}
      >
        Run<span style={{ color: '#0891B2' }}>ivo</span>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.85, duration: 0.5 }}
        className="mt-2 text-[11px] tracking-[0.25em] uppercase text-teal-500 font-semibold"
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
        <Route path="/active-run" element={
          <PageTransition><ActiveRun /></PageTransition>
        } />
        <Route path="/run-summary/:id" element={
          <PageTransition><RunSummary /></PageTransition>
        } />
        <Route path="/missions" element={
          <PageTransition><Missions /></PageTransition>
        } />
        <Route path="/events/create" element={
          <PageTransition><CreateEvent /></PageTransition>
        } />
        <Route path="/subscription" element={
          <PageTransition><Subscription /></PageTransition>
        } />
        <Route path="/settings" element={
          <PageTransition><SettingsPage /></PageTransition>
        } />

        {/* Map — fullscreen with floating nav */}
        <Route path="/territory-map" element={
          <PageTransition>
            <FullscreenWithNav><TerritoryMap /></FullscreenWithNav>
          </PageTransition>
        } />

        {/* Standard pages with bottom nav */}
        <Route path="/home" element={
          <PageTransition>
            <LayoutWithNav><Dashboard /></LayoutWithNav>
          </PageTransition>
        } />
        <Route path="/feed" element={
          <PageTransition>
            <LayoutWithNav><Feed /></LayoutWithNav>
          </PageTransition>
        } />
        <Route path="/run" element={
          <PageTransition><RunScreen /></PageTransition>
        } />
        <Route path="/profile" element={
          <PageTransition>
            <LayoutWithNav><Profile /></LayoutWithNav>
          </PageTransition>
        } />
        <Route path="/leaderboard" element={
          <PageTransition>
            <LayoutWithNav><Leaderboard /></LayoutWithNav>
          </PageTransition>
        } />
        <Route path="/events" element={
          <PageTransition>
            <LayoutWithNav><Events /></LayoutWithNav>
          </PageTransition>
        } />
        <Route path="/history" element={
          <PageTransition>
            <LayoutWithNav><History /></LayoutWithNav>
          </PageTransition>
        } />
        <Route path="/club" element={
          <PageTransition>
            <LayoutWithNav><Club /></LayoutWithNav>
          </PageTransition>
        } />
        <Route path="/lobby" element={
          <PageTransition>
            <LayoutWithNav><Lobby /></LayoutWithNav>
          </PageTransition>
        } />
        <Route path="/lobby/:id" element={
          <PageTransition>
            <LayoutWithNav><LobbyChat /></LayoutWithNav>
          </PageTransition>
        } />
        <Route path="/notifications" element={
          <PageTransition>
            <LayoutWithNav><Notifications /></LayoutWithNav>
          </PageTransition>
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

  const hideSplash = () => {
    sessionStorage.setItem('runivo-splash-shown', '1');
    setShowSplash(false);
  };

  return (
    <NavVisibilityContext.Provider value={{ navVisible, setNavVisible }}>
      <AnimatePresence>
        {showSplash && <SplashScreen key="splash" onDone={hideSplash} />}
      </AnimatePresence>

      {!showSplash && (
        <BrowserRouter>
          <OnboardingWrapper>
            <Suspense fallback={<PageLoader />}>
              <AnimatedRoutes />
            </Suspense>
          </OnboardingWrapper>
        </BrowserRouter>
      )}
    </NavVisibilityContext.Provider>
  );
}
