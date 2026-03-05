import { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { OnboardingWrapper } from '@features/onboarding/components/OnboardingWrapper';
import { BottomNavigation } from '@shared/layout/BottomNavigation';
import { PageTransition } from '@shared/layout/PageTransition';
import { LoadingScreen } from '@shared/ui/LoadingScreen';
import { NavVisibilityContext } from '@shared/hooks/useNavVisibility';
import './index.css';

const Dashboard    = lazy(() => import('@features/dashboard/pages/Dashboard'));
const Feed         = lazy(() => import('@features/social/pages/Feed'));
const RunScreen    = lazy(() => import('@features/run/pages/RunScreen'));
const ActiveRun    = lazy(() => import('@features/run/pages/ActiveRun'));
const RunSummary   = lazy(() => import('@features/run/pages/RunSummary'));
const Profile      = lazy(() => import('@features/profile/pages/Profile'));
const TerritoryMap = lazy(() => import('@features/territory/pages/TerritoryMap'));
const Leaderboard  = lazy(() => import('@features/leaderboard/pages/Leaderboard'));
const Events       = lazy(() => import('@features/events/pages/Events'));
const History      = lazy(() => import('@features/history/pages/History'));
const Club         = lazy(() => import('@features/club/pages/Club'));
const Lobby        = lazy(() => import('@features/lobby/pages/Lobby'));
const LobbyChat    = lazy(() => import('@features/lobby/pages/LobbyChat'));

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

export default function App() {
  const [navVisible, setNavVisible] = useState(true);

  return (
    <NavVisibilityContext.Provider value={{ navVisible, setNavVisible }}>
    <BrowserRouter>
      <OnboardingWrapper>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {/* Fullscreen pages (no bottom nav) */}
            <Route path="/active-run" element={<ActiveRun />} />
            <Route path="/run-summary/:id" element={<RunSummary />} />

            {/* Map tab — fullscreen map with floating nav */}
            <Route path="/territory-map" element={
              <FullscreenWithNav><TerritoryMap /></FullscreenWithNav>
            } />

            {/* Pages with bottom nav */}
            <Route path="/home" element={
              <LayoutWithNav><PageTransition><Dashboard /></PageTransition></LayoutWithNav>
            } />
            <Route path="/feed" element={
              <LayoutWithNav><PageTransition><Feed /></PageTransition></LayoutWithNav>
            } />
            <Route path="/run" element={<RunScreen />} />
            <Route path="/profile" element={
              <LayoutWithNav><PageTransition><Profile /></PageTransition></LayoutWithNav>
            } />
            <Route path="/leaderboard" element={
              <LayoutWithNav><PageTransition><Leaderboard /></PageTransition></LayoutWithNav>
            } />
            <Route path="/events" element={
              <LayoutWithNav><PageTransition><Events /></PageTransition></LayoutWithNav>
            } />
            <Route path="/history" element={
              <LayoutWithNav><PageTransition><History /></PageTransition></LayoutWithNav>
            } />
            <Route path="/club" element={
              <LayoutWithNav><PageTransition><Club /></PageTransition></LayoutWithNav>
            } />
            <Route path="/lobby" element={
              <LayoutWithNav><PageTransition><Lobby /></PageTransition></LayoutWithNav>
            } />
            <Route path="/lobby/:id" element={
              <LayoutWithNav><PageTransition><LobbyChat /></PageTransition></LayoutWithNav>
            } />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </Suspense>
      </OnboardingWrapper>
    </BrowserRouter>
    </NavVisibilityContext.Provider>
  );
}
