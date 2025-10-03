import { useState } from 'react'
import { X, Check, Upload, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CreateClubModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateClub: (clubData: { name: string; logoUrl: string; description: string }) => void
  existingClubNames: string[]
}

export const CreateClubModal = ({ isOpen, onClose, onCreateClub, existingClubNames }: CreateClubModalProps) => {
  const [clubName, setClubName] = useState('')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [description, setDescription] = useState('')
  const [nameError, setNameError] = useState('')
  const [imageError, setImageError] = useState('')

  if (!isOpen) return null

  const validateClubName = (name: string) => {
    if (!name.trim()) {
      setNameError('Club name is required')
      return false
    }
    if (name.length < 3) {
      setNameError('Club name must be at least 3 characters')
      return false
    }
    if (name.length > 30) {
      setNameError('Club name must be less than 30 characters')
      return false
    }
    // Check for unique name (case-insensitive)
    const normalizedName = name.trim().toLowerCase()
    if (existingClubNames.some(existingName => existingName.toLowerCase() === normalizedName)) {
      setNameError('This club name is already taken')
      return false
    }
    setNameError('')
    return true
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setClubName(newName)
    if (newName.trim()) {
      validateClubName(newName)
    } else {
      setNameError('')
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setImageError('Please upload an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Image size must be less than 5MB')
      return
    }

    setImageError('')
    setLogoFile(file)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setLogoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleCreateClub = () => {
    if (validateClubName(clubName)) {
      onCreateClub({
        name: clubName.trim(),
        logoUrl: logoPreview || '', // In production, upload to server and get URL
        description: description.trim()
      })
      // Reset form
      setClubName('')
      setLogoPreview(null)
      setLogoFile(null)
      setDescription('')
      setNameError('')
      setImageError('')
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="liquid-blur-card rounded-2xl p-6 max-w-md w-full mx-4 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-light text-white">Create New Club</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Logo Upload */}
        <div className="space-y-2">
          <label className="text-sm font-light text-white/70">Club Logo</label>
          <div className="flex items-center gap-4">
            {/* Preview */}
            <div className={cn(
              'w-24 h-24 rounded-xl flex items-center justify-center overflow-hidden',
              logoPreview ? 'bg-white/5' : 'liquid-blur-subtle border-2 border-dashed border-white/20'
            )}>
              {logoPreview ? (
                <img src={logoPreview} alt="Club logo preview" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={32} className="text-white/40" />
              )}
            </div>

            {/* Upload Button */}
            <div className="flex-1">
              <label className="block cursor-pointer">
                <div className="liquid-blur-subtle hover:bg-white/10 rounded-xl p-4 transition-colors border border-white/10">
                  <div className="flex items-center gap-3">
                    <Upload size={20} className="text-primary" />
                    <div>
                      <div className="text-sm font-light text-white">
                        {logoFile ? logoFile.name : 'Upload Logo'}
                      </div>
                      <div className="text-xs text-white/50">Max 5MB, JPG or PNG</div>
                    </div>
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
              {imageError && (
                <p className="text-xs text-red-400 mt-2">{imageError}</p>
              )}
            </div>
          </div>
        </div>

        {/* Club Name */}
        <div className="space-y-2">
          <label className="text-sm font-light text-white/70">Club Name *</label>
          <input
            type="text"
            value={clubName}
            onChange={handleNameChange}
            placeholder="Enter a unique club name..."
            maxLength={30}
            className={cn(
              'w-full bg-white/5 border rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none transition-colors',
              nameError
                ? 'border-red-500/50 focus:border-red-500'
                : 'border-white/10 focus:border-primary/50'
            )}
          />
          <div className="flex items-center justify-between">
            {nameError ? (
              <span className="text-xs text-red-400">{nameError}</span>
            ) : (
              <span className="text-xs text-white/40">
                {clubName.length}/30 characters
              </span>
            )}
            {clubName.trim() && !nameError && (
              <div className="flex items-center gap-1 text-xs text-green-400">
                <Check size={14} />
                <span>Available</span>
              </div>
            )}
          </div>
        </div>

        {/* Description (Optional) */}
        <div className="space-y-2">
          <label className="text-sm font-light text-white/70">Description (Optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell others about your club..."
            maxLength={100}
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-primary/50 resize-none"
          />
          <span className="text-xs text-white/40">{description.length}/100 characters</span>
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
            onClick={handleCreateClub}
            disabled={!clubName.trim() || !!nameError}
            className={cn(
              'flex-1 py-3 rounded-lg font-light transition-all',
              clubName.trim() && !nameError
                ? 'bg-primary text-white hover:bg-primary/90'
                : 'bg-white/10 text-white/40 cursor-not-allowed'
            )}
          >
            Create Club
          </button>
        </div>
      </div>
    </div>
  )
}
