import React from 'react'
import { useNavigate } from 'react-router-dom'
import { User, ArrowLeft } from 'lucide-react'

interface PageHeaderProps {
  title?: string
  showBack?: boolean
  showProfile?: boolean
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  showBack = false,
  showProfile = true
}) => {
  const navigate = useNavigate()

  return (
    <div className="w-full liquid-blur-header sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left Section */}
          <div className="flex items-center gap-4">
            {showBack && (
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} strokeWidth={1.5} />
              </button>
            )}
            {title && (
              <h1 className="text-xl font-light">{title}</h1>
            )}
          </div>

          {/* Right Section - Profile */}
          {showProfile && (
            <button
              onClick={() => navigate('/profile')}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <User size={20} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
