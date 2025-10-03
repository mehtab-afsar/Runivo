import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GlobeGL } from '@/components/globe/GlobeGL'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { StatusIndicators } from '@/components/dashboard/StatusIndicators'
import { SlidingDrawer, FooterTabId } from '@/components/drawer/SlidingDrawer'

export const Dashboard = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<FooterTabId>('leaderboard')

  // User's current location (will be replaced with actual geolocation later)
  const territories = [
    { lat: 37.7749, lng: -122.4194, name: 'Your Location', claimed: true }
  ]

  const handleLobbyClick = () => {
    navigate('/lobby')
  }

  const handleClubClick = () => {
    navigate('/club')
  }

  const handleCountryClick = (country: string) => {
    console.log('Country clicked:', country)
  }

  const handleTabClick = (tabId: FooterTabId) => {
    setActiveTab(tabId)
  }

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Full-Screen Globe Background */}
      <div className="absolute inset-0 z-0">
        <GlobeGL
          territories={territories}
          onCountryClick={handleCountryClick}
        />
      </div>

      {/* Dashboard Header - Floating */}
      <div className="fixed top-0 left-0 right-0 h-[10vh] z-30">
        <DashboardHeader
          onLobbyClick={handleLobbyClick}
          onClubClick={handleClubClick}
        />
      </div>

      {/* Status Indicators (Fixed on Right) */}
      <div className="fixed right-6 top-[12vh] z-30">
        <StatusIndicators
          notifications={3}
          energy="LO"
          achievements={9}
        />
      </div>



      {/* Sliding Drawer with integrated tabs - Always visible at bottom */}
      <SlidingDrawer activeTab={activeTab} onTabChange={handleTabClick} />
    </div>
  )
}
