import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { OnboardingWrapper } from '@/components/onboarding/OnboardingFlow'
import { Dashboard } from '@/components/pages/Dashboard'
import { Feed } from '@/components/pages/Feed'
import { Activity } from '@/components/pages/Activity'
import { RunScreen } from '@/components/pages/RunScreen'
import { ActiveRun } from '@/components/pages/ActiveRun'
import { RunSummary } from '@/components/pages/RunSummary'
import { Profile } from '@/components/pages/Profile'
import { Leaderboard } from '@/components/pages/Leaderboard'
import { Events } from '@/components/pages/Events'
import { Territories } from '@/components/pages/Territories'
import { History } from '@/components/pages/History'
import { Club } from '@/components/pages/Club'
import { Lobby } from '@/components/pages/Lobby'
import { LobbyChat } from '@/components/pages/LobbyChat'
// Legacy imports for backward compatibility
import { TerritoryManagement } from '@/components/pages/TerritoryManagement'
import { Leaderboards } from '@/components/pages/Leaderboards'
import { RoutePlanner } from '@/components/pages/RoutePlanner'
import { TerritoryExplorer } from '@/components/pages/TerritoryExplorer'
import { CommunityHub } from '@/components/pages/CommunityHub'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import { BottomNavigation } from '@/components/navigation/BottomNavigation'
import './index.css'

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Router>
        <OnboardingWrapper>
          <Routes>
          {/* New 4-Tab Clean Architecture */}
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<Dashboard />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/run" element={<RunScreen />} />
          <Route path="/profile" element={<Profile />} />

          {/* Dashboard Sub-Pages */}
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/events" element={<Events />} />
          <Route path="/territories" element={<Territories />} />
          <Route path="/history" element={<History />} />
          <Route path="/club" element={<Club />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/lobby/:id" element={<LobbyChat />} />

          {/* Activity & Run Routes */}
          <Route path="/activity" element={<Activity />} />
          <Route path="/activity/:id" element={<Activity />} />

          {/* Legacy Territory Route */}
          <Route path="/territory" element={<TerritoryManagement />} />

          {/* Active Run & Summary */}
          <Route path="/active-run" element={<ActiveRun />} />
          <Route path="/run-summary/:runId" element={<RunSummary />} />

          {/* Legacy Routes for Backward Compatibility */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/route-planner" element={<RoutePlanner />} />
          <Route path="/territory-explorer" element={<TerritoryExplorer />} />
          <Route path="/leaderboards" element={<Leaderboards />} />
          <Route path="/community" element={<CommunityHub />} />
          <Route path="/notifications" element={<NotificationCenter />} />
          </Routes>
          <BottomNavigation />
        </OnboardingWrapper>
      </Router>
    </div>
  )
}

export default App
