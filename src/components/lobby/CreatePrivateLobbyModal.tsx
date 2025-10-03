import { useState } from 'react'
import { X, Lock, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CreatePrivateLobbyModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (lobbyData: { name: string; description: string }) => void
}

export const CreatePrivateLobbyModal = ({ isOpen, onClose, onCreate }: CreatePrivateLobbyModalProps) => {
  const [lobbyName, setLobbyName] = useState('')
  const [description, setDescription] = useState('')
  const [maxMembers, setMaxMembers] = useState(50)

  if (!isOpen) return null

  const handleCreate = () => {
    if (lobbyName.trim()) {
      onCreate({
        name: lobbyName.trim(),
        description: description.trim()
      })
      // Reset form
      setLobbyName('')
      setDescription('')
      setMaxMembers(50)
    }
  }

  const generateInviteCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="liquid-blur-card rounded-2xl p-6 max-w-md w-full mx-4 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock size={20} className="text-primary" />
            <h2 className="text-xl font-light text-white">Create Private Group</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Group Name */}
        <div className="space-y-2">
          <label className="text-sm font-light text-white/70">Group Name *</label>
          <input
            type="text"
            value={lobbyName}
            onChange={(e) => setLobbyName(e.target.value)}
            placeholder="e.g., Weekend Warriors, NYC Runners..."
            maxLength={30}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-primary/50"
          />
          <span className="text-xs text-white/40">{lobbyName.length}/30 characters</span>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-sm font-light text-white/70">Description (Optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this group about?"
            maxLength={100}
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-primary/50 resize-none"
          />
          <span className="text-xs text-white/40">{description.length}/100 characters</span>
        </div>

        {/* Max Members */}
        <div className="space-y-2">
          <label className="text-sm font-light text-white/70">Maximum Members</label>
          <div className="flex items-center gap-3">
            <Users size={20} className="text-white/50" />
            <input
              type="range"
              min="5"
              max="50"
              value={maxMembers}
              onChange={(e) => setMaxMembers(parseInt(e.target.value))}
              className="flex-1"
            />
            <span className="text-sm text-white font-light w-12 text-right">{maxMembers}</span>
          </div>
        </div>

        {/* Info Box */}
        <div className="liquid-blur-subtle rounded-xl p-4">
          <h4 className="text-sm font-light text-white mb-2">After creating:</h4>
          <ul className="text-xs text-white/60 space-y-1">
            <li>• You'll get an invite code to share</li>
            <li>• Only invited members can join</li>
            <li>• You'll be the group admin</li>
            <li>• You can manage members anytime</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-lg liquid-blur-subtle hover:bg-white/10 transition-colors text-white font-light"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!lobbyName.trim()}
            className={cn(
              'flex-1 py-3 rounded-lg font-light transition-all',
              lobbyName.trim()
                ? 'bg-primary text-white hover:bg-primary/90'
                : 'bg-white/10 text-white/40 cursor-not-allowed'
            )}
          >
            Create Group
          </button>
        </div>
      </div>
    </div>
  )
}
