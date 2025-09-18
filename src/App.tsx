import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { OnboardingWrapper } from '@/components/onboarding/OnboardingFlow'
import { MapHome } from '@/components/pages/MapHome'
import { Activity } from '@/components/pages/Activity'
import { RunScreen } from '@/components/pages/RunScreen'
import { ActiveRun } from '@/components/pages/ActiveRun'
import { RunSummary } from '@/components/pages/RunSummary'
import { TerritoryManagement } from '@/components/pages/TerritoryManagement'
import { Compete } from '@/components/pages/Compete'
import { Profile } from '@/components/pages/Profile'
import { Leaderboards } from '@/components/pages/Leaderboards'
// Legacy imports for backward compatibility
import { Dashboard } from '@/components/pages/Dashboard'
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
          <div className="pb-20"> {/* Space for bottom navigation */}
          <Routes>
          {/* New 5-Tab Territory Run Architecture */}
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<MapHome />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/activity/:id" element={<Activity />} />
          <Route path="/run" element={<RunScreen />} />
          <Route path="/compete" element={<Compete />} />
          <Route path="/profile" element={<Profile />} />

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
          </div>
          <BottomNavigation />
        </OnboardingWrapper>
      </Router>
    </div>
  )
}

export default App
