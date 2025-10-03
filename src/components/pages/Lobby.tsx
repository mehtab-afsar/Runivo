import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MessageCircle, Users } from 'lucide-react'

export const Lobby = () => {
  const navigate = useNavigate()

  const handleJoinLobby = () => {
    navigate('/lobby/global')
  }

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 liquid-blur-header">
        <div className="flex items-center justify-between px-6 py-4">
          <button
            onClick={() => navigate('/home')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} className="text-white" />
          </button>
          <h1 className="text-lg font-light text-white">Global Chat</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 px-6">
        {/* Global Chat Card */}
        <div className="liquid-blur-card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <MessageCircle size={32} className="text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-light text-white mb-1">Global Runners</h2>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Users size={16} />
                <span>15,420 members</span>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span>1,247 online</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-sm text-white/70 mb-6">
            Join the worldwide running community. Share your runs, achievements, and connect with runners from around the globe.
          </p>

          <button
            onClick={handleJoinLobby}
            className="w-full py-3 bg-primary text-white rounded-xl font-light hover:bg-primary/90 transition-colors"
          >
            Join Global Chat
          </button>
        </div>
      </div>
    </div>
  )
}
