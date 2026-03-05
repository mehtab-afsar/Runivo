import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { OnboardingWrapper } from '@/components/onboarding/OnboardingWrapper';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { PageTransition } from '@/components/layout/PageTransition';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import './index.css';

const Dashboard = lazy(() => import('./components/pages/Dashboard'));
const Feed = lazy(() => import('./components/pages/Feed'));
const RunScreen = lazy(() => import('./components/pages/RunScreen'));
const ActiveRun = lazy(() => import('./components/pages/ActiveRun'));
const RunSummary = lazy(() => import('./components/pages/RunSummary'));
const Profile = lazy(() => import('./components/pages/Profile'));
const TerritoryMap = lazy(() => import('./components/pages/TerritoryMap'));
const Leaderboard = lazy(() => import('./components/pages/Leaderboard'));
const Events = lazy(() => import('./components/pages/Events'));
const History = lazy(() => import('./components/pages/History'));
const Club = lazy(() => import('./components/pages/Club'));
const Lobby = lazy(() => import('./components/pages/Lobby'));
const LobbyChat = lazy(() => import('./components/pages/LobbyChat'));

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
  return (
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
  );
}
